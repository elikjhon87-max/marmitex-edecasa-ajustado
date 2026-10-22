import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// VAPID keys are loaded from the database (business_config table).

// Minimal Web Push implementation using Web Crypto API (no external dependency).
// Based on RFC 8291 (Voluntary Application Server Identification) + RFC 8188 (Encrypted Content-Encoding).

function base64UrlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidPrivateKey(vapidPrivateKey: string): Promise<CryptoKey> {
  const der = base64UrlDecode(vapidPrivateKey);
  return crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
}

async function vapidSign(vapidPrivateKey: string, input: string): Promise<string> {
  const key = await importVapidPrivateKey(vapidPrivateKey);
  const data = new TextEncoder().encode(input);
  const sig = await crypto.subtle.sign("SHA-256", key, data);
  return base64UrlEncode(new Uint8Array(sig));
}

async function generateVapidAuth(vapidPublicKey: string, vapidPrivateKey: string, endpoint: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const payload = JSON.stringify({ aud: new URL(endpoint).origin, exp, sub: "mailto:edecasa@marmitex.app" });
  const b64 = btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sig = await vapidSign(vapidPrivateKey, b64);
  return `vapid.t=${b64},k=${vapidPublicKey.replace(/=/g, "")},s=${sig}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

async function aesGcmEncrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array, aad?: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, cryptoKey, data);
  return new Uint8Array(encrypted);
}

async function ecdh(publicKeyRaw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", publicKeyRaw, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

async function deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
}

async function generateEcdhKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
}

async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

async function encryptPayload(payload: string, subscription: { endpoint: string; keys_p256dh: string; keys_auth: string }): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; dhPublicKey: Uint8Array }> {
  const clientPublicKey = base64UrlDecode(subscription.keys_p256dh);
  const clientAuthSecret = base64UrlDecode(subscription.keys_auth);

  // Generate ephemeral server key pair.
  const serverKeyPair = await generateEcdhKeyPair();
  const serverPublicKeyRaw = await exportRawKey(serverKeyPair.publicKey);

  // Import client public key.
  const clientPubKey = await ecdh(clientPublicKey);

  // Compute shared secret.
  const sharedSecret = new Uint8Array(await deriveSharedSecret(serverKeyPair.privateKey, clientPubKey));

  // Compute IKM = HKDF(auth secret, shared secret, "Content-Encoding: auth\0", 32)
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const ikm = await hkdf(clientAuthSecret, sharedSecret, authInfo, 32);

  // Generate salt (16 bytes).
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Key derivation: context = "P-256\0" + len(clientPub) + clientPub + len(serverPub) + serverPub
  const context = new Uint8Array(5 + 1 + clientPublicKey.length + 1 + serverPublicKeyRaw.length);
  context.set(new TextEncoder().encode("P-256"), 0);
  context[5] = 0;
  context[6] = clientPublicKey.length;
  context.set(clientPublicKey, 7);
  context[7 + clientPublicKey.length] = serverPublicKeyRaw.length;
  context.set(serverPublicKeyRaw, 8 + clientPublicKey.length);

  // Derive content encryption key (CEK) and nonce.
  const cekInfo = new Uint8Array([...new TextEncoder().encode("Content-Encoding: aes128gcm\0"), ...context]);
  const nonceInfo = new Uint8Array([...new TextEncoder().encode("Content-Encoding: nonce\0"), ...context]);

  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Pad and encrypt payload (RFC 8188 format: record = payload + padding + 2-byte length + 1-byte delimiter).
  const payloadBytes = new TextEncoder().encode(payload);
  // Max padding to reach 4096 bytes total (or at least payload + 1).
  const padding = Math.max(0, 4096 - payloadBytes.length - 1 - 4);
  const record = new Uint8Array(payloadBytes.length + padding + 1 + 4);
  record.set(payloadBytes, 0);
  // Fill padding with zeros (except last byte).
  // Last 5 bytes: 2-byte padding length (big-endian) + 1 byte delimiter (0x02 for last record) + 2-byte... Actually:
  // RFC 8188: each record ends with 1 byte: 0x01 (not last) or 0x02 (last). Then no explicit length in aes128gcm.
  // Actually the format for aes128gcm is: payload + padding + delimiter_byte (0x02 for final).
  const finalRecord = new Uint8Array(payloadBytes.length + 1);
  finalRecord.set(payloadBytes, 0);
  finalRecord[payloadBytes.length] = 0x02; // delimiter for last record.

  const ciphertext = await aesGcmEncrypt(cek, nonce, finalRecord);

  return { ciphertext, salt, dhPublicKey: serverPublicKeyRaw };
}

async function sendPush(vapidPublicKey: string, vapidPrivateKey: string, subscription: { endpoint: string; keys_p256dh: string; keys_auth: string }, payload: object): Promise<boolean> {
  const payloadStr = JSON.stringify(payload);
  const { ciphertext, salt, dhPublicKey } = await encryptPayload(payloadStr, subscription);

  // Build the aes128gcm header (RFC 8188 Section 2.1).
  // Header: salt (16) + rs (4, big-endian, 4096) + idlen (1) + keyid (dh public key).
  const header = new Uint8Array(16 + 4 + 1 + dhPublicKey.length);
  header.set(salt, 0);
  const rs = new DataView(header.buffer, 16, 4);
  rs.setUint32(0, 4096);
  header[20] = dhPublicKey.length;
  header.set(dhPublicKey, 21);

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header, 0);
  body.set(ciphertext, header.length);

  const authHeader = await generateVapidAuth(vapidPublicKey, vapidPrivateKey, subscription.endpoint);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Authorization": authHeader,
      "TTL": "86400",
    },
    body,
  });

  return response.ok || response.status === 201 || response.status === 202;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { target_user_id, is_store, title, body: notifBody, kind, delivery_status, order_id, url } = body;

    if (!title || !notifBody) {
      return new Response(JSON.stringify({ error: "Missing title or body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Load VAPID keys from business_config.
    const { data: configData } = await supabase
      .from("business_config")
      .select("vapid_public_key, vapid_private_key")
      .eq("id", 1)
      .maybeSingle();
    const vapidPublicKey = configData?.vapid_public_key ?? "";
    const vapidPrivateKey = configData?.vapid_private_key ?? "";
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find subscriptions for the target.
    let query = supabase.from("push_subscriptions").select("*");
    if (is_store) {
      query = query.eq("is_store", true);
    } else if (target_user_id) {
      query = query.eq("user_id", target_user_id);
    } else {
      return new Response(JSON.stringify({ error: "Either is_store or target_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await query;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pushPayload = {
      title,
      body: notifBody,
      kind: kind ?? "general",
      delivery_status: delivery_status ?? undefined,
      order_id: order_id ?? undefined,
      icon: "/assets/5049368D-D189-404F-ABC1-277F472E981E.jpeg",
      badge: "/assets/5049368D-D189-404F-ABC1-277F472E981E.jpeg",
      url: url ?? "/",
    };

    let sentCount = 0;
    for (const sub of subs) {
      try {
        const ok = await sendPush(
          vapidPublicKey,
          vapidPrivateKey,
          { endpoint: sub.endpoint, keys_p256dh: sub.keys_p256dh, keys_auth: sub.keys_auth },
          pushPayload,
        );
        if (ok) sentCount++;
      } catch {
        // Continue sending to other subscriptions even if one fails.
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, total: subs.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});