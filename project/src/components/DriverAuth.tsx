import { useState, type FormEvent } from 'react';
import {
  Bike, User, Phone, KeyRound, MapPin, Bike as BikeIcon, Car, Truck, Loader2,
  ArrowLeft, CheckCircle2, XCircle, IdCard, Camera, FileText, ImagePlus,
} from 'lucide-react';
import { supabase, type DeliveryDriver, type VehicleType } from '@/lib/supabase';

type Mode = 'login' | 'register' | 'pending' | 'rejected';

export function DriverAuth({ onBack, onLogin }: { onBack: () => void; onLogin: (driver: DeliveryDriver) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [zone, setZone] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('moto');
  const [cnhNumber, setCnhNumber] = useState('');
  const [cnhCategory, setCnhCategory] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rejectedReason, setRejectedReason] = useState('');
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<{ cnh?: File; photo?: File; doc?: File }>({});

  function formatPhoneInput(raw: string): string {
    const d = raw.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  async function uploadFile(file: File, driverId: string, docType: string): Promise<string | null> {
    const path = `${driverId}/${docType}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const upload = await supabase.storage.from('driver-docs').upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) return null;
    return supabase.storage.from('driver-docs').getPublicUrl(upload.data.path).data.publicUrl;
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) { setError('Telefone inválido.'); return; }
    if (pin.length !== 4) { setError('PIN deve ter 4 dígitos.'); return; }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('delivery_drivers')
      .select('*')
      .eq('phone', phoneDigits)
      .maybeSingle();
    setLoading(false);
    if (queryError) { setError('Erro ao buscar cadastro.'); return; }
    if (!data) { setError('Telefone não cadastrado. Faça seu cadastro primeiro.'); setMode('register'); return; }
    const driver = data as DeliveryDriver;
    if (driver.pin !== pin) { setError('PIN incorreto.'); return; }
    if (driver.approved === false) {
      if (driver.rejection_reason) {
        setRejectedReason(driver.rejection_reason);
        setMode('rejected');
      } else {
        setMode('pending');
      }
      return;
    }
    onLogin(driver);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError('');
    const phoneDigits = phone.replace(/\D/g, '');
    if (!name.trim()) { setError('Nome é obrigatório.'); return; }
    if (phoneDigits.length < 10) { setError('Telefone inválido. Inclua DDD.'); return; }
    if (pin.length !== 4) { setError('PIN deve ter 4 dígitos numéricos.'); return; }
    if (!zone.trim()) { setError('Informe sua região de atuação.'); return; }
    if (!cnhNumber.trim()) { setError('Número da CNH é obrigatório.'); return; }
    if (!files.cnh) { setError('Foto da CNH é obrigatória.'); return; }
    if (!files.photo) { setError('Foto de verificação (selfie) é obrigatória.'); return; }

    setLoading(true);
    const { data: existing } = await supabase
      .from('delivery_drivers')
      .select('id')
      .eq('phone', phoneDigits)
      .maybeSingle();
    if (existing) {
      setLoading(false);
      setError('Este telefone já está cadastrado. Faça login.');
      setMode('login');
      return;
    }

    // Cadastrar primeiro para ter um ID, depois fazer upload dos arquivos
    const { data, error: insertError } = await supabase
      .from('delivery_drivers')
      .insert({
        name: name.trim(),
        phone: phoneDigits,
        pin,
        vehicle_type: vehicleType,
        zone: zone.trim(),
        approved: false,
        active: true,
        cnh_number: cnhNumber.trim(),
        cnh_category: cnhCategory.trim() || null,
        vehicle_plate: vehiclePlate.trim() || null,
        vehicle_model: vehicleModel.trim() || null,
        verification_status: 'pending',
      })
      .select('*')
      .maybeSingle();
    if (insertError || !data) {
      setLoading(false);
      setError('Não foi possível cadastrar. Tente novamente.');
      return;
    }

    const driverId = (data as DeliveryDriver).id;
    setUploading(true);
    const updates: { cnh_image_url?: string; photo_url?: string; document_url?: string } = {};
    const docInserts: { driver_id: string; doc_type: string; file_url: string }[] = [];

    if (files.cnh) {
      const url = await uploadFile(files.cnh, driverId, 'cnh');
      if (url) { updates.cnh_image_url = url; docInserts.push({ driver_id: driverId, doc_type: 'cnh', file_url: url }); }
    }
    if (files.photo) {
      const url = await uploadFile(files.photo, driverId, 'photo');
      if (url) { updates.photo_url = url; docInserts.push({ driver_id: driverId, doc_type: 'photo', file_url: url }); }
    }
    if (files.doc) {
      const url = await uploadFile(files.doc, driverId, 'id');
      if (url) { updates.document_url = url; docInserts.push({ driver_id: driverId, doc_type: 'id_document', file_url: url }); }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('delivery_drivers').update(updates).eq('id', driverId);
    }
    if (docInserts.length > 0) {
      await supabase.from('driver_documents').insert(docInserts);
    }

    setUploading(false);
    setLoading(false);
    setMode('pending');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="bg-gradient-to-b from-blue-600 to-blue-800 p-4 shadow-xl border-b-4 border-blue-400">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button onClick={onBack} className="bg-black/20 hover:bg-black/40 text-white p-2 rounded-lg">
            <ArrowLeft size={18} />
          </button>
          <Bike size={24} className="text-white" />
          <span className="text-base font-black uppercase text-white">Entregador Parceiro</span>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-4">
        {mode === 'pending' && (
          <div className="bg-zinc-900 border border-blue-600 rounded-xl p-6 text-center space-y-3">
            <CheckCircle2 className="text-blue-400 mx-auto" size={48} />
            <h2 className="text-lg font-bold text-blue-400">Cadastro enviado!</h2>
            <p className="text-sm text-zinc-300">
              Recebemos seu cadastro, {name.split(' ')[0]}! A loja vai analisar seus documentos e aprovar seu acesso.
              Quando estiver aprovado, você recebe no WhatsApp e pode entrar aqui com seu telefone e PIN.
            </p>
            <button onClick={() => { setMode('login'); setName(''); setPin(''); }} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-lg text-sm">
              Voltar para login
            </button>
          </div>
        )}

        {mode === 'rejected' && (
          <div className="bg-zinc-900 border border-red-600 rounded-xl p-6 text-center space-y-3">
            <XCircle className="text-red-400 mx-auto" size={48} />
            <h2 className="text-lg font-bold text-red-400">Cadastro não aprovado</h2>
            <p className="text-sm text-zinc-300">
              Infelizmente seu cadastro não foi aprovado neste momento.
            </p>
            {rejectedReason && (
              <p className="text-xs text-zinc-400 bg-zinc-800 rounded-lg p-3">{rejectedReason}</p>
            )}
            <button onClick={() => { setMode('login'); setRejectedReason(''); }} className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm">
              Voltar
            </button>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="text-center space-y-1 pb-2">
              <h2 className="text-xl font-bold text-white">Entrar como Entregador</h2>
              <p className="text-xs text-zinc-400">Acesse com seu telefone e PIN</p>
            </div>
            <Field label="Telefone (com DDD)" icon={<Phone size={15} />}>
              <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} placeholder="(31) 99988-7766" className={inputCls} />
            </Field>
            <Field label="PIN de 4 dígitos" icon={<KeyRound size={15} />}>
              <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="0000" className={inputCls} />
            </Field>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Bike size={16} />}
              Entrar
            </button>
            <div className="text-center pt-2">
              <p className="text-xs text-zinc-400">Ainda não é cadastrado?</p>
              <button type="button" onClick={() => { setMode('register'); setError(''); }} className="text-blue-400 text-sm font-bold mt-1">
                Quero ser entregador parceiro
              </button>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="text-center space-y-1 pb-2">
              <h2 className="text-xl font-bold text-white">Cadastro de Entregador</h2>
              <p className="text-xs text-zinc-400">Faça parte da nossa rede de entregadores parceiros</p>
            </div>

            <div className="bg-blue-950/20 border border-blue-800/40 rounded-lg p-2.5 text-[10px] text-blue-300">
              Para segurança de todos, pedimos CNH, foto de verificação e dados do veículo. A loja analisa antes de aprovar.
            </div>

            <Field label="Nome completo" icon={<User size={15} />}>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className={inputCls} />
            </Field>
            <Field label="Telefone (com DDD)" icon={<Phone size={15} />}>
              <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} placeholder="(31) 99988-7766" className={inputCls} />
            </Field>
            <Field label="Região de atuação" icon={<MapPin size={15} />}>
              <input type="text" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ex: Betim, Contagem" className={inputCls} />
            </Field>
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">Tipo de locomoção</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'moto', label: 'Moto', icon: <BikeIcon size={18} /> },
                  { value: 'bicicleta', label: 'Bicicleta', icon: <BikeIcon size={18} /> },
                  { value: 'carro', label: 'Carro', icon: <Car size={18} /> },
                  { value: 'caminhonete', label: 'Caminhonete', icon: <Truck size={18} /> },
                ] as const).map((v) => (
                  <button key={v.value} type="button" onClick={() => setVehicleType(v.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-xs font-bold transition ${
                      vehicleType === v.value ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-zinc-800/40 rounded-lg p-3 space-y-2 border border-zinc-700">
              <span className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1.5"><IdCard size={12} /> Documentação</span>
              <Field label="Número da CNH" icon={<FileText size={14} />}>
                <input type="text" value={cnhNumber} onChange={(e) => setCnhNumber(e.target.value)} placeholder="00000000000" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Categoria CNH">
                  <input type="text" value={cnhCategory} onChange={(e) => setCnhCategory(e.target.value.toUpperCase())} placeholder="A, B, AB..." className={inputCls} />
                </Field>
                <Field label="Placa do veículo">
                  <input type="text" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} placeholder="ABC1D23" className={inputCls} />
                </Field>
              </div>
              <Field label="Modelo/cor do veículo">
                <input type="text" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="Ex: Honda CG 160 vermelha" className={inputCls} />
              </Field>
            </div>

            <div className="bg-zinc-800/40 rounded-lg p-3 space-y-2 border border-zinc-700">
              <span className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1.5"><Camera size={12} /> Fotos de verificação</span>
              <FileUpload label="Foto da CNH (obrigatório)" file={files.cnh} onChange={(f) => setFiles({ ...files, cnh: f })} icon={<IdCard size={15} />} />
              <FileUpload label="Selfie de verificação (obrigatório)" file={files.photo} onChange={(f) => setFiles({ ...files, photo: f })} icon={<Camera size={15} />} />
              <FileUpload label="Documento adicional (opcional)" file={files.doc} onChange={(f) => setFiles({ ...files, doc: f })} icon={<FileText size={15} />} />
            </div>

            <Field label="Crie seu PIN de 4 dígitos" icon={<KeyRound size={15} />}>
              <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="0000" className={inputCls} />
              <p className="text-[9px] text-zinc-500 mt-1">Use este PIN para entrar no portal depois.</p>
            </Field>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" disabled={loading || uploading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              {loading || uploading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {uploading ? 'Enviando documentos...' : loading ? 'Cadastrando...' : 'Enviar cadastro'}
            </button>
            <div className="text-center pt-1">
              <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-zinc-400 text-xs hover:text-zinc-200">
                Já tenho cadastro — fazer login
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none';

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">{icon}{label}</span>
      {children}
    </label>
  );
}

function FileUpload({ label, file, onChange, icon }: { label: string; file?: File; onChange: (f?: File) => void; icon: React.ReactNode }) {
  function choose(f?: File) {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024) return;
    onChange(f);
  }
  return (
    <label className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-300 cursor-pointer hover:border-blue-500 transition">
      <span className="text-blue-400">{icon}</span>
      <span className="flex-1 truncate">{file ? file.name : label}</span>
      <ImagePlus size={14} className="text-zinc-500" />
      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
    </label>
  );
}
