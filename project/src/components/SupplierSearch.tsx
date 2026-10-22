import { useEffect, useMemo, useState } from 'react';
import { Search, ExternalLink, Star, Phone, MessageCircle, MapPin, Plus, Pencil, Trash2, X, Heart } from 'lucide-react';
import { supabase, type Supplier } from '@/lib/supabase';

type Category = {
  key: string;
  label: string;
  query: string;
};

const CATEGORIES: Category[] = [
  { key: 'carnes', label: 'Carnes e Frangos', query: 'atacadistas de carnes e frangos' },
  { key: 'hortifruti', label: 'Hortifruti (frutas, verduras e legumes)', query: 'hortifruti distribuidora de frutas verduras e legumes' },
  { key: 'mercearia', label: 'Mercearia e alimentos secos', query: 'atacadista mercearia alimentos secos' },
  { key: 'distribuidores', label: 'Distribuidores de alimentos', query: 'distribuidores de alimentos atacadão' },
  { key: 'embalagens', label: 'Embalagens para marmitas', query: 'fornecedores de embalagens para marmitas marmitex' },
  { key: 'bebidas', label: 'Bebidas', query: 'distribuidores de bebidas atacado' },
  { key: 'outros', label: 'Outros fornecedores', query: 'fornecedores para restaurantes' },
];

const CITIES = ['Betim, MG', 'Contagem, MG', 'Belo Horizonte, MG', 'Ribeirão das Neves, MG', 'Ibirité, MG'];

function normalizeWhatsApp(num: string): string {
  const digits = num.replace(/\D/g, '');
  if (digits.length >= 11) return digits;
  if (digits.length === 10) return '55' + digits;
  return '';
}

const emptyForm = {
  name: '',
  category: '',
  contact_name: '',
  phone: '',
  whatsapp: '',
  address: '',
  city: 'Betim, MG',
  maps_link: '',
  products: '',
  notes: '',
  favorite: false,
};

export function SupplierSearch() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showOnlyFav, setShowOnlyFav] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>(CATEGORIES[0]);
  const [city, setCity] = useState('Betim, MG');

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').order('favorite', { ascending: false }).order('name', { ascending: true });
    setSuppliers((data ?? []) as Supplier[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    let list = suppliers;
    if (showOnlyFav) list = list.filter((s) => s.favorite);
    if (filterCat) list = list.filter((s) => (s.category ?? '') === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.products ?? '').toLowerCase().includes(q) ||
        (s.city ?? '').toLowerCase().includes(q) ||
        (s.notes ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [suppliers, search, filterCat, showOnlyFav]);

  function openMapsSearch() {
    const query = `${selectedCategory.query} em ${city}`;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function startAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, category: selectedCategory.key });
    setShowForm(true);
  }

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      category: s.category ?? '',
      contact_name: s.contact_name ?? '',
      phone: s.phone ?? '',
      whatsapp: s.whatsapp ?? '',
      address: s.address,
      city: s.city ?? '',
      maps_link: s.maps_link ?? '',
      products: s.products ?? '',
      notes: s.notes,
      favorite: s.favorite ?? false,
    });
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      category: form.category,
      contact_name: form.contact_name.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      maps_link: form.maps_link.trim(),
      products: form.products.trim(),
      notes: form.notes.trim(),
      favorite: form.favorite,
    };
    if (editingId) {
      await supabase.from('suppliers').update(payload).eq('id', editingId);
    } else {
      await supabase.from('suppliers').insert(payload);
    }
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    void load();
  }

  async function toggleFavorite(s: Supplier) {
    await supabase.from('suppliers').update({ favorite: !s.favorite }).eq('id', s.id);
    void load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from('suppliers').delete().eq('id', deleteId);
    setDeleteId(null);
    void load();
  }

  return (
    <div className="space-y-4">
      {/* SEÇÃO 1: Encontrar fornecedores */}
      <div className="bg-zinc-900 border border-yellow-500/30 rounded-xl p-4 space-y-3">
        <span className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5">
          <Search size={14} /> Encontrar Fornecedores
        </span>

        <div className="space-y-2">
          <label className="block">
            <span className="text-[10px] font-bold text-zinc-500 uppercase">Categoria</span>
            <select
              value={selectedCategory.key}
              onChange={(e) => setSelectedCategory(CATEGORIES.find((c) => c.key === e.target.value) ?? CATEGORIES[0])}
              className="admin-input mt-0.5"
            >
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-bold text-zinc-500 uppercase">Cidade / Região</span>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="admin-input mt-0.5">
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <button
          onClick={openMapsSearch}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition"
        >
          <ExternalLink size={15} /> Buscar no Google Maps
        </button>
        <p className="text-[9px] text-zinc-500 text-center leading-tight">
          Abre uma pesquisa no Google Maps com a categoria e cidade escolhidas. Os resultados não são verificados pelo app — confira antes de salvar.
        </p>
      </div>

      {/* SEÇÃO 2: Meus fornecedores salvos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-1.5">
            <Heart size={13} /> Meus Fornecedores
          </span>
          <button onClick={startAdd} className="bg-red-600 hover:bg-red-500 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] flex items-center gap-1.5 transition">
            <Plus size={13} /> Adicionar
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              placeholder="Buscar por nome, produto, cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-input pl-8"
            />
          </div>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="admin-input w-auto">
            <option value="">Todas categorias</option>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <button
            onClick={() => setShowOnlyFav(!showOnlyFav)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${showOnlyFav ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
          >
            <Star size={12} /> Favoritos
          </button>
        </div>

        {loading && <p className="text-[10px] text-zinc-500 text-center py-3">Carregando...</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-[10px] text-zinc-500 italic text-center py-3">
            {suppliers.length === 0 ? 'Nenhum fornecedor salvo ainda. Use a busca acima e depois adicione os favoritos.' : 'Nenhum fornecedor encontrado com esses filtros.'}
          </p>
        )}

        {!loading && filtered.map((s) => (
          <div key={s.id} className="bg-zinc-800/50 rounded-xl p-3 space-y-2 border border-zinc-700/50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-yellow-400 truncate">{s.name}</p>
                  {s.favorite && <Star size={11} className="text-yellow-400 fill-yellow-400 shrink-0" />}
                </div>
                {s.category && (
                  <p className="text-[9px] text-zinc-500 uppercase">{CATEGORIES.find((c) => c.key === s.category)?.label ?? s.category}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleFavorite(s)} className={`p-1 rounded ${s.favorite ? 'text-yellow-400' : 'text-zinc-500 hover:text-yellow-400'}`} aria-label="Favoritar">
                  <Star size={14} className={s.favorite ? 'fill-yellow-400' : ''} />
                </button>
                <button onClick={() => startEdit(s)} className="text-zinc-400 hover:text-yellow-400 p-1" aria-label="Editar">
                  <Pencil size={13} />
                </button>
                <button onClick={() => setDeleteId(s.id)} className="text-red-500 hover:text-red-400 p-1" aria-label="Excluir">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {(s.address || s.city) && (
              <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                <MapPin size={10} className="shrink-0" />
                {[s.address, s.city].filter(Boolean).join(' — ')}
              </p>
            )}
            {s.products && <p className="text-[10px] text-zinc-300"><span className="text-zinc-500 font-bold">Produtos:</span> {s.products}</p>}
            {s.contact_name && <p className="text-[10px] text-zinc-400"><span className="text-zinc-500 font-bold">Contato:</span> {s.contact_name}</p>}
            {s.notes && <p className="text-[10px] text-zinc-400 italic">{s.notes}</p>}

            <div className="flex flex-wrap gap-1.5 pt-1">
              {s.phone && (
                <a href={`tel:${s.phone.replace(/\D/g, '')}`} className="flex items-center gap-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-[10px] font-bold px-2 py-1 rounded">
                  <Phone size={11} /> Ligar
                </a>
              )}
              {s.whatsapp && normalizeWhatsApp(s.whatsapp) && (
                <a
                  href={`https://wa.me/${normalizeWhatsApp(s.whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded"
                >
                  <MessageCircle size={11} /> WhatsApp
                </a>
              )}
              {s.maps_link && (
                <a
                  href={s.maps_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded"
                >
                  <ExternalLink size={11} /> Ver no mapa
                </a>
              )}
            </div>
            <p className="text-[8px] text-zinc-600">Dados cadastrados manualmente — não verificados pelo app.</p>
          </div>
        ))}
      </div>

      {/* MODAL: formulário adicionar/editar */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3" onClick={() => setShowForm(false)}>
          <div className="bg-zinc-900 border-2 border-yellow-500 rounded-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-yellow-400 uppercase">{editingId ? 'Editar Fornecedor' : 'Adicionar Fornecedor'}</h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-zinc-200"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="space-y-2.5">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Nome do estabelecimento *</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="admin-input mt-0.5" placeholder="Ex: Distribuidora São José" required />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Categoria</span>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="admin-input mt-0.5">
                  <option value="">Sem categoria</option>
                  {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Nome do contato</span>
                <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="admin-input mt-0.5" placeholder="Ex: João" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Telefone</span>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="admin-input mt-0.5" placeholder="(31) 99999-9999" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">WhatsApp</span>
                  <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="admin-input mt-0.5" placeholder="5531999999999" />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Endereço</span>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="admin-input mt-0.5" placeholder="Rua, número, bairro" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Cidade</span>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="admin-input mt-0.5" placeholder="Ex: Betim, MG" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Link do Google Maps</span>
                <input value={form.maps_link} onChange={(e) => setForm({ ...form, maps_link: e.target.value })} className="admin-input mt-0.5" placeholder="https://maps.google.com/..." />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Produtos fornecidos</span>
                <input value={form.products} onChange={(e) => setForm({ ...form, products: e.target.value })} className="admin-input mt-0.5" placeholder="Ex: Frango, arroz, óleo" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Observações</span>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="admin-input mt-0.5" rows={2} placeholder="Anotações pessoais" />
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" checked={form.favorite} onChange={(e) => setForm({ ...form, favorite: e.target.checked })} className="w-4 h-4 accent-yellow-500" />
                Marcar como favorito
              </label>
              <button type="submit" className="w-full bg-yellow-500 text-black font-bold py-2.5 rounded-lg text-xs">
                {editingId ? 'Salvar Alterações' : 'Salvar Fornecedor'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: confirmação de exclusão */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-zinc-900 border-2 border-red-500 rounded-xl w-full max-w-xs p-4 space-y-3 text-center" onClick={(e) => e.stopPropagation()}>
            <Trash2 size={28} className="text-red-500 mx-auto" />
            <p className="text-sm text-zinc-200 font-bold">Excluir este fornecedor?</p>
            <p className="text-[10px] text-zinc-500">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-xs font-bold py-2 rounded">Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 rounded">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
