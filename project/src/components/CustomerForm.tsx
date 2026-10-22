import { useState } from 'react';
import { User } from 'lucide-react';

export type Customer = {
  name: string;
  phone: string;
  address: string;
};

export function CustomerForm({
  customer,
  onChange,
}: {
  customer: Customer;
  onChange: (c: Customer) => void;
}) {
  const [touched, setTouched] = useState(false);
  const update = (patch: Partial<Customer>) => onChange({ ...customer, ...patch });

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 shadow-lg space-y-3">
      <div className="flex items-center space-x-2 border-b border-zinc-800 pb-2">
        <User className="text-yellow-400" size={18} />
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Seus Dados para Entrega</h2>
      </div>
      <div className="space-y-2">
        <input
          type="text"
          placeholder="Seu Nome Completo *"
          value={customer.name}
          onChange={(e) => update({ name: e.target.value })}
          onBlur={() => setTouched(true)}
          className={`w-full bg-zinc-800 border rounded-lg p-2.5 text-xs text-zinc-100 focus:outline-none transition ${
            touched && !customer.name ? 'border-red-500' : 'border-zinc-700 focus:border-yellow-400'
          }`}
        />
        <input
          type="text"
          placeholder="Telefone / WhatsApp *"
          value={customer.phone}
          onChange={(e) => update({ phone: e.target.value })}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-100 focus:border-yellow-400 focus:outline-none"
        />
        <input
          type="text"
          placeholder="Endereço de Entrega (Rua, Número, Bairro) *"
          value={customer.address}
          onChange={(e) => update({ address: e.target.value })}
          onBlur={() => setTouched(true)}
          className={`w-full bg-zinc-800 border rounded-lg p-2.5 text-xs text-zinc-100 focus:outline-none transition ${
            touched && !customer.address ? 'border-red-500' : 'border-zinc-700 focus:border-yellow-400'
          }`}
        />
      </div>
    </div>
  );
}
