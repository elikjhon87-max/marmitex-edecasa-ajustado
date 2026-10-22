import { ShoppingBag, ChevronUp } from 'lucide-react';
import { formatBRL } from '@/lib/supabase';

export function CartBar({
  itemCount,
  total,
  onOpen,
}: {
  itemCount: number;
  total: number;
  onOpen: () => void;
}) {
  if (itemCount === 0) return null;
  return (
    <button
      onClick={onOpen}
      className="fixed bottom-14 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1rem)] max-w-md bg-yellow-500 text-black rounded-xl shadow-2xl p-3 flex items-center justify-between gap-3 transition active:scale-[0.98] border-2 border-yellow-300"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative shrink-0">
          <ShoppingBag size={22} />
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {itemCount}
          </span>
        </div>
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase leading-none">Carrinho</p>
          <p className="text-sm font-black leading-tight">R$ {formatBRL(total)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 text-xs font-bold uppercase">
        Ver carrinho <ChevronUp size={16} />
      </div>
    </button>
  );
}
