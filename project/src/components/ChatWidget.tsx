import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, MessageCircle, Bot, Store, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type ChatMsg = {
  id: string;
  user_id: string;
  sender: 'customer' | 'store' | 'bot';
  text: string;
  read: boolean;
  created_at: string;
};

// Respostas automáticas simples do bot baseadas em palavras-chave.
function botReply(text: string): string | null {
  const t = text.toLowerCase();
  if (/(oi|ol[áa]|bom dia|boa tarde|boa noite|hey)/.test(t)) {
    return 'Oi! Tudo bem? Aqui é o assistente da Marmitex É De Casa. Posso te ajudar com cardápio, pedido, pagamento ou entrega. O que você precisa?';
  }
  if (/(hor[áa]rio|aberto|abrem|fecha|funciona)/.test(t)) {
    return 'Funcionamos das 18h às 23h. Quando estamos fora do horário, você pode deixar seu pedido adiantado que preparamos na próxima abertura!';
  }
  if (/(card[áa]pio|prato|marmita|comida|o que tem)/.test(t)) {
    return 'No app você vê o cardápio do dia na aba "Cardápio". Escolha o tamanho, o prato e os adicionais direto por ali!';
  }
  if (/(pre[çc]o|valor|quanto|quanto custa)/.test(t)) {
    return 'Os preços aparecem no app conforme você escolhe o tamanho e os adicionais. O total é atualizado automaticamente na tela.';
  }
  if (/(endere[çc]o|entrega|entregar|regi[ãa]o|bairros?)/.test(t)) {
    return 'Entregamos nas regiões cadastradas. Na hora do pedido você escolhe sua região ou retirar no local. Confira as opções na tela de entrega.';
  }
  if (/(pagamento|pix|cart[ãa]o|dinheiro|troco)/.test(t)) {
    return 'Aceitamos PIX (adiantado ou na entrega), dinheiro e cartão. Para PIX adiantado, mostramos a chave no app. Para cartão, combine conosco!';
  }
  if (/(tempo|demora|pronto|quando chega)/.test(t)) {
    return 'O tempo estimado aparece no seu pedido. Em geral preparamos em cerca de 30 min e somamos o tempo da região de entrega.';
  }
  if (/(cancelar|cancela)/.test(t)) {
    return 'Para cancelar, chame a gente aqui ou no WhatsApp o mais rápido possível. Se o pedido já estiver a caminho, pode não ser possível cancelar.';
  }
  if (/(obrigad|valeu|agradec)/.test(t)) {
    return 'Disponha! É De Casa mesmo, direto pra sua mesa! 🍲';
  }
  return null;
}

export function ChatWidget() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.user_id) return;
    void loadMessages();
    const channel = supabase
      .channel(`chat-${profile.user_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${profile.user_id}` },
        () => { void loadMessages(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.user_id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function loadMessages() {
    if (!profile?.user_id) return;
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages((data ?? []) as ChatMsg[]);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !profile?.user_id) return;
    setSending(true);
    const { error } = await supabase.from('chat_messages').insert({
      user_id: profile.user_id,
      sender: 'customer',
      text: content,
    });
    setSending(false);
    if (error) return;
    setText('');

    // Bot responde automaticamente se houver match; caso contrário, a loja responde depois.
    const reply = botReply(content);
    if (reply) {
      await supabase.from('chat_messages').insert({
        user_id: profile.user_id,
        sender: 'bot',
        text: reply,
      });
    } else {
      await supabase.from('chat_messages').insert({
        user_id: profile.user_id,
        sender: 'bot',
        text: 'Recebi sua mensagem! A loja vai responder em instantes. Se for urgente, você pode chamar no WhatsApp também.',
      });
      // Notifica a loja que há uma nova mensagem.
      await supabase.from('app_notifications').insert({
        target: 'store',
        kind: 'chat',
        payload: { user_id: profile.user_id, text: content },
      });
    }
    void loadMessages();
  }

  if (!profile) return null;

  const unreadFromStore = messages.filter((m) => !m.read && (m.sender === 'store' || m.sender === 'bot')).length;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-yellow-500 text-black shadow-xl flex items-center justify-center hover:bg-yellow-400 transition active:scale-95"
        aria-label="Abrir chat"
      >
        <MessageCircle size={22} />
        {unreadFromStore > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unreadFromStore}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-36 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm bg-zinc-900 border-2 border-yellow-500 rounded-xl shadow-2xl flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between p-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-yellow-400" />
              <span className="text-xs font-bold text-yellow-400 uppercase">Atendimento</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-200 text-xs">Fechar</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-zinc-950/40">
            {messages.length === 0 && (
              <div className="text-center py-6 space-y-1">
                <Bot size={24} className="text-yellow-400 mx-auto" />
                <p className="text-[11px] text-zinc-400">Oi! Sou o assistente virtual. Pergunte sobre cardápio, pagamento, entrega...</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                {(m.sender === 'bot' || m.sender === 'store') && (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.sender === 'bot' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-600/20 text-red-400'}`}>
                    {m.sender === 'bot' ? <Bot size={13} /> : <Store size={13} />}
                  </div>
                )}
                <div className={`max-w-[80%] rounded-lg p-2 text-[11px] leading-relaxed ${m.sender === 'customer' ? 'bg-yellow-500 text-black' : m.sender === 'bot' ? 'bg-zinc-800 text-zinc-200' : 'bg-red-950/40 text-zinc-100'}`}>
                  {m.sender === 'customer' && <User size={11} className="inline mr-1" />}
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={send} className="p-2 border-t border-zinc-800 flex gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-100 focus:border-yellow-500 focus:outline-none"
            />
            <button type="submit" disabled={sending || !text.trim()} className="bg-yellow-500 text-black rounded-lg px-3 disabled:opacity-50">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
