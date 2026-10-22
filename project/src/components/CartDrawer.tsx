import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { formatBRL, type CartItem } from '@/lib/supabase';

export function CartDrawer({
  open,
  onClose,
  items,
  total,
  onIncrease,
  onDecrease,
  onRemove,
  onCheckout,
  deliveryFee,
  discount,
  finalTotal,
}: {
  
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  onIncrease: (id: string) => void;
  onDecrease: (id: string) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  deliveryFee: number;
  discount: number;
  finalTotal: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-zinc-900 border-t-2 border-yellow-500 rounded-t-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-zinc-800 shrink-0">
          <h3 className="text-sm font-bold text-yellow-400 uppercase flex items-center gap-2">
            <ShoppingBag size={16} /> Seu Carrinho ({items.length})
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {items.length === 0 && (
            <p className="text-center text-zinc-500 text-sm py-8">Carrinho vazio. Monte sua marmita e adicione aqui!</p>
          )}
          {items.map((item) => (
            <div key={item.id} className="bg-zinc-800/60 rounded-xl p-3 space-y-2 border border-zinc-700/50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-yellow-400">
                    {item.quantity}x {item.sizeName}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    {item.sizeCapacity} · {item.menuItemTitle}
                  </p>
                  <p className="text-[10px] text-zinc-300">Proteína: {item.proteinName}</p>
                  {item.extraNames.length > 0 && (
                    <p className="text-[10px] text-zinc-400">Adicionais: {item.extraNames.join(', ')}</p>
                  )}
                  {item.obs && <p className="text-[10px] text-zinc-500 italic">Obs: {item.obs}</p>}
                </div>
                <button onClick={() => onRemove(item.id)} className="text-red-500 hover:text-red-400 shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 bg-zinc-900 rounded-lg p-1 border border-zinc-700">
                  <button onClick={() => onDecrease(item.id)} className="w-7 h-7 bg-zinc-700 text-white rounded font-bold text-sm flex items-center justify-center">
                    <Minus size={13} />
                  </button>
                  <span className="text-sm font-bold px-1">{item.quantity}</span>
                  <button onClick={() => onIncrease(item.id)} className="w-7 h-7 bg-yellow-500 text-black rounded font-bold flex items-center justify-center">
                    <Plus size={13} />
                  </button>
                </div>
                <span className="text-sm font-black text-yellow-400">R$ {formatBRL(item.lineTotal)}</span>
              </div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="border-t border-zinc-800 p-3 space-y-2 shrink-0">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Subtotal dos itens</span>
              <span>R$ {formatBRL(total)}</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>Taxa de entrega</span>
                <span>R$ {formatBRL(deliveryFee)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-[11px] text-emerald-400">
                <span>Desconto</span>
                <span>- R$ {formatBRL(discount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-zinc-800">
              <span className="text-xs font-bold text-zinc-300 uppercase">Total</span>
              <span className="text-xl font-black text-yellow-400">R$ {formatBRL(finalTotal)}</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition active:scale-95"
            >
              Finalizar Pedido <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
