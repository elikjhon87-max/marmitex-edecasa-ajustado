// Edge function: calcula a distância real de carro entre a loja e o endereço do cliente.
// Usa Nominatim (OpenStreetMap) para geocodificação e OSRM para rota de carro.
// Mantém um cache em `geocode_cache` para evitar chamadas repetidas (Nominatim limita 1 req/s).

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
}

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s,áàâãéêíóôõúç-]/gi, "");
}

async function geocode(address: string): Promise<GeocodeResult | null> {
  const key = normalizeAddress(address);
  if (!key) return null;

  // Check cache first
  const { data: cached } = await supabase
    .from("geocode_cache")
    .select("lat, lng, formatted_address")
    .eq("address_key", key)
    .maybeSingle();

  if (cached) {
    return { lat: cached.lat, lng: cached.lng, formatted: cached.formatted_address };
  }

  // Geocode via Nominatim (limit 1 req/s — only on cache miss)
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=br`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "MarmitexEdeCasa/1.0 (delivery routing)",
      "Accept-Language": "pt-BR",
    },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const result: GeocodeResult = {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    formatted: data[0].display_name ?? address,
  };

  // Save to cache
  await supabase.from("geocode_cache").insert({
    address_key: key,
    lat: result.lat,
    lng: result.lng,
    formatted_address: result.formatted,
  }).then(() => undefined).catch(() => undefined);

  return result;
}

async function routeDistance(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): Promise<{ distanceKm: number; durationMin: number } | null> {
  const coords = `${startLng},${startLat};${endLng},${endLat}`;
  const url = `${OSRM_URL}/${coords}?overview=false`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.routes || data.routes.length === 0) return null;

  return {
    distanceKm: data.routes[0].distance / 1000,
    durationMin: data.routes[0].duration / 60,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { destination } = body as { destination?: string };

    if (!destination || !destination.trim()) {
      return new Response(
        JSON.stringify({ error: "Endereço de destino é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load business config
    const { data: config } = await supabase
      .from("business_config")
      .select("store_address, store_lat, store_lng, delivery_price_per_km, delivery_base_fee, delivery_free_km, delivery_max_km, delivery_pricing_mode")
      .eq("id", 1)
      .maybeSingle();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Configuração da loja não encontrada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let storeLat = config.store_lat as number | null;
    let storeLng = config.store_lng as number | null;

    // Geocode the store if not yet geocoded
    if (storeLat === null || storeLng === null) {
      const storeAddr = config.store_address || config.address || "";
      if (!storeAddr) {
        return new Response(
          JSON.stringify({ error: "Cadastre o endereço da loja nas configurações." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const storeGeo = await geocode(storeAddr);
      if (!storeGeo) {
        return new Response(
          JSON.stringify({ error: "Não foi possível localizar o endereço da loja." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      storeLat = storeGeo.lat;
      storeLng = storeGeo.lng;
      await supabase.from("business_config").update({ store_lat: storeLat, store_lng: storeLng }).eq("id", 1);
    }

    // Geocode the destination
    const destGeo = await geocode(destination);
    if (!destGeo) {
      return new Response(
        JSON.stringify({ error: "Não foi possível localizar o endereço informado. Verifique o CEP e número." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Route via OSRM (driving)
    const route = await routeDistance(storeLat, storeLng, destGeo.lat, destGeo.lng);
    if (!route) {
      return new Response(
        JSON.stringify({ error: "Não foi possível calcular a rota de carro." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pricePerKm = Number(config.delivery_price_per_km) || 0;
    const baseFee = Number(config.delivery_base_fee) || 0;
    const freeKm = Number(config.delivery_free_km) || 0;
    const maxKm = Number(config.delivery_max_km) || 15;

    if (route.distanceKm > maxKm) {
      return new Response(
        JSON.stringify({
          error: `Fora do raio de entrega. A distância é ${route.distanceKm.toFixed(1)} km e o máximo é ${maxKm} km.`,
          distanceKm: route.distanceKm,
          withinRange: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const chargeableKm = Math.max(0, route.distanceKm - freeKm);
    const deliveryFee = baseFee + chargeableKm * pricePerKm;

    return new Response(
      JSON.stringify({
        distanceKm: Number(route.distanceKm.toFixed(2)),
        durationMin: Math.round(route.durationMin),
        deliveryFee: Number(deliveryFee.toFixed(2)),
        withinRange: true,
        destination: destGeo.formatted,
        pricingMode: config.delivery_pricing_mode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erro interno no cálculo da rota." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
