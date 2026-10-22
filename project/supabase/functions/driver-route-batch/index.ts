// Edge function: calcula rota otimizada para multi-pedido (entregador sai com vários pedidos próximos)
// e estima ganhos do entregador. Usa OSRM para roteamento de carro entre vários pontos.

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
const OSRM_URL = "https://router.project-osrm.org/trip/v1/driving";

interface GeocodeResult {
  lat: number;
  lng: number;
}

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s,áàâãéêíóôõúç-]/gi, "");
}

async function geocode(address: string): Promise<GeocodeResult | null> {
  const key = normalizeAddress(address);
  if (!key) return null;

  const { data: cached } = await supabase
    .from("geocode_cache")
    .select("lat, lng")
    .eq("address_key", key)
    .maybeSingle();

  if (cached) return { lat: cached.lat, lng: cached.lng };

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=br`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "MarmitexEdeCasa/1.0 (delivery routing)", "Accept-Language": "pt-BR" },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const result: GeocodeResult = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };

  await supabase.from("geocode_cache").insert({
    address_key: key,
    lat: result.lat,
    lng: result.lng,
    formatted_address: data[0].display_name ?? address,
  }).then(() => undefined).catch(() => undefined);

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { orderIds, destinationAddresses } = body as {
      orderIds?: string[];
      destinationAddresses?: string[];
    };

    if (!orderIds || orderIds.length === 0 || !destinationAddresses || destinationAddresses.length === 0) {
      return new Response(JSON.stringify({ error: "Forneça orderIds e destinationAddresses." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (orderIds.length !== destinationAddresses.length) {
      return new Response(JSON.stringify({ error: "orderIds e destinationAddresses devem ter o mesmo tamanho." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carregar config da loja
    const { data: config } = await supabase
      .from("business_config")
      .select("store_lat, store_lng, store_address, driver_fee_per_km, driver_fee_per_order, driver_fee_multiplier_batch, driver_batch_radius_km")
      .eq("id", 1)
      .maybeSingle();

    if (!config) {
      return new Response(JSON.stringify({ error: "Configuração da loja não encontrada." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let storeLat = config.store_lat as number | null;
    let storeLng = config.store_lng as number | null;

    if (storeLat === null || storeLng === null) {
      const storeGeo = await geocode(config.store_address || config.address || "");
      if (!storeGeo) {
        return new Response(JSON.stringify({ error: "Não foi possível localizar o endereço da loja." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      storeLat = storeGeo.lat;
      storeLng = storeGeo.lng;
      await supabase.from("business_config").update({ store_lat: storeLat, store_lng: storeLng }).eq("id", 1);
    }

    // Geocodificar todos os destinos
    const destinations: { orderId: string; lat: number; lng: number; address: string }[] = [];
    for (let i = 0; i < destinationAddresses.length; i++) {
      const geo = await geocode(destinationAddresses[i]);
      if (!geo) {
        return new Response(JSON.stringify({ error: `Não foi possível localizar o endereço: ${destinationAddresses[i]}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      destinations.push({ orderId: orderIds[i], lat: geo.lat, lng: geo.lng, address: destinationAddresses[i] });
    }

    // Verificar se os destinos estão dentro do raio de batch
    const batchRadiusKm = Number(config.driver_batch_radius_km) ?? 2.0;
    const withinBatch = checkBatchRadius(destinations, batchRadiusKm);

    // Calcular rota otimizada via OSRM Trip API
    // Começa na loja, visita todos os destinos, retorna à loja
    const coords = [
      `${storeLng},${storeLat}`,
      ...destinations.map((d) => `${d.lng},${d.lat}`),
      `${storeLng},${storeLat}`,
    ].join(";");

    const osrmUrl = `${OSRM_URL}/${coords}?overview=false&roundtrip=false&source=first&destination=last`;
    const osrmResp = await fetch(osrmUrl);
    if (!osrmResp.ok) {
      return new Response(JSON.stringify({ error: "Não foi possível calcular a rota." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const osrmData = await osrmResp.json();
    if (!osrmData.trips || osrmData.trips.length === 0) {
      return new Response(JSON.stringify({ error: "Rota não encontrada." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trip = osrmData.trips[0];
    const totalDistanceKm = trip.distance / 1000;
    const totalDurationMin = trip.duration / 60;

    // Ordem otimizada dos waypoints (excluindo loja no início e fim)
    const waypointOrder = (osrmData.waypoints ?? [])
      .filter((wp: { waypoint_index?: number }) => wp.waypoint_index != null)
      .sort((a: { waypoint_index: number }, b: { waypoint_index: number }) => a.waypoint_index - b.waypoint_index)
      .map((wp: { waypoint_index: number }) => wp.waypoint_index)
      .filter((idx: number) => idx !== 0 && idx !== destinations.length + 0)
      .slice(0, destinations.length);

    // Reordenar destinos pela ordem otimizada
    const optimizedOrder: { orderId: string; address: string; sequence: number }[] = [];
    const seenIndices = new Set<number>();
    for (const wpIdx of waypointOrder) {
      // wpIdx é o índice no array de waypoints; destinos começam em índice 1
      const destIdx = wpIdx - 1;
      if (destIdx >= 0 && destIdx < destinations.length && !seenIndices.has(destIdx)) {
        seenIndices.add(destIdx);
        optimizedOrder.push({
          orderId: destinations[destIdx].orderId,
          address: destinations[destIdx].address,
          sequence: optimizedOrder.length + 1,
        });
      }
    }
    // Se sobrou algum destino não mapeado, adicionar
    for (let i = 0; i < destinations.length; i++) {
      if (!seenIndices.has(i)) {
        optimizedOrder.push({
          orderId: destinations[i].orderId,
          address: destinations[i].address,
          sequence: optimizedOrder.length + 1,
        });
      }
    }

    // Calcular ganhos do entregador
    const feePerKm = Number(config.driver_fee_per_km) ?? 1.5;
    const feePerOrder = Number(config.driver_fee_per_order) ?? 3.0;
    const batchMultiplier = Number(config.driver_fee_multiplier_batch) ?? 0.5;

    const orderCount = destinations.length;
    let earnings = 0;
    for (let i = 0; i < orderCount; i++) {
      // Primeiro pedido paga valor cheio, subsequentes pagam multiplicado
      const multiplier = i === 0 ? 1.0 : batchMultiplier;
      earnings += feePerOrder * multiplier;
    }
    earnings += totalDistanceKm * feePerKm;

    // Ganho por pedido (dividido proporcionalmente)
    const perOrderEarnings: { orderId: string; earnings: number }[] = [];
    let remainingEarnings = earnings;
    for (let i = 0; i < optimizedOrder.length; i++) {
      const multiplier = i === 0 ? 1.0 : batchMultiplier;
      const orderFee = feePerOrder * multiplier;
      const share = i === optimizedOrder.length - 1
        ? remainingEarnings
        : orderFee + (totalDistanceKm * feePerKm) / optimizedOrder.length;
      perOrderEarnings.push({ orderId: optimizedOrder[i].orderId, earnings: Number(share.toFixed(2)) });
      remainingEarnings -= share;
    }

    return new Response(JSON.stringify({
      totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
      totalDurationMin: Math.round(totalDurationMin),
      totalEarnings: Number(earnings.toFixed(2)),
      orderCount,
      withinBatch,
      batchRadiusKm,
      optimizedOrder,
      perOrderEarnings,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? "Erro interno." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function checkBatchRadius(destinations: { lat: number; lng: number }[], radiusKm: number): boolean {
  if (destinations.length <= 1) return true;
  for (let i = 0; i < destinations.length; i++) {
    for (let j = i + 1; j < destinations.length; j++) {
      const dist = haversineKm(destinations[i].lat, destinations[i].lng, destinations[j].lat, destinations[j].lng);
      if (dist > radiusKm) return false;
    }
  }
  return true;
}
