import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Settings, LogOut, Plus, Trash2, Edit2, Loader2, Save, X, ImagePlus,
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, MapPin, Store,
  Receipt, Utensils, ClipboardList, Wallet, BarChart3, Search, Clock, Bike, Truck, Gift, CalendarDays, ChefHat, Route, Check, UserCheck, IdCard, Camera, FileText, ShieldCheck, KeyRound, CreditCard,
} from 'lucide-react';
import {
  supabase, parseBRL, formatBRL, type MenuItem, type BusinessConfig, type MarmitaSize, type Protein, type Extra,
  type OrderLog, type ExpenseCategory, type Expense, type Supplier, type SupplierPrice, type DeliveryZone, type Coupon, type DeliveryDriver,
  WEEKDAY_KEYS, WEEKDAY_LABELS, type WeekdayKey,
} from '@/lib/supabase';
import { SupplierSearch } from '@/components/SupplierSearch';

type Option = Protein | Extra;
type OptionTable = 'proteins' | 'extras';
type AdminTab = 'loja' | 'menu' | 'orders' | 'financas' | 'fornecedores' | 'entregadores';

export function AdminPanel({
  config, menuItems, sizes, proteins, extras, deliveryZones, coupons,
  onMenuItemSaved, onSizesSaved, onProteinsSaved, onExtrasSaved,
  onConfigUpdated, onLogout, onDataRefreshed,
}: {
  config: BusinessConfig;
  menuItems: MenuItem[];
  sizes: MarmitaSize[];
  proteins: Protein[];
  extras: Extra[];
  deliveryZones: DeliveryZone[];
  coupons: Coupon[];
  onMenuItemSaved: () => void;
  onSizesSaved: () => void;
  onProteinsSaved: () => void;
  onExtrasSaved: () => void;
  onConfigUpdated: (c: BusinessConfig) => void;
  onLogout: () => void;
  onDataRefreshed: () => void;
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>('menu');

  const tabCls = (tab: AdminTab) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold uppercase transition ${
      activeTab === tab ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
    }`;

  return (
    <div className="bg-zinc-900 border-2 border-red-600 rounded-xl p-4 space-y-4">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
        <span className="text-xs font-black uppercase text-red-500 flex items-center"><Settings size={14} className="mr-1.5" /> Painel de Gestão Admin</span>
        <button onClick={onLogout} className="text-xs text-zinc-400 hover:text-white flex items-center"><LogOut size={18} className="mr-1" /> Sair</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={tabCls('loja')} onClick={() => setActiveTab('loja')}><Settings size={15} /> Loja</button>
        <button className={tabCls('menu')} onClick={() => setActiveTab('menu')}><Utensils size={15} /> Cardápio</button>
        <button className={tabCls('orders')} onClick={() => setActiveTab('orders')}><ClipboardList size={15} /> Pedidos</button>
        <button className={tabCls('financas')} onClick={() => setActiveTab('financas')}><BarChart3 size={15} /> Finanças</button>
        <button className={tabCls('fornecedores')} onClick={() => setActiveTab('fornecedores')}><Store size={15} /> Fornecedores</button>
        <button className={tabCls('entregadores')} onClick={() => setActiveTab('entregadores')}><Bike size={15} /> Entregadores</button>
      </div>

      {activeTab === 'loja' && (
        <>
          <ConfigEditor config={config} onUpdated={onConfigUpdated} />
          <DeliveryZonesEditor zones={deliveryZones} onSaved={onDataRefreshed} />
          <CouponEditor coupons={coupons} onSaved={onDataRefreshed} />
        </>
      )}

      {activeTab === 'menu' && (
        <>
          <SizeEditor sizes={sizes} onSaved={onSizesSaved} />
          <MenuEditor menuItems={menuItems} onSaved={onMenuItemSaved} />
          <MenuDaysEditor menuItems={menuItems} onSaved={onMenuItemSaved} />
          <OptionEditor table="proteins" heading="Proteínas / Misturas" items={proteins} onSaved={onProteinsSaved} />
          <OptionEditor table="extras" heading="Adicionais (refrigerante, suco...)" items={extras} onSaved={onExtrasSaved} />
        </>
      )}

      {activeTab === 'orders' && <OrdersTab onDataRefreshed={onDataRefreshed} config={config} />}
      {activeTab === 'financas' && <FinancesTab onDataRefreshed={onDataRefreshed} />}
      {activeTab === 'fornecedores' && <SuppliersTab onDataRefreshed={onDataRefreshed} />}
      {activeTab === 'entregadores' && <DriversEditor onSaved={onDataRefreshed} />}
    </div>
  );
}

// ===== CONFIG EDITOR =====

function ConfigEditor({ config, onUpdated }: { config: BusinessConfig; onUpdated: (c: BusinessConfig) => void }) {
  const [form, setForm] = useState(() => ({
...config,
lunch_open_hours: config?.lunch_open_hours || '11:00',
lunch_close_hours: config?.lunch_close_hours || '15:00',
open_hours: config?.open_hours || '18:00',
close_hours: config?.close_hours || '23:00',
}));
const [saving, setSaving] = useState(false);  
const [savedFlash, setSavedFlash] = useState(false);
useEffect(() => {
if (config) {
setForm(prev => ({
...prev,
...config,
primary_phone: config.primary_phone ?? prev.primary_phone ?? '',
secondary_phone: config.secondary_phone ?? prev.secondary_phone ?? '',
address: config.address ?? prev.address ?? '',
hours: config.hours ?? prev.hours ?? '',
instagram: config.instagram ?? prev.instagram ?? '',
pix_key: config.pix_key ?? prev.pix_key ?? '',
pix_key_type: config.pix_key_type ?? prev.pix_key_type ?? 'celular',
lunch_open_hours: config.lunch_open_hours ?? prev.lunch_open_hours ?? '11:00',
lunch_close_hours: config.lunch_close_hours ?? prev.lunch_close_hours ?? '15:00',
open_hours: config.open_hours ?? prev.open_hours ?? '18:00',
close_hours: config.close_hours ?? prev.close_hours ?? '23:00',
}));
}
}, [config]);

  async function save() {
setSaving(true);
try {
const { data, error } = await supabase
.from('business_config')
.update({
primary_phone: form.primary_phone,
secondary_phone: form.secondary_phone,
address: form.address,
hours: form.hours,
instagram: form.instagram,
pix_key: form.pix_key,
pix_key_type: form.pix_key_type,
prep_time_minutes: Math.max(1, Number(form.prep_time_minutes) || 30),
store_address: form.store_address,
motoboy_phone: form.motoboy_phone,
open_hours: form.open_hours || '17:00',
close_hours: form.close_hours || '19:00',
closed_days: form.closed_days || [],
lunch_open_hours: form.lunch_open_hours || '11:00',
lunch_close_hours: form.lunch_close_hours || '15:00',
kitchen_open_hours: form.kitchen_open_hours || '10:00',
kitchen_close_hours: form.kitchen_close_hours || '22:30',
prep_start_hours: form.prep_start_hours || '10:30',
delivery_start_hours: form.delivery_start_hours || '11:00',
delivery_end_hours: form.delivery_end_hours || '19:00',
})
.eq('id', config.id)
.select()
.single();

if (error) {
console.error('Erro ao salvar no supa:', error);
alert('Erro ao salvar: ' + error.message);
} else if (data) {
setForm(data);
onUpdated?.(data);
setSavedFlash(true);
setTimeout(() => setSavedFlash(false), 3000);
}
} catch (err) {
console.error('erro inesperado: ', err);
alert('Ocorreu um erro inesperado ao salvar. ');
} finally {
setSaving(false);
}
}

  const fieldCls = 'w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-yellow-400 font-mono focus:border-yellow-500 focus:outline-none';
  return <div className="space-y-2"><span className="text-xs font-bold text-zinc-400 uppercase">Dados do Negócio</span>
    <LabeledInput label="WhatsApp Principal (só números)"><input type="text" value={form.primary_phone ?? ''} onChange={(e) => setForm({ ...form, primary_phone: e.target.value })} className={fieldCls} /></LabeledInput>
    <LabeledInput label="WhatsApp Secundário (só números)"><input type="text" value={form.secondary_phone ?? ''} onChange={(e) => setForm({ ...form, secondary_phone: e.target.value })} className={fieldCls} /></LabeledInput>
    <LabeledInput label="Endereço / Região"><input type="text" value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className={fieldCls} /></LabeledInput>
    <LabeledInput label="Horário de Pedidos"><input type="text" value={form.hours ?? ''} onChange={(e) => setForm({ ...form, hours: e.target.value })} className={fieldCls} /></LabeledInput>
    <LabeledInput label="Instagram / Slogan"><input type="text" value={form.instagram ?? ''} onChange={(e) => setForm({ ...form, instagram: e.target.value })} className={fieldCls} /></LabeledInput>

    <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg p-3 space-y-2">
      <span className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1"><Clock size={12} /> Entrega e Preparo</span>
      <LabeledInput label="Tempo médio de preparo (minutos)"><input type="number" min="1" value={form.prep_time_minutes ?? 30} onChange={(e) => setForm({ ...form, prep_time_minutes: Number(e.target.value) })} className={fieldCls} placeholder="Ex: 30" /></LabeledInput>
      <LabeledInput label="Endereço da loja (retirada)"><input type="text" value={form.store_address ?? ''} onChange={(e) => setForm({ ...form, store_address: e.target.value })} className={fieldCls} placeholder="Ex: Rua das Flores, 123 - Centro" /></LabeledInput>
      <LabeledInput label="Telefone do motoboy parceiro (só números)"><input type="text" value={form.motoboy_phone ?? ''} onChange={(e) => setForm({ ...form, motoboy_phone: e.target.value })} className={fieldCls} placeholder="Ex: 31999887766" /></LabeledInput>
    </div>

    <div className="bg-blue-950/20 border border-blue-800/40 rounded-lg p-3 space-y-2">
      <span className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1"><Route size={12} /> Cálculo de Entrega por Distância</span>
      <p className="text-[9px] text-zinc-500">No modo "distância", a taxa é calculada pela rota de carro real entre a loja e o endereço do cliente. No modo "fixo", usa as regiões com taxa fixa.</p>
      <LabeledInput label="Modo de cobrança">
        <select value={form.delivery_pricing_mode ?? 'fixed'} onChange={(e) => setForm({ ...form, delivery_pricing_mode: e.target.value as 'fixed' | 'distance' })} className={fieldCls}>
          <option value="fixed">Regiões com taxa fixa</option>
          <option value="distance">Por distância (rota de carro)</option>
        </select>
      </LabeledInput>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Taxa base (R$)"><input inputMode="decimal" value={formatBRL(Number(form.delivery_base_fee ?? 5))} onChange={(e) => setForm({ ...form, delivery_base_fee: parseBRL(e.target.value) })} className={fieldCls} /></LabeledInput>
        <LabeledInput label="Preço por km (R$)"><input inputMode="decimal" value={formatBRL(Number(form.delivery_price_per_km ?? 2))} onChange={(e) => setForm({ ...form, delivery_price_per_km: parseBRL(e.target.value) })} className={fieldCls} /></LabeledInput>
        <LabeledInput label="Km grátis"><input inputMode="decimal" value={String(form.delivery_free_km ?? 0)} onChange={(e) => setForm({ ...form, delivery_free_km: Number(e.target.value) || 0 })} className={fieldCls} /></LabeledInput>
        <LabeledInput label="Distância máxima (km)"><input inputMode="decimal" value={String(form.delivery_max_km ?? 15)} onChange={(e) => setForm({ ...form, delivery_max_km: Number(e.target.value) || 15 })} className={fieldCls} /></LabeledInput>
      </div>
      {form.store_lat != null && form.store_lng != null && (
        <p className="text-[9px] text-emerald-400">Loja geocodificada: {form.store_lat.toFixed(5)}, {form.store_lng.toFixed(5)}</p>
      )}
    </div>

    <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-lg p-3 space-y-2">
      <span className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-1"><Bike size={12} /> Pagamento do Entregador</span>
      <p className="text-[9px] text-zinc-500">Quanto o entregador ganha por entrega. O primeiro pedido da rota paga o valor cheio, os seguintes pagam multiplicado.</p>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Valor por pedido (R$)"><input inputMode="decimal" value={formatBRL(Number(form.driver_fee_per_order ?? 3))} onChange={(e) => setForm({ ...form, driver_fee_per_order: parseBRL(e.target.value) })} className={fieldCls} /></LabeledInput>
        <LabeledInput label="Valor por km (R$)"><input inputMode="decimal" value={formatBRL(Number(form.driver_fee_per_km ?? 1.5))} onChange={(e) => setForm({ ...form, driver_fee_per_km: parseBRL(e.target.value) })} className={fieldCls} /></LabeledInput>
        <LabeledInput label="Multiplicador 2º+ pedido"><input inputMode="decimal" value={String(form.driver_fee_multiplier_batch ?? 0.5)} onChange={(e) => setForm({ ...form, driver_fee_multiplier_batch: Number(e.target.value) || 0.5 })} className={fieldCls} /></LabeledInput>
        <LabeledInput label="Raio para agrupar (km)"><input inputMode="decimal" value={String(form.driver_batch_radius_km ?? 2)} onChange={(e) => setForm({ ...form, driver_batch_radius_km: Number(e.target.value) || 2 })} className={fieldCls} /></LabeledInput>
      </div>
      <label className="flex items-center gap-2 text-[10px] text-zinc-300">
        <input type="checkbox" checked={form.pickup_pin_enabled ?? true} onChange={(e) => setForm({ ...form, pickup_pin_enabled: e.target.checked })} className="accent-emerald-500" />
        Exigir PIN de retirada na loja
      </label>
    </div>

    <div className="bg-amber-950/20 border border-amber-800/40 rounded-lg p-3 space-y-2">
      <span className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1"><CreditCard size={12} /> Pagamento com Cartão na Entrega</span>
      <p className="text-[9px] text-zinc-500">Cliente paga com cartão (crédito/débito) na entrega usando a maquininha. Sem API ou integração paga.</p>
      <label className="flex items-center gap-2 text-[10px] text-zinc-300">
        <input type="checkbox" checked={form.card_on_delivery_enabled ?? true} onChange={(e) => setForm({ ...form, card_on_delivery_enabled: e.target.checked })} className="accent-amber-500" />
        Oferecer cartão na entrega como opção de pagamento
      </label>
    </div>

    <div className="bg-blue-950/20 border border-blue-800/40 rounded-lg p-3 space-y-3">
<span className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1">
<Clock size={12} /> Horários de Funcionamento (Turnos)
</span>

{/* Turno 1: Almoço */}
<div>
<span className="text-[10px] font-bold text-amber-400 block mb-1">Turno 1: Almoço</span>
<div className="flex gap-2">
<LabeledInput label="Abre às">
<input
type="time"
value={form.lunch_open_hours ?? '11:00'}
onChange={(e) => setForm({ ...form, lunch_open_hours: e.target.value })}
className={fieldCls}
/>
</LabeledInput>
<LabeledInput label="Fecha às">
<input
type="time"
value={form.lunch_close_hours ?? '15:00'}
onChange={(e) => setForm({ ...form, lunch_close_hours: e.target.value })}
className={fieldCls}
/>
</LabeledInput>
</div>
</div>

{/* Turno 2: Janta */}
<div>
<span className="text-[10px] font-bold text-amber-400 block mb-1">Turno 2: Janta</span>
<div className="flex gap-2">
<LabeledInput label="Abre às">
<input
type="time"
value={form.open_hours ?? '18:00'}
onChange={(e) => setForm({ ...form, open_hours: e.target.value })}
className={fieldCls}
/>
</LabeledInput>
<LabeledInput label="Fecha às">
<input
type="time"
value={form.close_hours ?? '23:00'}
onChange={(e) => setForm({ ...form, close_hours: e.target.value })}
className={fieldCls}
/>
</LabeledInput>
</div>
</div>
</div>


    <div className="bg-orange-950/20 border border-orange-800/40 rounded-lg p-3 space-y-2">
      <span className="text-[10px] font-bold text-orange-400 uppercase flex items-center gap-1"><ChefHat size={12} /> Horários da Cozinha e Entrega</span>
      <p className="text-[9px] text-zinc-500">Controle quando a cozinha opera, quando começa a preparar e quando o entregador começa e para de entregar.</p>
      <div className="grid grid-cols-2 gap-2">
        <LabeledInput label="Cozinha abre às"><input type="time" value={form.kitchen_open_hours ?? '17:00'} onChange={(e) => setForm({ ...form, kitchen_open_hours: e.target.value })} className={fieldCls} /></LabeledInput>
        <LabeledInput label="Cozinha para às"><input type="time" value={form.kitchen_close_hours ?? '22:30'} onChange={(e) => setForm({ ...form, kitchen_close_hours: e.target.value })} className={fieldCls} /></LabeledInput>
        <LabeledInput label="Começa a preparar às"><input type="time" value={form.prep_start_hours ?? '18:00'} onChange={(e) => setForm({ ...form, prep_start_hours: e.target.value })} className={fieldCls} /></LabeledInput>
        <LabeledInput label="Entregador sai às"><input type="time" value={form.delivery_start_hours ?? '18:30'} onChange={(e) => setForm({ ...form, delivery_start_hours: e.target.value })} className={fieldCls} /></LabeledInput>
        <LabeledInput label="Entregas até às"><input type="time" value={form.delivery_end_hours ?? '23:00'} onChange={(e) => setForm({ ...form, delivery_end_hours: e.target.value })} className={fieldCls} /></LabeledInput>
      </div>
    </div>

    <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-lg p-3 space-y-2">
      <span className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-1"><Wallet size={12} /> Chave PIX para pagamentos adiantados</span>
      <LabeledInput label="Tipo da chave">
        <select value={form.pix_key_type} onChange={(e) => setForm({ ...form, pix_key_type: e.target.value })} className={fieldCls}>
          <option value="cpf">CPF</option>
          <option value="email">E-mail</option>
          <option value="telefone">Telefone</option>
          <option value="aleatoria">Chave Aleatória</option>
        </select>
      </LabeledInput>
      <LabeledInput label="Chave PIX"><input type="text" value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} className={fieldCls} placeholder="Ex: 123.456.789-00 ou email@exemplo.com" /></LabeledInput>
    </div>

    <button onClick={save} disabled={saving} className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold py-2 rounded-lg text-xs flex items-center justify-center space-x-1.5 transition">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}<span>{savedFlash ? 'Salvo!' : 'Salvar Configurações'}</span></button>
  </div>;
}

// ===== SIZE EDITOR =====

function SizeEditor({ sizes, onSaved }: { sizes: MarmitaSize[]; onSaved: () => void }) {
  const [editing, setEditing] = useState<MarmitaSize | null>(null);
  const [priceStr, setPriceStr] = useState('');
  const [saving, setSaving] = useState(false);
  function startEdit(size: MarmitaSize) { setEditing({ ...size }); setPriceStr(formatBRL(Number(size.price))); }
  async function save() {
    if (!editing || !editing.name.trim()) return;
    const price = parseBRL(priceStr);
    setSaving(true);
    await supabase.from('marmita_sizes').update({ name: editing.name, capacity: editing.capacity, price, available: editing.available }).eq('id', editing.id);
    setSaving(false); setEditing(null); setPriceStr(''); onSaved();
  }
  return <div className="space-y-2 pt-2 border-t border-zinc-800"><span className="text-xs font-bold text-yellow-400 uppercase">Preços das Marmitas</span>
    {sizes.map((size) => <div key={size.id} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-2"><div className="flex-1 min-w-0"><p className="text-xs font-bold text-yellow-400 truncate">{size.name}</p><p className="text-[10px] text-zinc-500">R$ {Number(size.price).toFixed(2)} · {size.capacity}</p></div><button onClick={() => startEdit(size)} className="text-yellow-500 hover:text-yellow-400"><Edit2 size={13} /></button></div>)}
    {editing && <div className="bg-zinc-800 rounded-lg p-3 space-y-2"><p className="text-xs font-bold text-yellow-400">Editar {editing.name}</p><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="admin-input" placeholder="Nome" /><input value={editing.capacity} onChange={(e) => setEditing({ ...editing, capacity: e.target.value })} className="admin-input" placeholder="Capacidade" /><input inputMode="decimal" value={priceStr} onChange={(e) => setPriceStr(e.target.value)} className="admin-input" placeholder="Preço (ex: 17,50)" /><label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={editing.available} onChange={(e) => setEditing({ ...editing, available: e.target.checked })} /> Disponível para clientes</label><div className="flex gap-2"><button onClick={save} disabled={saving} className="flex-1 bg-yellow-500 text-black font-bold py-2 rounded text-xs">{saving ? 'Salvando...' : 'Salvar preço'}</button><button onClick={() => { setEditing(null); setPriceStr(''); }} className="bg-zinc-700 px-3 rounded text-zinc-300"><X size={14} /></button></div></div>}
  </div>;
}

// ===== MENU EDITOR =====

function MenuEditor({ menuItems, onSaved }: { menuItems: MenuItem[]; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function resetForm() { setTitle(''); setDescription(''); setPriceStr(''); setImageUrl(null); setImageFile(null); setEditingId(null); setError(''); }
  function startEdit(item: MenuItem) { setEditingId(item.id); setTitle(item.title); setDescription(item.description); setPriceStr(formatBRL(Number(item.price))); setImageUrl(item.image_url); setImageFile(null); }
  function chooseImage(file: File | undefined) { if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Use uma imagem JPG, PNG ou WebP de até 5 MB.'); return; } setError(''); setImageFile(file); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Título é obrigatório.'); return; }
    setSaving(true); setError('');
    let nextImageUrl = imageUrl;
    if (imageFile) {
      const path = `${crypto.randomUUID()}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      const upload = await supabase.storage.from('menu-images').upload(path, imageFile, { contentType: imageFile.type, upsert: false });
      if (upload.error) { setSaving(false); setError('Não foi possível enviar a foto.'); return; }
      nextImageUrl = supabase.storage.from('menu-images').getPublicUrl(upload.data.path).data.publicUrl;
    }
    const price = parseBRL(priceStr);
    const result = editingId
      ? await supabase.from('menu_items').update({ title: title.trim(), description: description.trim(), price: Math.max(0, price), image_url: nextImageUrl }).eq('id', editingId)
      : await supabase.from('menu_items').insert({ title: title.trim(), description: description.trim(), price: Math.max(0, price), image_url: nextImageUrl, category: 'Geral' });
    setSaving(false);
    if (result.error) { setError('Não foi possível salvar o prato. Tente novamente.'); return; }
    resetForm(); onSaved();
  }
  async function remove(id: string) {
    const { error: deleteError } = await supabase.from('menu_items').delete().eq('id', id);
    if (deleteError) { setError('Não foi possível excluir o prato. Tente novamente.'); return; }
    if (editingId === id) resetForm(); onSaved();
  }
  async function toggleAvailable(item: MenuItem) {
    const { error: updateError } = await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id);
    if (updateError) { setError('Não foi possível alterar a disponibilidade. Tente novamente.'); return; }
    onSaved();
  }

  return <div className="space-y-3 pt-2 border-t border-zinc-800"><span className="text-xs font-bold text-yellow-400 uppercase">{editingId ? 'Editar Prato' : 'Adicionar Prato ao Cardápio'}</span><form onSubmit={submit} className="space-y-2"><input type="text" placeholder="Título do prato" value={title} onChange={(e) => setTitle(e.target.value)} className="admin-input" /><textarea placeholder="Acompanhamentos" value={description} onChange={(e) => setDescription(e.target.value)} className="admin-input h-16" /><label className="block space-y-1"><span className="text-[10px] font-bold text-zinc-500 uppercase">Acréscimo do prato</span><input inputMode="decimal" value={priceStr} onChange={(e) => setPriceStr(e.target.value)} className="admin-input" placeholder="Ex: 3,50" /><span className="text-[10px] text-zinc-500">Use 0,00 quando o prato não tiver acréscimo. Digite com vírgula.</span></label><label className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-zinc-300 cursor-pointer"><ImagePlus size={15} className="text-yellow-400" /><span>{imageFile ? imageFile.name : imageUrl ? 'Trocar foto do prato' : 'Adicionar foto do prato'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseImage(e.target.files?.[0])} className="hidden" /></label>{error && <p className="text-red-400 text-xs">{error}</p>}<div className="flex space-x-2"><button type="submit" disabled={saving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2 rounded text-xs flex items-center justify-center space-x-1.5">{saving ? <Loader2 size={12} className="animate-spin" /> : editingId ? <Save size={12} /> : <Plus size={12} />}<span>{saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Adicionar ao Cardápio'}</span></button>{editingId && <button type="button" onClick={resetForm} className="bg-zinc-800 text-zinc-400 py-2 px-3 rounded text-xs"><X size={12} /></button>}</div></form><div className="space-y-1.5 pt-2 border-t border-zinc-800">{menuItems.map((item) => <div key={item.id} className="flex items-start justify-between gap-2 bg-zinc-800/50 rounded-lg p-2"><div className="min-w-0 flex-1"><p className={`text-xs font-bold truncate ${item.available ? 'text-yellow-400' : 'text-zinc-500 line-through'}`}>{item.title}</p><p className="text-[10px] text-zinc-500 truncate">{item.price > 0 ? `Acréscimo R$ ${Number(item.price).toFixed(2)}` : 'Preço padrão'}</p></div><div className="flex items-center space-x-1.5 shrink-0"><button onClick={() => toggleAvailable(item)} className={`text-[9px] px-1.5 py-1 rounded font-bold uppercase ${item.available ? 'bg-emerald-600/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'}`}>{item.available ? 'Ativo' : 'Oculto'}</button><button onClick={() => startEdit(item)} className="text-yellow-500"><Edit2 size={12} /></button><button onClick={() => remove(item.id)} className="text-red-500"><Trash2 size={12} /></button></div></div>)}</div></div>;
}

// ===== OPTION EDITOR =====

function OptionEditor({ table, heading, items, onSaved }: { table: OptionTable; heading: string; items: Option[]; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function reset() { setName(''); setPriceStr(''); setImageUrl(null); setImageFile(null); setEditingId(null); setError(''); }
  function edit(item: Option) { setEditingId(item.id); setName(item.name); setPriceStr(formatBRL(Number(item.price))); setImageUrl(item.image_url ?? null); setImageFile(null); setError(''); }
  function chooseImage(file: File | undefined) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Use uma imagem JPG, PNG ou WebP de até 5 MB.'); return; }
    setError(''); setImageFile(file);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    let nextImageUrl = imageUrl;
    if (imageFile) {
      const path = `${crypto.randomUUID()}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      const upload = await supabase.storage.from('menu-images').upload(path, imageFile, { contentType: imageFile.type, upsert: false });
      if (upload.error) { setSaving(false); setError('Não foi possível enviar a foto.'); return; }
      nextImageUrl = supabase.storage.from('menu-images').getPublicUrl(upload.data.path).data.publicUrl;
    }
    const price = parseBRL(priceStr);
    const values = { name: name.trim(), price: Math.max(0, price), image_url: nextImageUrl };
    const result = editingId ? await supabase.from(table).update(values).eq('id', editingId) : await supabase.from(table).insert({ ...values, display_order: items.length + 1 });
    setSaving(false);
    if (result.error) { setError('Não foi possível salvar.'); return; }
    reset(); onSaved();
  }
  async function remove(id: string) { await supabase.from(table).delete().eq('id', id); if (editingId === id) reset(); onSaved(); }
  async function toggle(item: Option) { await supabase.from(table).update({ available: !item.available }).eq('id', item.id); onSaved(); }
  return <div className="space-y-3 pt-2 border-t border-zinc-800"><span className="text-xs font-bold text-yellow-400 uppercase">{heading}</span>
    <form onSubmit={submit} className="space-y-2 bg-zinc-800/50 rounded-lg p-2.5">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="admin-input" />
      <input inputMode="decimal" value={priceStr} onChange={(e) => setPriceStr(e.target.value)} placeholder="R$ (ex: 3,50)" className="admin-input" />
      <label className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-zinc-300 cursor-pointer">
        <ImagePlus size={15} className="text-yellow-400" />
        <span>{imageFile ? imageFile.name : imageUrl ? 'Trocar foto' : 'Adicionar foto'}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseImage(e.target.files?.[0])} className="hidden" />
      </label>
      {error && <p className="text-red-400 text-[10px]">{error}</p>}
      <div className="flex gap-2">
        <button disabled={saving} className="flex-1 bg-red-600 text-white rounded px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5">{saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {editingId ? 'Salvar' : 'Adicionar'}</button>
        {editingId && <button type="button" onClick={reset} className="bg-zinc-800 text-zinc-400 rounded px-2"><X size={14} /></button>}
      </div>
    </form>
    <div className="space-y-1.5">{items.map((item) => (
      <div key={item.id} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-2">
        {item.image_url ? <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded object-cover shrink-0" /> : <div className="w-10 h-10 rounded bg-zinc-700 shrink-0 flex items-center justify-center"><ImagePlus size={14} className="text-zinc-500" /></div>}
        <span className={`flex-1 text-xs ${item.available ? 'text-zinc-200' : 'text-zinc-500 line-through'}`}>{item.name} <strong className="text-amber-400">(+ R$ {Number(item.price).toFixed(2)})</strong></span>
        <button onClick={() => toggle(item)} className="text-[9px] text-zinc-400">{item.available ? 'Ocultar' : 'Ativar'}</button>
        <button onClick={() => edit(item)} className="text-yellow-500"><Edit2 size={12} /></button>
        <button onClick={() => remove(item.id)} className="text-red-500"><Trash2 size={12} /></button>
      </div>
    ))}</div>
  </div>;
}

// ===== DELIVERY ZONES EDITOR =====

function DeliveryZonesEditor({ zones, onSaved }: { zones: DeliveryZone[]; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [feeStr, setFeeStr] = useState('');
  const [minutes, setMinutes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() { setName(''); setFeeStr(''); setMinutes(''); setEditingId(null); }
  function edit(zone: DeliveryZone) {
    setEditingId(zone.id);
    setName(zone.name);
    setFeeStr(formatBRL(Number(zone.delivery_fee)));
    setMinutes(String(zone.estimated_minutes));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const fee = parseBRL(feeStr);
    const mins = Math.max(1, Number(minutes) || 30);
    setSaving(true);
    const values = { name: name.trim(), delivery_fee: fee, estimated_minutes: mins };
    const result = editingId
      ? await supabase.from('delivery_zones').update(values).eq('id', editingId)
      : await supabase.from('delivery_zones').insert({ ...values, active: true, display_order: zones.length + 1 });
    setSaving(false);
    if (result.error) return;
    reset();
    onSaved();
  }
  async function remove(id: string) {
    await supabase.from('delivery_zones').delete().eq('id', id);
    if (editingId === id) reset();
    onSaved();
  }
  async function toggle(zone: DeliveryZone) {
    await supabase.from('delivery_zones').update({ active: !zone.active }).eq('id', zone.id);
    onSaved();
  }

  return (
    <div className="space-y-3 pt-2 border-t border-zinc-800">
      <span className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5"><Bike size={13} /> Regiões de Entrega</span>
      <form onSubmit={submit} className="space-y-2 bg-zinc-800/50 rounded-lg p-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da região (ex: Centro)" className="admin-input" />
        <div className="flex gap-2">
          <input inputMode="decimal" value={feeStr} onChange={(e) => setFeeStr(e.target.value)} placeholder="Taxa R$ (ex: 5,00)" className="admin-input flex-1" />
          <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Min (ex: 20)" className="admin-input w-24" />
        </div>
        <div className="flex gap-2">
          <button disabled={saving} className="flex-1 bg-red-600 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-1.5">
            <Plus size={12} /> {editingId ? 'Salvar' : 'Adicionar região'}
          </button>
          {editingId && <button type="button" onClick={reset} className="bg-zinc-700 text-zinc-300 px-3 rounded"><X size={14} /></button>}
        </div>
      </form>
      <div className="space-y-1.5">
        {zones.length === 0 && <p className="text-[10px] text-zinc-500 italic">Nenhuma região cadastrada.</p>}
        {zones.map((zone) => (
          <div key={zone.id} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-2">
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${zone.active ? 'text-yellow-400' : 'text-zinc-500 line-through'}`}>{zone.name}</p>
              <p className="text-[10px] text-zinc-500">
                R$ {Number(zone.delivery_fee).toFixed(2)} · {zone.estimated_minutes} min
              </p>
            </div>
            <button onClick={() => toggle(zone)} className="text-[9px] text-zinc-400">{zone.active ? 'Ocultar' : 'Ativar'}</button>
            <button onClick={() => edit(zone)} className="text-yellow-500"><Edit2 size={12} /></button>
            <button onClick={() => remove(zone.id)} className="text-red-500"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== COUPON EDITOR =====

function CouponEditor({ coupons, onSaved }: { coupons: Coupon[]; onSaved: () => void }) {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [valueStr, setValueStr] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() { setCode(''); setDescription(''); setDiscountType('percent'); setValueStr(''); setExpiresAt(''); setEditingId(null); }
  function edit(c: Coupon) {
    setEditingId(c.id);
    setCode(c.code);
    setDescription(c.description);
    setDiscountType(c.discount_type);
    setValueStr(formatBRL(Number(c.discount_value)));
    setExpiresAt(c.expires_at ?? '');
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    const value = parseBRL(valueStr);
    setSaving(true);
    const payload = {
      code: code.trim().toUpperCase(),
      description: description.trim(),
      discount_type: discountType,
      discount_value: value,
      active: true,
      expires_at: expiresAt || null,
    };
    const result = editingId
      ? await supabase.from('coupons').update(payload).eq('id', editingId)
      : await supabase.from('coupons').insert(payload);
    setSaving(false);
    if (result.error) return;
    reset();
    onSaved();
  }
  async function remove(id: string) {
    await supabase.from('coupons').delete().eq('id', id);
    if (editingId === id) reset();
    onSaved();
  }
  async function toggle(c: Coupon) {
    await supabase.from('coupons').update({ active: !c.active }).eq('id', c.id);
    onSaved();
  }

  return (
    <div className="space-y-3 pt-2 border-t border-zinc-800">
      <span className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5"><Gift size={13} /> Cupons de Desconto</span>
      <form onSubmit={submit} className="space-y-2 bg-zinc-800/50 rounded-lg p-2.5">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código (ex: DOMINGO10)" className="admin-input" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição interna (ex: 10% off domingos)" className="admin-input" />
        <div className="flex gap-2">
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')} className="admin-input w-28">
            <option value="percent">Percentual %</option>
            <option value="fixed">Valor R$</option>
          </select>
          <input inputMode="decimal" value={valueStr} onChange={(e) => setValueStr(e.target.value)} placeholder={discountType === 'percent' ? 'Ex: 10' : 'Ex: 5,00'} className="admin-input flex-1" />
        </div>
        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="admin-input" />
        <div className="flex gap-2">
          <button disabled={saving} className="flex-1 bg-red-600 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-1.5">
            <Plus size={12} /> {editingId ? 'Salvar' : 'Criar cupom'}
          </button>
          {editingId && <button type="button" onClick={reset} className="bg-zinc-700 text-zinc-300 px-3 rounded"><X size={14} /></button>}
        </div>
      </form>
      <div className="space-y-1.5">
        {coupons.length === 0 && <p className="text-[10px] text-zinc-500 italic">Nenhum cupom cadastrado.</p>}
        {coupons.map((c) => (
          <div key={c.id} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-2">
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${c.active ? 'text-yellow-400' : 'text-zinc-500 line-through'}`}>{c.code}</p>
              <p className="text-[10px] text-zinc-500">
                {c.discount_type === 'percent' ? `${formatBRL(Number(c.discount_value))}% off` : `R$ ${Number(c.discount_value).toFixed(2)} off`}
                {c.expires_at && ` · expira ${new Date(c.expires_at).toLocaleDateString('pt-BR')}`}
              </p>
            </div>
            <button onClick={() => toggle(c)} className="text-[9px] text-zinc-400">{c.active ? 'Desativar' : 'Ativar'}</button>
            <button onClick={() => edit(c)} className="text-yellow-500"><Edit2 size={12} /></button>
            <button onClick={() => remove(c.id)} className="text-red-500"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== MENU DAYS EDITOR =====

function MenuDaysEditor({ menuItems, onSaved }: { menuItems: MenuItem[]; onSaved: () => void }) {
  const todayKey: WeekdayKey = WEEKDAY_KEYS[(new Date().getDay() + 6) % 7];
  return (
    <div className="space-y-2 pt-2 border-t border-zinc-800">
      <span className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5"><CalendarDays size={13} /> Cardápio por Dia da Semana</span>
      <p className="text-[10px] text-zinc-500">Marque os dias em que cada prato fica disponível. Se nenhum dia for marcado, o prato aparece todos os dias.</p>
      {menuItems.map((item) => (
        <div key={item.id} className="bg-zinc-800/50 rounded-lg p-2 space-y-1.5">
          <p className="text-xs font-bold text-yellow-400">{item.title}</p>
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_KEYS.map((day) => {
              const has = (item.available_days ?? []).includes(day);
              return (
                <button
                  key={day}
                  onClick={async () => {
                    const next = has ? (item.available_days ?? []).filter((d) => d !== day) : [...(item.available_days ?? []), day];
                    await supabase.from('menu_items').update({ available_days: next }).eq('id', item.id);
                    onSaved();
                  }}
                  className={`text-[9px] px-2 py-1 rounded font-bold uppercase transition ${has ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-600' : 'bg-zinc-700 text-zinc-400 border border-zinc-600'} ${day === todayKey ? 'ring-1 ring-yellow-500' : ''}`}
                >
                  {WEEKDAY_LABELS[day].slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== ORDERS TAB =====

function OrdersTab({ onDataRefreshed, config }: { onDataRefreshed: () => void; config: BusinessConfig }) {
  const [orders, setOrders] = useState<OrderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'enviado' | 'confirmado' | 'entregue' | 'cancelado'>('all');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('orders_log').select('*').order('created_at', { ascending: false }).limit(100);
    setOrders((data ?? []) as OrderLog[]);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const deliveryMap: Record<string, string> = {
      enviado: 'recebido',
      confirmado: 'preparando',
      entregue: 'entregue',
      cancelado: 'cancelado',
    };
    const deliveryStatus = deliveryMap[status] ?? 'recebido';
    await supabase.from('orders_log').update({ status, delivery_status: deliveryStatus }).eq('id', id);

    // Notify customer via push + in-app.
    const { data: order } = await supabase.from('orders_log').select('*').eq('id', id).maybeSingle();
    if (order) {
      const ord = order as OrderLog;
      if (ord.customer_user_id) {
        await supabase.from('app_notifications').insert({
          target: 'customer',
          user_id: ord.customer_user_id,
          kind: 'status_update',
          payload: { order_id: id, delivery_status: deliveryStatus },
        });
      }
      // Also send push directly via edge function.
      try {
        await supabase.functions.invoke('send-push', {
          body: {
            target_user_id: ord.customer_user_id,
            is_store: false,
            title: 'Atualização do Pedido',
            body: deliveryStatus === 'preparando' ? 'Seu pedido entrou em preparação!'
              : deliveryStatus === 'a_caminho' ? 'Seu pedido saiu para entrega!'
              : deliveryStatus === 'entregue' ? 'Pedido entregue. Obrigado!'
              : deliveryStatus === 'cancelado' ? 'Pedido cancelado.'
              : 'Atualização no seu pedido.',
            kind: 'status_update',
            delivery_status: deliveryStatus,
            order_id: id,
          },
        });
      } catch { /* ignore push errors */ }
    }
    void load();
  }

  async function deleteOrder(id: string) {
    await supabase.from('orders_log').delete().eq('id', id);
    void load();
  }

  function callMotoboy(order: OrderLog) {
    const motoboyPhone = (config.motoboy_phone ?? '').replace(/\D/g, '');
    if (!motoboyPhone) { alert('Cadastre o telefone do motoboy nas configurações do negócio.'); return; }
    const pickup = config.store_address || config.address || 'Retirar na loja';
    const lines = [
      '*--- ENTREGA: MARMITEX É DE CASA ---*', '',
      '*Pedido pronto para retirar!*', '',
      `*Retirada:* ${pickup}`,
      `*Entregar para:* ${order.customer_name}`,
      `*Endereço:* ${order.customer_address}`,
      `*Telefone do cliente:* ${order.customer_phone}`,
      `*Região:* ${order.delivery_zone || 'Não informada'}`,
    ];
    if (order.estimated_ready_at) lines.push(`*Pronto às:* ${order.estimated_ready_at}`);
    lines.push('', `*Itens:* ${order.items_summary}`, `*Total:* R$ ${Number(order.total).toFixed(2)}`);
    window.open(`https://wa.me/55${motoboyPhone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  }

  function notifyCustomer(order: OrderLog) {
    const phone = (order.customer_phone ?? '').replace(/\D/g, '');
    if (!phone) { alert('Cliente não deixou telefone.'); return; }
    const msg = `*Marmitex É De Casa*\n\nOlá ${order.customer_name}! Seu pedido saiu daqui e já está a caminho! \U0001F6F5\n\nItens: ${order.items_summary}\nTotal: R$ ${Number(order.total).toFixed(2)}\n\nQualquer dúvida, é só chamar aqui. Obrigado! \u2764\uFE0F`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    void supabase.from('orders_log').update({ status: 'entregue', delivery_status: 'a_caminho' }).eq('id', order.id);
    if (order.customer_user_id) {
      void supabase.from('app_notifications').insert({
        target: 'customer',
        user_id: order.customer_user_id,
        kind: 'status_update',
        payload: { order_id: order.id, delivery_status: 'a_caminho' },
      });
    }
    void supabase.functions.invoke('send-push', {
      body: {
        target_user_id: order.customer_user_id,
        is_store: false,
        title: 'Pedido a caminho!',
        body: 'Seu pedido saiu para entrega. Prepare-se!',
        kind: 'status_update',
        delivery_status: 'a_caminho',
        order_id: order.id,
      },
    }).catch(() => undefined);
    void load();
  }

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  const statusColor: Record<string, string> = {
    enviado: 'bg-blue-600/20 text-blue-400',
    confirmado: 'bg-amber-600/20 text-amber-400',
    entregue: 'bg-emerald-600/20 text-emerald-400',
    cancelado: 'bg-red-600/20 text-red-400',
  };

  const totalRevenue = orders.filter((o) => o.status !== 'cancelado').reduce((sum, o) => sum + Number(o.total), 0);
  const paidCount = orders.filter((o) => o.paid).length;

  return (
    <div className="space-y-3 pt-2 border-t border-zinc-800">
      <span className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5"><ClipboardList size={13} /> Pedidos Recebidos</span>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total" value={`${orders.length}`} icon={<ShoppingBag size={14} />} />
        <StatCard label="Faturado" value={`R$ ${totalRevenue.toFixed(2)}`} icon={<DollarSign size={14} />} color="emerald" />
        <StatCard label="Pagos" value={`${paidCount}`} icon={<TrendingUp size={14} />} color="blue" />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(['all', 'enviado', 'confirmado', 'entregue', 'cancelado'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase transition ${filter === f ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
            {f === 'all' ? 'Todos' : f}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-yellow-400" size={20} /></div>}

      {!loading && filtered.length === 0 && <p className="text-xs text-zinc-500 italic text-center py-6">Nenhum pedido encontrado.</p>}

      {!loading && filtered.map((order) => (
        <div key={order.id} className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-yellow-400 truncate">{order.customer_name}</p>
              <p className="text-[10px] text-zinc-500">{new Date(order.created_at).toLocaleString('pt-BR')}</p>
            </div>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${statusColor[order.status]}`}>{order.status}</span>
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">{order.items_summary}</p>
          {(order.delivery_zone || order.estimated_ready_at || order.needs_motoboy) && (
            <div className="flex flex-wrap gap-1.5">
              {order.delivery_zone && <span className="text-[9px] bg-zinc-700/60 text-zinc-300 px-1.5 py-0.5 rounded flex items-center gap-1"><MapPin size={9} /> {order.delivery_zone}</span>}
              {order.needs_motoboy && <span className="text-[9px] bg-amber-600/20 text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1"><Bike size={9} /> Motoboy solicitado</span>}
              {order.estimated_ready_at && <span className="text-[9px] bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock size={9} /> Pronto ~{order.estimated_ready_at}</span>}
              {order.pickup_pin && (
                <span className="text-[9px] bg-blue-600/20 text-blue-300 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                  <KeyRound size={9} /> PIN retirada: {order.pickup_pin}
                  {order.pickup_verified_at && <Check size={9} className="text-emerald-400" />}
                </span>
              )}
              {order.delivery_earnings && Number(order.delivery_earnings) > 0 && (
                <span className="text-[9px] bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-1"><Wallet size={9} /> Motoboy: R$ {Number(order.delivery_earnings).toFixed(2)}</span>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-emerald-400">R$ {Number(order.total).toFixed(2)}</span>
              {order.paid && <span className="text-[9px] bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">PAGO</span>}
              <span className="text-[9px] text-zinc-500 uppercase">{order.payment_method} · {order.payment_timing}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => notifyCustomer(order)} title="Avisar cliente que saiu pra entrega" className="bg-emerald-600 hover:bg-emerald-500 text-white rounded p-1 flex items-center gap-0.5 text-[9px] font-bold"><Truck size={11} /> Saiu</button>
              <button onClick={() => callMotoboy(order)} title="Chamar motoboy via WhatsApp" className="bg-amber-600 hover:bg-amber-500 text-white rounded p-1 flex items-center gap-0.5 text-[9px] font-bold"><Bike size={11} /> Moto</button>
              <select value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)} className="bg-zinc-700 text-zinc-200 text-[10px] rounded px-1.5 py-1 border border-zinc-600">
                <option value="enviado">Enviado</option>
                <option value="confirmado">Confirmado</option>
                <option value="entregue">Entregue</option>
                <option value="cancelado">Cancelado</option>
              </select>
              <button onClick={() => deleteOrder(order.id)} className="text-red-500 hover:text-red-400"><Trash2 size={12} /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== FINANCES TAB =====

function FinancesTab({ onDataRefreshed: _onDataRefreshed }: { onDataRefreshed: () => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [orders, setOrders] = useState<OrderLog[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category_id: 'ingredientes', description: '', amountStr: '', supplier_id: '', expense_date: new Date().toISOString().slice(0, 10), notes: '' });

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [expRes, catRes, ordRes, supRes] = await Promise.all([
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(50),
      supabase.from('expense_categories').select('*').order('display_order', { ascending: true }),
      supabase.from('orders_log').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('suppliers').select('*').order('name', { ascending: true }),
    ]);
    setExpenses((expRes.data ?? []) as Expense[]);
    setCategories((catRes.data ?? []) as ExpenseCategory[]);
    setOrders((ordRes.data ?? []) as OrderLog[]);
    setSuppliers((supRes.data ?? []) as Supplier[]);
    setLoading(false);
  }

  async function addExpense(e: FormEvent) {
    e.preventDefault();
    const amount = parseBRL(form.amountStr);
    if (!form.description.trim() || amount <= 0) return;
    await supabase.from('expenses').insert({
      category_id: form.category_id,
      description: form.description.trim(),
      amount,
      supplier_id: form.supplier_id || null,
      expense_date: form.expense_date,
      notes: form.notes,
    });
    setForm({ category_id: 'ingredientes', description: '', amountStr: '', supplier_id: '', expense_date: new Date().toISOString().slice(0, 10), notes: '' });
    setShowForm(false);
    void load();
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id);
    void load();
  }

  const revenue = orders.filter((o) => o.status !== 'cancelado').reduce((sum, o) => sum + Number(o.total), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const profit = revenue - totalExpenses;
  const expensesByCategory = categories.map((cat) => ({
    ...cat,
    total: expenses.filter((e) => e.category_id === cat.id).reduce((sum, e) => sum + Number(e.amount), 0),
  }));

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const supName = (id: string | null) => id ? suppliers.find((s) => s.id === id)?.name ?? '' : '';

  return (
    <div className="space-y-3 pt-2 border-t border-zinc-800">
      <span className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5"><BarChart3 size={13} /> Finanças do Negócio</span>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Receita" value={`R$ ${revenue.toFixed(2)}`} icon={<TrendingUp size={14} />} color="emerald" />
        <StatCard label="Gastos" value={`R$ ${totalExpenses.toFixed(2)}`} icon={<TrendingDown size={14} />} color="red" />
        <StatCard label="Lucro" value={`R$ ${profit.toFixed(2)}`} icon={<DollarSign size={14} />} color={profit >= 0 ? 'emerald' : 'red'} />
      </div>

      {/* Gastos por categoria */}
      <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
        <span className="text-[10px] font-bold text-zinc-400 uppercase">Gastos por Categoria</span>
        {expensesByCategory.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between text-xs">
            <span className="text-zinc-300">{cat.name}</span>
            <span className="font-bold text-amber-400">R$ {cat.total.toFixed(2)}</span>
          </div>
        ))}
        {totalExpenses === 0 && <p className="text-[10px] text-zinc-500 italic">Nenhum gasto cadastrado ainda.</p>}
      </div>

      {/* Botão adicionar gasto */}
      <button onClick={() => setShowForm(!showForm)} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition">
        <Plus size={14} /> {showForm ? 'Cancelar' : 'Adicionar Gasto'}
      </button>

      {showForm && (
        <form onSubmit={addExpense} className="bg-zinc-800 rounded-lg p-3 space-y-2">
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="admin-input">
            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
          <input placeholder="Descrição (ex: 5kg de arroz)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="admin-input" />
          <input inputMode="decimal" placeholder="Valor R$ (ex: 15,50)" value={form.amountStr} onChange={(e) => setForm({ ...form, amountStr: e.target.value })} className="admin-input" />
          <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="admin-input" />
          <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="admin-input">
            <option value="">Fornecedor (opcional)</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input placeholder="Observações (opcional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="admin-input" />
          <button type="submit" className="w-full bg-yellow-500 text-black font-bold py-2 rounded text-xs">Salvar Gasto</button>
        </form>
      )}

      {/* Lista de gastos */}
      {loading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-yellow-400" size={18} /></div>}
      {!loading && expenses.length === 0 && <p className="text-[10px] text-zinc-500 italic text-center">Nenhum gasto registrado.</p>}
      {!loading && expenses.map((exp) => (
        <div key={exp.id} className="flex items-start justify-between gap-2 bg-zinc-800/50 rounded-lg p-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-zinc-200 truncate">{exp.description}</p>
            <p className="text-[10px] text-zinc-500">
              {catName(exp.category_id)} · {new Date(exp.expense_date).toLocaleDateString('pt-BR')}
              {supName(exp.supplier_id) && ` · ${supName(exp.supplier_id)}`}
            </p>
            {exp.notes && <p className="text-[10px] text-zinc-400 mt-0.5">{exp.notes}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-red-400">- R$ {Number(exp.amount).toFixed(2)}</span>
            <button onClick={() => deleteExpense(exp.id)} className="text-red-500 hover:text-red-400"><Trash2 size={12} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== SUPPLIERS TAB =====

function SuppliersTab({ onDataRefreshed: _onDataRefreshed }: { onDataRefreshed: () => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [prices, setPrices] = useState<SupplierPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [search, setSearch] = useState('');
  const [priceForm, setPriceForm] = useState({ supplier_id: '', product_name: '', unit: 'kg', priceStr: '', notes: '' });

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [supRes, priceRes] = await Promise.all([
      supabase.from('suppliers').select('*').order('name', { ascending: true }),
      supabase.from('supplier_prices').select('*').order('product_name', { ascending: true }),
    ]);
    setSuppliers((supRes.data ?? []) as Supplier[]);
    setPrices((priceRes.data ?? []) as SupplierPrice[]);
    setLoading(false);
  }

  async function addPrice(e: FormEvent) {
    e.preventDefault();
    const price = parseBRL(priceForm.priceStr);
    if (!priceForm.supplier_id || !priceForm.product_name.trim() || price <= 0) return;
    await supabase.from('supplier_prices').insert({
      supplier_id: priceForm.supplier_id,
      product_name: priceForm.product_name.trim(),
      unit: priceForm.unit,
      price,
      notes: priceForm.notes,
    });
    setPriceForm({ supplier_id: '', product_name: '', unit: 'kg', priceStr: '', notes: '' });
    setShowPriceForm(false);
    void load();
  }

  async function deletePrice(id: string) {
    await supabase.from('supplier_prices').delete().eq('id', id);
    void load();
  }

  const supName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? '—';

  // Group prices by product name to compare
  const productGroups = useMemo(() => {
    const filtered = search.trim()
      ? prices.filter((p) => p.product_name.toLowerCase().includes(search.toLowerCase()))
      : prices;
    const groups: Record<string, SupplierPrice[]> = {};
    for (const p of filtered) {
      const key = p.product_name.toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [prices, search]);

  return (
    <div className="space-y-4 pt-2 border-t border-zinc-800">
      <span className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5"><Store size={13} /> Fornecedores e Melhores Preços</span>

      {/* Ferramenta Buscar Fornecedores */}
      <SupplierSearch />

      {/* Price comparison */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <span className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5"><Receipt size={12} /> Comparar Preços de Produtos</span>

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="admin-input pl-8" />
        </div>

        <button onClick={() => setShowPriceForm(!showPriceForm)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition">
          <Plus size={14} /> {showPriceForm ? 'Cancelar' : 'Adicionar Preço'}
        </button>

        {showPriceForm && (
          <form onSubmit={addPrice} className="bg-zinc-800 rounded-lg p-3 space-y-2">
            <select value={priceForm.supplier_id} onChange={(e) => setPriceForm({ ...priceForm, supplier_id: e.target.value })} className="admin-input">
              <option value="">Escolha o fornecedor</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input placeholder="Produto (ex: Arroz 5kg)" value={priceForm.product_name} onChange={(e) => setPriceForm({ ...priceForm, product_name: e.target.value })} className="admin-input" />
            <div className="flex gap-2">
              <input inputMode="decimal" placeholder="Preço R$ (ex: 4,90)" value={priceForm.priceStr} onChange={(e) => setPriceForm({ ...priceForm, priceStr: e.target.value })} className="admin-input flex-1" />
              <select value={priceForm.unit} onChange={(e) => setPriceForm({ ...priceForm, unit: e.target.value })} className="admin-input w-20">
                <option value="kg">kg</option>
                <option value="un">un</option>
                <option value="litro">litro</option>
                <option value="pacote">pacote</option>
                <option value="cx">caixa</option>
              </select>
            </div>
            <input placeholder="Observações (opcional)" value={priceForm.notes} onChange={(e) => setPriceForm({ ...priceForm, notes: e.target.value })} className="admin-input" />
            <button type="submit" className="w-full bg-yellow-500 text-black font-bold py-2 rounded text-xs">Salvar Preço</button>
          </form>
        )}

        {loading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-yellow-400" size={18} /></div>}

        {!loading && productGroups.map(([productName, groupPrices]) => {
          const sorted = [...groupPrices].sort((a, b) => Number(a.price) - Number(b.price));
          const cheapest = sorted[0];
          return (
            <div key={productName} className="bg-zinc-800/50 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-200 capitalize">{productName}</p>
                <span className="text-[9px] text-zinc-500">{groupPrices.length} {groupPrices.length === 1 ? 'preço' : 'preços'}</span>
              </div>
              {sorted.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                    {i === 0 && <span className="bg-emerald-600/20 text-emerald-400 px-1 rounded text-[8px] font-bold">MELHOR</span>}
                    {supName(p.supplier_id)}
                    <span className="text-zinc-600">/ {p.unit}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${i === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>R$ {Number(p.price).toFixed(2)}</span>
                    <button onClick={() => deletePrice(p.id)} className="text-red-500 hover:text-red-400"><Trash2 size={10} /></button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {!loading && productGroups.length === 0 && <p className="text-[10px] text-zinc-500 italic text-center">Nenhum preço cadastrado. Adicione preços de produtos para comparar.</p>}
      </div>
    </div>
  );
}

// ===== DRIVERS EDITOR =====

const VEHICLE_LABELS: Record<string, string> = {
  moto: 'Moto',
  bicicleta: 'Bicicleta',
  carro: 'Carro',
  caminhonete: 'Caminhonete',
};

const PAY_FREQ_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
};

function DriversEditor({ onSaved }: { onSaved: () => void }) {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionId, setRejectionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payoutId, setPayoutId] = useState<string | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('delivery_drivers').select('*').order('created_at', { ascending: false });
    setDrivers((data ?? []) as DeliveryDriver[]);
    setLoading(false);
  }

  async function approve(d: DeliveryDriver) {
    await supabase.from('delivery_drivers').update({ approved: true, rejection_reason: null, active: true, verification_status: 'verified' }).eq('id', d.id);
    void load(); onSaved();
  }

  async function reject(d: DeliveryDriver, reason: string) {
    await supabase.from('delivery_drivers').update({ approved: false, rejection_reason: reason || null, verification_status: 'rejected' }).eq('id', d.id);
    setRejectionId(null); setRejectionReason('');
    void load(); onSaved();
  }

  async function toggle(d: DeliveryDriver) {
    await supabase.from('delivery_drivers').update({ active: !d.active }).eq('id', d.id);
    void load();
  }

  async function remove(id: string) {
    await supabase.from('delivery_drivers').delete().eq('id', id);
    void load(); onSaved();
  }

  async function processPayout(d: DeliveryDriver) {
    const amount = parseBRL(payoutAmount);
    if (amount <= 0 || amount > Number(d.wallet_balance ?? 0)) return;
    const newBalance = Number(d.wallet_balance ?? 0) - amount;
    const newPayouts = Number(d.driver_payouts ?? 0) + amount;
    await supabase.from('delivery_drivers').update({ wallet_balance: newBalance, driver_payouts: newPayouts }).eq('id', d.id);
    await supabase.from('driver_wallet_transactions').insert({
      driver_id: d.id,
      type: 'payout',
      amount: -amount,
      balance_after: newBalance,
      description: 'Pagamento/saque feito pela loja',
    });
    setPayoutId(null); setPayoutAmount('');
    void load(); onSaved();
  }

  const pending = drivers.filter((d) => !d.approved && !d.rejection_reason);
  const rejected = drivers.filter((d) => d.rejection_reason);
  const approvedDrivers = drivers.filter((d) => d.approved);

  return (
    <div className="space-y-4 pt-2 border-t border-zinc-800">
      <span className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5"><Bike size={13} /> Entregadores Parceiros</span>

      {pending.length > 0 && (
        <div className="space-y-2 bg-blue-950/20 border border-blue-800/40 rounded-lg p-3">
          <span className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1"><UserCheck size={12} /> Aguardando aprovação ({pending.length})</span>
          {pending.map((d) => (
            <div key={d.id} className="bg-zinc-800/50 rounded-lg p-2.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-yellow-400">{d.name}</p>
                  <p className="text-[10px] text-zinc-400">{formatPhoneDisplay(d.phone)}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {d.zone && <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded flex items-center gap-1"><MapPin size={9} /> {d.zone}</span>}
                    {d.vehicle_type && <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">{VEHICLE_LABELS[d.vehicle_type] ?? d.vehicle_type}</span>}
                    {d.vehicle_plate && <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">Placa: {d.vehicle_plate}</span>}
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="bg-zinc-900/60 rounded-lg p-2 space-y-1">
                <span className="text-[9px] font-bold text-blue-400 uppercase flex items-center gap-1"><IdCard size={10} /> Documentos</span>
                <div className="grid grid-cols-2 gap-1">
                  {d.cnh_image_url && <a href={d.cnh_image_url} target="_blank" rel="noreferrer" className="text-[9px] bg-blue-600/20 text-blue-300 px-1.5 py-1 rounded flex items-center gap-1"><FileText size={10} /> Ver CNH</a>}
                  {d.photo_url && <a href={d.photo_url} target="_blank" rel="noreferrer" className="text-[9px] bg-blue-600/20 text-blue-300 px-1.5 py-1 rounded flex items-center gap-1"><Camera size={10} /> Ver selfie</a>}
                  {d.document_url && <a href={d.document_url} target="_blank" rel="noreferrer" className="text-[9px] bg-blue-600/20 text-blue-300 px-1.5 py-1 rounded flex items-center gap-1"><FileText size={10} /> Ver documento</a>}
                </div>
                {d.cnh_number && <p className="text-[9px] text-zinc-400">CNH: {d.cnh_number} {d.cnh_category && `(${d.cnh_category})`}</p>}
                {d.vehicle_model && <p className="text-[9px] text-zinc-400">Veículo: {d.vehicle_model}</p>}
              </div>

              {rejectionId === d.id ? (
                <div className="space-y-1.5">
                  <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Motivo da recusa (opcional)" className="admin-input" />
                  <div className="flex gap-1.5">
                    <button onClick={() => reject(d, rejectionReason)} className="flex-1 bg-red-600 text-white font-bold py-1.5 rounded text-[10px]">Confirmar recusa</button>
                    <button onClick={() => { setRejectionId(null); setRejectionReason(''); }} className="bg-zinc-700 text-zinc-300 px-2 rounded text-[10px]">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={() => approve(d)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded text-[10px] flex items-center justify-center gap-1"><Check size={11} /> Aprovar</button>
                  <button onClick={() => { setRejectionId(d.id); setRejectionReason(''); }} className="flex-1 bg-red-600/80 hover:bg-red-500 text-white font-bold py-1.5 rounded text-[10px] flex items-center justify-center gap-1"><X size={11} /> Recusar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rejected.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-red-400 uppercase">Recusados ({rejected.length})</span>
          {rejected.map((d) => (
            <div key={d.id} className="flex items-center gap-2 bg-red-950/10 border border-red-800/30 rounded-lg p-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-400 line-through">{d.name}</p>
                <p className="text-[10px] text-red-400 truncate">{d.rejection_reason}</p>
              </div>
              <button onClick={() => approve(d)} className="text-[9px] text-emerald-400 font-bold">Reativar</button>
              <button onClick={() => remove(d.id)} className="text-red-500"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <span className="text-[10px] font-bold text-emerald-400 uppercase">Aprovados ({approvedDrivers.length})</span>
        {loading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-yellow-400" size={16} /></div>}
        {!loading && approvedDrivers.length === 0 && <p className="text-[10px] text-zinc-500 italic text-center">Nenhum entregador aprovado ainda.</p>}
        {!loading && approvedDrivers.map((d) => (
          <div key={d.id} className="bg-zinc-800/50 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${d.active ? 'text-yellow-400' : 'text-zinc-500 line-through'}`}>{d.name}</p>
                <p className="text-[10px] text-zinc-500">{formatPhoneDisplay(d.phone)} · {VEHICLE_LABELS[d.vehicle_type ?? 'moto'] ?? 'Moto'} · {d.zone ?? '—'}</p>
                {d.verification_status === 'verified' && <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1"><ShieldCheck size={9} /> Verificado</span>}
              </div>
              <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)} className="text-[9px] text-blue-400 font-bold">{expandedId === d.id ? 'Fechar' : 'Detalhes'}</button>
              <button onClick={() => toggle(d)} className="text-[9px] text-zinc-400">{d.active ? 'Desativar' : 'Ativar'}</button>
              <button onClick={() => remove(d.id)} className="text-red-500"><Trash2 size={11} /></button>
            </div>

            {/* Wallet bar */}
            <div className="flex items-center justify-between bg-emerald-950/20 border border-emerald-800/30 rounded p-1.5">
              <span className="text-[9px] text-emerald-300 flex items-center gap-1"><Wallet size={10} /> Carteira: <strong className="text-emerald-400">R$ {Number(d.wallet_balance ?? 0).toFixed(2)}</strong></span>
              <button onClick={() => setPayoutId(payoutId === d.id ? null : d.id)} className="text-[9px] text-blue-400 font-bold">Pagar</button>
            </div>

            {payoutId === d.id && (
              <div className="flex gap-1.5">
                <input inputMode="decimal" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} placeholder={`Valor (saldo: R$ ${Number(d.wallet_balance ?? 0).toFixed(2)})`} className="admin-input flex-1" />
                <button onClick={() => processPayout(d)} className="bg-blue-600 text-white font-bold px-3 rounded text-[10px]">Confirmar</button>
              </div>
            )}

            {expandedId === d.id && (
              <div className="bg-zinc-900/60 rounded-lg p-2 space-y-1.5">
                <span className="text-[9px] font-bold text-blue-400 uppercase flex items-center gap-1"><IdCard size={10} /> Documentação e veículo</span>
                {d.cnh_number && <p className="text-[9px] text-zinc-400">CNH: {d.cnh_number} {d.cnh_category && `(${d.cnh_category})`}</p>}
                {d.vehicle_plate && <p className="text-[9px] text-zinc-400">Placa: {d.vehicle_plate}</p>}
                {d.vehicle_model && <p className="text-[9px] text-zinc-400">Veículo: {d.vehicle_model}</p>}
                <div className="grid grid-cols-3 gap-1">
                  {d.cnh_image_url && <a href={d.cnh_image_url} target="_blank" rel="noreferrer" className="text-[9px] bg-blue-600/20 text-blue-300 px-1.5 py-1 rounded flex items-center gap-1"><FileText size={10} /> CNH</a>}
                  {d.photo_url && <a href={d.photo_url} target="_blank" rel="noreferrer" className="text-[9px] bg-blue-600/20 text-blue-300 px-1.5 py-1 rounded flex items-center gap-1"><Camera size={10} /> Selfie</a>}
                  {d.document_url && <a href={d.document_url} target="_blank" rel="noreferrer" className="text-[9px] bg-blue-600/20 text-blue-300 px-1.5 py-1 rounded flex items-center gap-1"><FileText size={10} /> Doc</a>}
                </div>
                <div className="border-t border-zinc-700 pt-1.5">
                  <p className="text-[9px] text-zinc-400">Total ganho: <strong className="text-emerald-400">R$ {Number(d.driver_earnings ?? 0).toFixed(2)}</strong></p>
                  <p className="text-[9px] text-zinc-400">Total pago: <strong className="text-blue-400">R$ {Number(d.driver_payouts ?? 0).toFixed(2)}</strong></p>
                  <p className="text-[9px] text-zinc-400 mt-1">Frequência de pagamento: <strong className="text-zinc-200">{PAY_FREQ_LABELS[d.payment_frequency ?? 'weekly'] ?? 'Semanal'}</strong></p>
                  {d.pix_key && <p className="text-[9px] text-zinc-400">PIX: <strong className="text-zinc-200">{d.pix_key}</strong></p>}
                  {d.bank_name && <p className="text-[9px] text-zinc-400">Banco: <strong className="text-zinc-200">{d.bank_name} · Ag {d.bank_agency ?? '—'} · Conta {d.bank_account ?? '—'} ({d.account_type ?? '—'})</strong></p>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatPhoneDisplay(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

// ===== SHARED COMPONENTS =====

function StatCard({ label, value, icon, color = 'zinc' }: { label: string; value: string; icon: ReactNode; color?: 'zinc' | 'emerald' | 'red' | 'blue' }) {
  const colorMap = {
    zinc: 'text-zinc-200 border-zinc-700',
    emerald: 'text-emerald-400 border-emerald-700',
    red: 'text-red-400 border-red-700',
    blue: 'text-blue-400 border-blue-700',
  };
  return (
    <div className={`bg-zinc-800/50 border rounded-lg p-2.5 ${colorMap[color]}`}>
      <div className="flex items-center gap-1 mb-0.5 opacity-70">{icon}<span className="text-[9px] font-bold uppercase">{label}</span></div>
      <p className="text-sm font-black">{value}</p>
    </div>
  );
}

function LabeledInput({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1"><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">{label}</span>{children}</label>;
}
