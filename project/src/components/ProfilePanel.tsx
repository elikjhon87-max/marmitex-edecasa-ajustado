import { useState } from 'react';
import { MapPin, Home, Briefcase, Plus, Trash2, Star, Check, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const LABEL_PRESETS = [
  { key: 'Casa', icon: Home },
  { key: 'Trabalho', icon: Briefcase },
];

export function ProfilePanel({
  onPickAddress,
}: {
  onPickAddress?: (address: string) => void;
}) {
  const { profile, addresses, signOut, saveAddress, removeAddress, setDefaultAddress, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [label, setLabel] = useState('Casa');
  const [addr, setAddr] = useState('');
  const [ref, setRef] = useState('');

  if (!profile) return null;

  async function handleSaveProfile() {
    await updateProfile({ full_name: name.trim(), phone: phone.trim() });
    setEditing(false);
  }

  async function handleAddAddr() {
    if (!addr.trim()) return;
    const isFirst = addresses.length === 0;
    await saveAddress({ label: label.trim() || 'Casa', address: addr.trim(), reference: ref.trim(), is_default: isFirst });
    setAddr('');
    setRef('');
    setLabel('Casa');
    setShowAddrForm(false);
  }

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 shadow-lg space-y-3">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <div className="w-9 h-9 rounded-full bg-yellow-500 text-black flex items-center justify-center font-black">
          {(profile.full_name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-yellow-400 truncate">{profile.full_name || 'Cliente'}</p>
          <p className="text-[10px] text-zinc-500">{profile.phone || 'sem telefone'}</p>
        </div>
        <button onClick={signOut} className="text-[10px] text-zinc-500 hover:text-red-400">Sair</button>
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 focus:border-yellow-500 focus:outline-none"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefone"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 focus:border-yellow-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={handleSaveProfile} className="flex-1 bg-yellow-500 text-black font-bold py-2 rounded-lg text-xs">Salvar</button>
            <button onClick={() => setEditing(false)} className="bg-zinc-800 text-zinc-400 px-3 rounded-lg text-xs">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="text-[11px] text-zinc-400 hover:text-yellow-400 flex items-center gap-1">
          <User size={12} /> Editar perfil
        </button>
      )}

      <div className="border-t border-zinc-800 pt-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5">
            <MapPin size={13} /> Meus Endereços
          </h3>
          <button onClick={() => setShowAddrForm(!showAddrForm)} className="text-[10px] text-yellow-400 flex items-center gap-1">
            <Plus size={12} /> Novo
          </button>
        </div>

        {showAddrForm && (
          <div className="bg-zinc-800/60 rounded-lg p-3 space-y-2 mb-2">
            <div className="flex gap-2">
              {LABEL_PRESETS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.key}
                    onClick={() => setLabel(p.key)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] border transition ${label === p.key ? 'bg-yellow-500/10 border-yellow-500 text-yellow-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
                  >
                    <Icon size={12} /> {p.key}
                  </button>
                );
              })}
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Outro"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-1.5 text-[11px] text-zinc-100 focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <input
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="Rua, número, bairro"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 focus:border-yellow-500 focus:outline-none"
            />
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Referência (opcional)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 focus:border-yellow-500 focus:outline-none"
            />
            <button onClick={handleAddAddr} className="w-full bg-yellow-500 text-black font-bold py-2 rounded-lg text-xs">Salvar endereço</button>
          </div>
        )}

        {addresses.length === 0 && !showAddrForm && (
          <p className="text-[11px] text-zinc-500">Nenhum endereço salvo. Toque em “Novo”.</p>
        )}

        <div className="space-y-1.5">
          {addresses.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 bg-zinc-800/50 rounded-lg p-2">
              <button
                onClick={() => onPickAddress?.(a.address)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-yellow-400">{a.label}</span>
                  {a.is_default && (
                    <span className="text-[9px] bg-yellow-500 text-black px-1.5 rounded-full flex items-center gap-0.5">
                      <Star size={9} /> Padrão
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5">{a.address}</p>
                {a.reference && <p className="text-[10px] text-zinc-500">{a.reference}</p>}
              </button>
              <div className="flex flex-col gap-1">
                {!a.is_default && (
                  <button onClick={() => setDefaultAddress(a.id)} className="text-[9px] text-zinc-500 hover:text-yellow-400 flex items-center gap-0.5">
                    <Check size={10} /> Padrão
                  </button>
                )}
                <button onClick={() => removeAddress(a.id)} className="text-[9px] text-zinc-500 hover:text-red-400 flex items-center gap-0.5">
                  <Trash2 size={10} /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
