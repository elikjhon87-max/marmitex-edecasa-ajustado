import { Phone, ChevronRight, CreditCard, ShieldCheck } from 'lucide-react';

export function OrderSummary({
  total,
  onSend,
  onPayNow,
  canPayNow,
}: {
  total: number;
  onSend: () => void;
  onPayNow?: () => void;
  canPayNow: boolean;
}) {
  return (
    <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border-2 border-yellow-500 rounded-xl p-4 shadow-2xl space-y-3">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
        <span className="text-xs text-zinc-400 font-bold uppercase">Total do Pedido:</span>
        <span className="text-2xl font-black text-yellow-400">R$ {total.toFixed(2)}</span>
      </div>

      {canPayNow && onPayNow && (
        <button
          onClick={onPayNow}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 px-4 rounded-xl text-sm flex items-center justify-center space-x-2 shadow-lg transition active:scale-95"
        >
          <CreditCard size={18} />
          <span>PAGAR AGORA NO APP</span>
          <ShieldCheck size={16} className="opacity-80" />
        </button>
      )}

      <button
        onClick={onSend}
        className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center space-x-2 border border-zinc-700 transition active:scale-95"
      >
        <Phone size={18} />
        <span>{canPayNow ? 'OU ENVIAR NO WHATSAPP' : 'ENVIAR PEDIDO NO WHATSAPP'}</span>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
