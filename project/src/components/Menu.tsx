import React from 'react';
import { MenuItem, BusinessSettings } from '../types';

interface MenuProps {
items: MenuItem[];
settings: BusinessSettings;
isOpen: boolean;
onAddToCart: (item: MenuItem) => void;
}

export const Menu: React.FC<MenuProps> = ({ items, settings, isOpen, onAddToCart }) => {
return (
<div className="p-4 pb-24 bg-zinc-950 text-white min-h-screen">
{!isOpen && (
<div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
<p className="text-amber-400 font-medium text-sm">
🔒 Estamos fechados no momento. Você pode navegar pelo cardápio e fazer seu pedido no próximo horário de atendimento!
</p>
<div className="mt-2 text-xs text-zinc-400">
<p>Almoço: {settings.horariosAlmoco.abre} - {settings.horariosAlmoco.fecha}</p>
<p>Janta: {settings.horariosJanta.abre} - {settings.horariosJanta.fecha}</p>
</div>
</div>
)}

<h2 className="text-xl font-bold mb-4 text-amber-400">Cardápio do Dia</h2>

<div className="grid gap-4">
{items.map((item) => (
<div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
<div>
<div className="flex justify-between items-start">
<h3 className="font-bold text-lg text-zinc-100">{item.title}</h3>
<span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-md">{item.category}</span>
</div>
<p className="text-zinc-400 text-sm mt-1">{item.description}</p>
<p className="text-emerald-400 font-bold mt-2 text-lg">R$ {item.price.toFixed(2)}</p>
</div>

<button
onClick={() => onAddToCart(item)}
  disabled={!isOpen || !item.available}
className={`mt-4 w-full py-3 px-4 rounded-xl font-bold text-base transition-all min-h-[52px] flex items-center justify-center ${
isOpen && item.available
? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-lg cursor-pointer'
: 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
}`}
>
{isOpen
? 'Loja Fechada'
: !item.available
? 'Indisponivel'
: 'Adicionar ao Carrinho'}
</button>
</div>
))}
</div>
</div>
);
};
