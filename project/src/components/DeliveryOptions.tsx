import { useState } from 'react';
import { MapPin, Bike, Clock, Navigation, CalendarClock, Loader2, Route, AlertCircle } from 'lucide-react';
import { type DeliveryZone, type BusinessConfig } from '@/lib/supabase';
import { calculateDeliveryRoute } from '@/lib/deliveryRoute';

export type DeliveryChoice = {
  zoneId: string;
  needsMotoboy: boolean;
  pickup: boolean;
  scheduleMode: 'now' | 'scheduled';
  scheduledFor: string;
  destinationAddress: string;
  calculatedFee: number | null;
  distanceKm: number | null;
  durationMin: number | null;
  routeError: string;
};

const DEFAULT_CHOICE: Pick<DeliveryChoice, 'scheduleMode' | 'scheduledFor' | 'destinationAddress' | 'calculatedFee' | 'distanceKm' | 'durationMin' | 'routeError'> = {
  scheduleMode: 'now',
  scheduledFor: '',
  destinationAddress: '',
  calculatedFee: null,
  distanceKm: null,
  durationMin: null,
  routeError: '',
};

export function DeliveryOptions({
  zones,
  prepTimeMinutes,
  choice,
  onChange,
  config,
  customerAddress,
}: {
  zones: DeliveryZone[];
  prepTimeMinutes: number;
  choice: DeliveryChoice;
  onChange: (c: DeliveryChoice) => void;
  config?: BusinessConfig | null;
  customerAddress?: string;
}) {
  const [touched, setTouched] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const update = (patch: Partial<DeliveryChoice>) => onChange({ ...choice, ...patch });
  const visibleZones = zones.filter((z) => z.active);
  const selectedZone = visibleZones.find((z) => z.id === choice.zoneId) ?? visibleZones[0];

  const pricingMode = config?.delivery_pricing_mode ?? 'fixed';
  const isDistanceMode = pricingMode === 'distance' && !choice.pickup;

  const totalMinutes = isDistanceMode
    ? prepTimeMinutes + (choice.durationMin ?? 0)
    : (selectedZone?.estimated_minutes ?? 0) + (choice.pickup ? 0 : prepTimeMinutes);
  const readyLabel = estimateLabel(totalMinutes);

  const fixedFee = choice.pickup ? 0 : Number(selectedZone?.delivery_fee ?? 0);
  const fee = choice.pickup ? 0 : isDistanceMode ? (choice.calculatedFee ?? 0) : fixedFee;

  const scheduleChoices = buildScheduleChoices(choice.pickup);

  async function handleCalculate() {
    const address = choice.destinationAddress.trim() || customerAddress?.trim() || '';
    if (!address) {
      update({ routeError: 'Digite o endereço de entrega.', calculatedFee: null, distanceKm: null, durationMin: null });
      return;
    }
    setCalculating(true);
    update({ routeError: '' });
    const result = await calculateDeliveryRoute(address);
    setCalculating(false);
    if ('error' in result) {
      update({ routeError: result.error, calculatedFee: null, distanceKm: result.distanceKm ?? null, durationMin: null });
      return;
    }
    update({
      calculatedFee: result.deliveryFee,
      distanceKm: result.distanceKm,
      durationMin: result.durationMin,
      routeError: '',
    });
  }

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 shadow-lg space-y-3">
      <div className="flex items-center space-x-2 border-b border-zinc-800 pb-2">
        <Navigation className="text-yellow-400" size={18} />
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Entrega ou Retirada</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => update({ pickup: false })}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition ${
            !choice.pickup ? 'bg-yellow-500/10 border-yellow-500 text-yellow-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
          }`}
        >
          <Bike size={18} />
          <span className="text-[10px] font-bold uppercase">Entrega</span>
        </button>
        <button
          onClick={() => update({ pickup: true, needsMotoboy: false })}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition ${
            choice.pickup ? 'bg-yellow-500/10 border-yellow-500 text-yellow-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
          }`}
        >
          <MapPin size={18} />
          <span className="text-[10px] font-bold uppercase">Retirar no local</span>
        </button>
      </div>

      {!choice.pickup && pricingMode === 'fixed' && (
        <>
          <div>
            <label className="text-xs font-bold text-yellow-400 block mb-1">Escolha sua região:</label>
            <select
              value={selectedZone?.id ?? ''}
              onChange={(e) => update({ zoneId: e.target.value })}
              onBlur={() => setTouched(true)}
              className={`w-full bg-zinc-800 border rounded-lg p-2.5 text-xs text-zinc-100 focus:outline-none transition ${
                touched && !selectedZone ? 'border-red-500' : 'border-zinc-700 focus:border-yellow-400'
              }`}
            >
              {visibleZones.length === 0 && <option value="">Nenhuma região cadastrada</option>}
              {visibleZones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} — R$ {Number(zone.delivery_fee).toFixed(2)} ({zone.estimated_minutes} min)
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center justify-between gap-3 bg-zinc-800 rounded-lg p-2.5 cursor-pointer">
            <span className="flex items-center gap-2 text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={choice.needsMotoboy}
                onChange={(e) => update({ needsMotoboy: e.target.checked })}
                className="accent-yellow-500"
              />
              <Bike size={14} className="text-yellow-400" />
              Solicitar motoboy para entregar
            </span>
            <span className="text-[10px] text-zinc-500">+ taxa do app</span>
          </label>
        </>
      )}

      {!choice.pickup && isDistanceMode && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-yellow-400 block">Endereço de entrega:</label>
          <input
            type="text"
            value={choice.destinationAddress || customerAddress || ''}
            onChange={(e) => update({ destinationAddress: e.target.value, calculatedFee: null, distanceKm: null, durationMin: null, routeError: '' })}
            placeholder="Rua, número, bairro — ex: Rua das Flores, 123, Centro"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-100 focus:border-yellow-400 focus:outline-none"
          />
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
          >
            {calculating ? <Loader2 size={13} className="animate-spin" /> : <Route size={13} />}
            {calculating ? 'Calculando rota...' : 'Calcular taxa por distância'}
          </button>

          {choice.routeError && (
            <div className="bg-red-600/10 border border-red-600 rounded-lg p-2.5 flex items-start gap-2">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{choice.routeError}</p>
            </div>
          )}

          {choice.calculatedFee !== null && choice.distanceKm !== null && (
            <div className="bg-emerald-600/10 border border-emerald-600 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Route size={13} className="text-emerald-400" />
                  Distância de carro:
                </span>
                <span className="font-bold text-emerald-300">{choice.distanceKm.toFixed(1)} km</span>
              </div>
              {choice.durationMin !== null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Clock size={13} className="text-emerald-400" />
                    Tempo de viagem:
                  </span>
                  <span className="font-bold text-emerald-300">~{Math.round(choice.durationMin)} min</span>
                </div>
              )}
              <div className="border-t border-emerald-700 pt-1.5 flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-bold">Taxa de entrega:</span>
                <span className="font-black text-amber-400">R$ {choice.calculatedFee.toFixed(2)}</span>
              </div>
            </div>
          )}

          <label className="flex items-center justify-between gap-3 bg-zinc-800 rounded-lg p-2.5 cursor-pointer">
            <span className="flex items-center gap-2 text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={choice.needsMotoboy}
                onChange={(e) => update({ needsMotoboy: e.target.checked })}
                className="accent-yellow-500"
              />
              <Bike size={14} className="text-yellow-400" />
              Solicitar motoboy para entregar
            </span>
            <span className="text-[10px] text-zinc-500">+ taxa do app</span>
          </label>
        </div>
      )}

      <div className="bg-zinc-800/40 rounded-lg p-2.5 space-y-2 border border-zinc-700">
        <span className="text-[10px] font-bold text-zinc-400 uppercase flex items-center gap-1.5">
          <CalendarClock size={12} className="text-yellow-400" /> Quando você quer receber?
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => update({ scheduleMode: 'now' })}
            className={`p-2.5 rounded-lg border-2 text-center transition ${
              choice.scheduleMode === 'now'
                ? 'bg-yellow-500/10 border-yellow-500 text-yellow-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            <span className="text-[10px] font-bold uppercase block">O mais rápido</span>
            <span className="text-[9px] text-zinc-500">Hoje, assim que ficar pronto</span>
          </button>
          <button
            onClick={() => update({ scheduleMode: 'scheduled' })}
            className={`p-2.5 rounded-lg border-2 text-center transition ${
              choice.scheduleMode === 'scheduled'
                ? 'bg-yellow-500/10 border-yellow-500 text-yellow-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            <span className="text-[10px] font-bold uppercase block">Agendar horário</span>
            <span className="text-[9px] text-zinc-500">Escolha a hora exata</span>
          </button>
        </div>
        {choice.scheduleMode === 'scheduled' && (
          <div className="space-y-1.5">
            <select
              value={choice.scheduledFor}
              onChange={(e) => update({ scheduledFor: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 focus:border-yellow-400 focus:outline-none"
            >
              <option value="">Escolha um horário</option>
              {scheduleChoices.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-[9px] text-zinc-500">Pedidos agendados aparecem para a loja com o horário marcado.</p>
          </div>
        )}
      </div>

      {!isDistanceMode && selectedZone && choice.scheduleMode === 'now' && (
        <div className="bg-zinc-800/60 rounded-lg p-3 space-y-1.5 border border-zinc-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Clock size={13} className="text-yellow-400" />
              Tempo estimado de preparo:
            </span>
            <span className="font-bold text-zinc-200">{prepTimeMinutes} min</span>
          </div>
          {!choice.pickup && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <Bike size={13} className="text-yellow-400" />
                Tempo de entrega ({selectedZone.name}):
              </span>
              <span className="font-bold text-zinc-200">{selectedZone.estimated_minutes} min</span>
            </div>
          )}
          <div className="border-t border-zinc-700 pt-1.5 flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-bold">Pronto aproximadamente em:</span>
            <span className="font-black text-emerald-400">{readyLabel}</span>
          </div>
          {!choice.pickup && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Taxa de entrega:</span>
              <span className="font-bold text-amber-400">R$ {fee.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {isDistanceMode && choice.calculatedFee !== null && choice.scheduleMode === 'now' && (
        <div className="bg-zinc-800/60 rounded-lg p-3 space-y-1.5 border border-zinc-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Clock size={13} className="text-yellow-400" />
              Tempo de preparo:
            </span>
            <span className="font-bold text-zinc-200">{prepTimeMinutes} min</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Bike size={13} className="text-yellow-400" />
              Tempo de viagem:
            </span>
            <span className="font-bold text-zinc-200">~{Math.round(choice.durationMin ?? 0)} min</span>
          </div>
          <div className="border-t border-zinc-700 pt-1.5 flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-bold">Pronto aproximadamente em:</span>
            <span className="font-black text-emerald-400">{readyLabel}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Taxa de entrega ({choice.distanceKm?.toFixed(1)} km):</span>
            <span className="font-bold text-amber-400">R$ {fee.toFixed(2)}</span>
          </div>
        </div>
      )}

      {choice.scheduleMode === 'scheduled' && choice.scheduledFor && (
        <div className="bg-emerald-600/10 border border-emerald-600 rounded-lg p-3 text-center">
          <p className="text-xs text-emerald-300 font-bold flex items-center justify-center gap-1.5">
            <CalendarClock size={14} /> Pedido agendado para {formatScheduled(choice.scheduledFor)}
          </p>
        </div>
      )}
    </div>
  );
}

function buildScheduleChoices(_pickup: boolean): { value: string; label: string }[] {
  const choices: { value: string; label: string }[] = [];
  const now = new Date();
  for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
    const base = new Date(now);
    base.setDate(base.getDate() + dayOffset);
    base.setMinutes(0, 0, 0);
    const startHour = dayOffset === 0 ? Math.max(now.getHours() + 1, 11) : 11;
    const endHour = 23;
    for (let h = startHour; h <= endHour; h++) {
      const slot = new Date(base);
      slot.setHours(h, 0, 0, 0);
      const value = slot.toISOString();
      const label = `${slot.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} às ${h.toString().padStart(2, '0')}:00`;
      choices.push({ value, label });
    }
  }
  return choices;
}

function formatScheduled(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function getScheduledFor(choice: DeliveryChoice): string | null {
  if (choice.scheduleMode !== 'scheduled' || !choice.scheduledFor) return null;
  return choice.scheduledFor;
}

export function defaultDeliveryChoice(): DeliveryChoice {
  return { zoneId: '', needsMotoboy: false, pickup: false, ...DEFAULT_CHOICE };
}

function estimateLabel(totalMinutes: number): string {
  const now = new Date();
  const ready = new Date(now.getTime() + totalMinutes * 60000);
  const hh = ready.getHours().toString().padStart(2, '0');
  const mm = ready.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm} (${totalMinutes} min)`;
}
