import { useState, type FormEvent } from 'react';
import { User, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function AuthScreen({ onClose }: { onClose: () => void }) {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    if (mode === 'signup' && (!fullName || !phone)) {
      setError('Preencha nome e telefone para cadastrar.');
      return;
    }
    setBusy(true);
    const res =
      mode === 'login'
        ? await signInWithEmail(email.trim(), password)
        : await signUpWithEmail(email.trim(), password, fullName.trim(), phone.trim());
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
  }

  return (
    <div className="bg-zinc-900 border-2 border-yellow-500 rounded-xl p-4 shadow-2xl space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-yellow-400 uppercase flex items-center gap-2">
          <User size={16} /> {mode === 'login' ? 'Entrar na minha conta' : 'Criar minha conta'}
        </h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-xs">Fechar</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        {mode === 'signup' && (
          <>
            <input
              type="text"
              placeholder="Nome completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-100 focus:border-yellow-500 focus:outline-none"
            />
            <input
              type="tel"
              placeholder="Telefone / WhatsApp"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-100 focus:border-yellow-500 focus:outline-none"
            />
          </>
        )}
        <input
          type="email"
          placeholder="Seu e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-100 focus:border-yellow-500 focus:outline-none"
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-100 focus:border-yellow-500 focus:outline-none"
        />
        {error && (
          <p className="text-red-400 text-xs flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {mode === 'login' ? 'Entrar' : 'Cadastrar'}
        </button>
      </form>

      <p className="text-[11px] text-zinc-500 text-center">
        {mode === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
          }}
          className="text-yellow-400 font-bold underline"
        >
          {mode === 'login' ? 'Criar agora' : 'Entrar'}
        </button>
      </p>
    </div>
  );
}
