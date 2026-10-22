import { supabase } from '@/lib/supabase';

export type RouteResult = {
  distanceKm: number;
  durationMin: number;
  deliveryFee: number;
  withinRange: boolean;
  destination: string;
  pricingMode: string;
} | {
  error: string;
  withinRange: false;
  distanceKm?: number;
};

export async function calculateDeliveryRoute(destination: string): Promise<RouteResult> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delivery-route`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  };

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ destination }),
    });
  } catch {
    return { error: 'Não foi possível conectar ao serviço de rotas.', withinRange: false };
  }

  if (!response.ok) {
    let message = `Falha ao calcular rota (${response.status}).`;
    try {
      const body = await response.json();
      if (body && typeof body.error === 'string') message = body.error;
    } catch { /* keep default */ }
    return { error: message, withinRange: false };
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    return { error: 'Resposta inválida do serviço de rotas.', withinRange: false };
  }

  if (typeof data.error === 'string' && data.withinRange !== true) {
    return {
      error: data.error,
      withinRange: false,
      distanceKm: typeof data.distanceKm === 'number' ? data.distanceKm : undefined,
    };
  }

  if (
    typeof data.distanceKm !== 'number' ||
    typeof data.deliveryFee !== 'number' ||
    typeof data.durationMin !== 'number'
  ) {
    return { error: 'Resposta incompleta do serviço de rotas.', withinRange: false };
  }

  return {
    distanceKm: data.distanceKm as number,
    durationMin: data.durationMin as number,
    deliveryFee: data.deliveryFee as number,
    withinRange: true,
    destination: (data.destination as string) ?? '',
    pricingMode: (data.pricingMode as string) ?? 'distance',
  };
}

export type BatchRouteResult = {
  totalDistanceKm: number;
  totalDurationMin: number;
  totalEarnings: number;
  orderCount: number;
  withinBatch: boolean;
  batchRadiusKm: number;
  optimizedOrder: { orderId: string; address: string; sequence: number }[];
  perOrderEarnings: { orderId: string; earnings: number }[];
} | { error: string };

export async function calculateBatchRoute(
  orderIds: string[],
  destinationAddresses: string[],
): Promise<BatchRouteResult> {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/driver-route-batch`;
  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ orderIds, destinationAddresses }),
    });
  } catch {
    return { error: 'Não foi possível conectar ao serviço de rotas.' };
  }

  if (!response.ok) {
    let message = `Falha ao calcular rota (${response.status}).`;
    try {
      const body = await response.json();
      if (body && typeof body.error === 'string') message = body.error;
    } catch { /* keep default */ }
    return { error: message };
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    return { error: 'Resposta inválida do serviço de rotas.' };
  }

  if (typeof data.error === 'string') return { error: data.error };

  return {
    totalDistanceKm: data.totalDistanceKm as number,
    totalDurationMin: data.totalDurationMin as number,
    totalEarnings: data.totalEarnings as number,
    orderCount: data.orderCount as number,
    withinBatch: data.withinBatch as boolean,
    batchRadiusKm: data.batchRadiusKm as number,
    optimizedOrder: data.optimizedOrder as { orderId: string; address: string; sequence: number }[],
    perOrderEarnings: data.perOrderEarnings as { orderId: string; earnings: number }[],
  };
}
