import { useEffect, useRef, useState } from 'react';
import { Loader2, KeyRound, CheckCircle2, AlertCircle, X, Clock, ChefHat, Bike, Home } from 'lucide-react';
import { supabase, type OrderLog } from '@/lib/supabase';

type DeliveryStatus = 'recebido' | 'preparando' | 'a_caminho' | 'entregue' | 'cancelado';

const STATUS_FLOW: { key: DeliveryStatus; label: string; icon: typeof Loader2; desc: string }[] = [
  { key: 'recebido', label: 'Pedido recebido', icon: CheckCircle2, desc: 'Confirmamos seu pedido na cozinha.' },
  { key: 'preparando', label: 'Em preparação', icon: ChefHat, desc: 'Sua marmita está sendo preparada agora.' },
  { key: 'a_caminho', label: 'A caminho', icon: Bike, desc: 'O entregador saiu com seu pedido.' },
  { key: 'entregue', label: 'Entregue', icon: Home, desc: 'Pedido entregue. Bom apetite!' },
];

export function OrderTracker({ order }: { order: OrderLog }) {
  const [current, setCurrent] = useState<DeliveryStatus>((order.delivery_status as DeliveryStatus) ?? 'recebido');
  const [updatedAt, setUpdatedAt] = useState<string>(order.confirmed_at ?? order.created_at);
  const [pinInput, setPinInput] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevStatusRef = useRef<DeliveryStatus>(current);

  useEffect(() => {
    void poll();
    const channel = supabase
      .channel(`order-${order.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders_log', filter: `id=eq.${order.id}` },
        (payload) => {
          const updated = payload.new as OrderLog;
          const newStatus = (updated.delivery_status as DeliveryStatus) ?? 'recebido';
          setCurrent(newStatus);
          setUpdatedAt(updated.confirmed_at ?? updated.created_at);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id]);

  // Polling fallback a cada 8s (caso realtime não chegue).
  async function poll() {
    const { data } = await supabase
      .from('orders_log')
      .select('delivery_status, confirmed_at, created_at')
      .eq('id', order.id)
      .maybeSingle();
    if (data) {
      const newStatus = (data.delivery_status as DeliveryStatus) ?? 'recebido';
      setCurrent(newStatus);
      setUpdatedAt(data.confirmed_at ?? data.created_at);
    }
  }

  useEffect(() => {
    const interval = setInterval(() => { void poll(); }, 8000);
    return () => clearInterval(interval);
  }, [order.id]);

  // Toca som quando o status muda (exceto na carga inicial).
  useEffect(() => {
    if (prevStatusRef.current !== current) {
      playStatusSound(current);
      prevStatusRef.current = current;
    }
  }, [current]);

  function playStatusSound(status: DeliveryStatus) {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();
      // Sequência diferente por status.
      const freqs = status === 'entregue' ? [660, 880, 1100] : status === 'a_caminho' ? [740, 990] : [880, 880];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + i * 0.22 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.22);
        osc.stop(ctx.currentTime + i * 0.22 + 0.2);
      });
      // Notificação do navegador se permitida.
      if ('Notification' in window && Notification.permission === 'granted') {
        const step = STATUS_FLOW.find((s) => s.key === status);
        if (step) {
          new Notification('Marmitex É De Casa', { body: step.label });
        }
      }
    } catch {
      // ignora
    }
  }

  const steps = STATUS_FLOW;
  const currentIndex = steps.findIndex((s) => s.key === current);
  const isDelivered = current === 'entregue';
  const isCancelled = current === 'cancelado';

  async function confirmPin() {
    if (pinInput.length !== 4) {
      setResult({ ok: false, msg: 'Digite os 4 dígitos do PIN.' });
      return;
    }
    setConfirming(true);
    const { data } = await supabase
      .from('orders_log')
      .select('delivery_pin')
      .eq('id', order.id)
      .maybeSingle();
    setConfirming(false);
    if (!data) {
      setResult({ ok: false, msg: 'Pedido não encontrado.' });
      return;
    }
    const expected = String(data.delivery_pin ?? '');
    if (expected && pinInput === expected) {
      await supabase
        .from('orders_log')
        .update({ delivery_status: 'entregue', confirmed_at: new Date().toISOString() })
        .eq('id', order.id);
      setCurrent('entregue');
      setResult({ ok: true, msg: 'PIN confirmado! Pedido entregue.' });
    } else {
      setResult({ ok: false, msg: 'PIN incorreto. Tente novamente.' });
    }
  }

  function formatTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5">
          <KeyRound size={14} /> Acompanhar pedido
        </h3>
        <span className="text-[9px] text-zinc-500 flex items-center gap-1">
          <Clock size={10} /> Atualizado {formatTime(updatedAt)}
        </span>
      </div>

      {order.delivery_pin && (
        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-zinc-400 uppercase">Seu PIN de entrega</p>
          <p className="text-2xl font-black tracking-[0.4em] text-yellow-400">{order.delivery_pin}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">Apresente ao motoboy ou funcionário na retirada.</p>
        </div>
      )}

      {isCancelled ? (
        <div className="text-center text-red-400 text-sm py-2">Pedido cancelado.</div>
      ) : (
        <div className="space-y-1">
          {steps.map((step, idx) => {
            const done = idx <= currentIndex;
            const active = idx === currentIndex;
            const Icon = step.icon;
            return (
              <div key={step.key}>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition ${done ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-zinc-800 border-zinc-700 text-zinc-600'}`}
                  >
                    <Icon size={15} className={active && !isDelivered ? 'animate-pulse' : ''} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${done ? 'text-yellow-400' : 'text-zinc-600'}`}>{step.label}</p>
                    <p className={`text-[10px] ${done ? 'text-zinc-400' : 'text-zinc-700'}`}>{step.desc}</p>
                  </div>
                  {active && !isDelivered && (
                    <span className="text-[9px] text-yellow-400 font-bold uppercase animate-pulse shrink-0">agora</span>
                  )}
                  {done && !active && (
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div className={`ml-4 h-4 w-0.5 ${idx < currentIndex ? 'bg-yellow-500/50' : 'bg-zinc-800'}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isDelivered && !isCancelled && (
        <div className="border-t border-zinc-800 pt-3">
          <p className="text-[10px] text-zinc-400 mb-1.5">Recebeu seu pedido? Confirme com o PIN:</p>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-center text-sm tracking-[0.4em] text-zinc-100 focus:border-yellow-500 focus:outline-none"
            />
            <button
              onClick={confirmPin}
              disabled={confirming}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {confirming ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Confirmar entrega
            </button>
          </div>
          {result && (
            <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {result.msg}
              {result.ok && <button onClick={() => setResult(null)} className="ml-auto text-zinc-500"><X size={12} /></button>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
