import { useState } from 'react';
import { X, QrCode, Copy, Check, CreditCard, Banknote, Clock3, Clock, Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  total: number;
  pixKey: string;
  pixKeyType: string;
  onConfirm: () => void;
};

export function PixModal({ open, onClose, total, pixKey, pixKeyType, onConfirm }: Props) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const keyTypeLabel: Record<string, string> = {
    cpf: 'CPF',
    email: 'E-mail',
    telefone: 'Telefone',
    aleatoria: 'Chave Aleatória',
  };

  async function copyPixKey() {
    try {
      await navigator.clipboard.writeText(pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleConfirm() {
    setConfirming(true);
    setTimeout(() => {
      setConfirming(false);
      onConfirm();
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border-2 border-yellow-500 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-black uppercase tracking-wider text-yellow-400 flex items-center gap-2">
            <QrCode size={16} /> Pagar com PIX
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-center space-y-1">
            <p className="text-xs text-zinc-400">Valor a pagar</p>
            <p className="text-3xl font-black text-emerald-400">R$ {total.toFixed(2)}</p>
          </div>

          <div className="bg-zinc-800/60 rounded-xl p-4 space-y-3">
            <div className="text-center">
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Chave PIX ({keyTypeLabel[pixKeyType] || 'PIX'})</p>
              <p className="text-sm font-mono text-yellow-400 break-all select-all">{pixKey || 'Configure a chave PIX no painel admin'}</p>
            </div>

            {pixKey && (
              <button
                onClick={copyPixKey}
                className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied ? 'Chave copiada!' : 'Copiar chave PIX'}
              </button>
            )}
          </div>

          <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-3 text-[11px] text-amber-200 space-y-1.5">
            <p className="font-bold flex items-center gap-1.5"><Clock3 size={12} /> Como pagar:</p>
            <p>1. Abra o app do seu banco</p>
            <p>2. Escolha pagar via PIX (QR Code ou Copia e Cola)</p>
            <p>3. Cole a chave ou escaneie o QR Code</p>
            <p>4. Confirme o pagamento de R$ {total.toFixed(2)}</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleConfirm}
              disabled={confirming || !pixKey}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition active:scale-95"
            >
              {confirming ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {confirming ? 'Confirmando...' : 'Já paguei - Enviar pedido'}
            </button>
            <button
              onClick={onClose}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold py-2.5 rounded-lg transition"
            >
              Voltar
            </button>
          </div>

          {!pixKey && (
            <p className="text-[10px] text-red-400 text-center">A chave PIX ainda não foi configurada. Acesse o painel admin para definir.</p>
          )}
        </div>
      </div>
    </div>
  );
}
