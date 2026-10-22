import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export type AppNotification = {
  id: string;
  target: 'customer' | 'store';
  user_id: string | null;
  kind: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

/**
 * Hook que escuta notificações in-app para o usuário atual (cliente) ou para a loja (admin).
 * Dispara um som de alarme quando uma nova notificação chega.
 */
export function useNotifications(isStore: boolean) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alarmActive, setAlarmActive] = useState<AppNotification | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Carrega notificações existentes e inscreve em realtime.
  useEffect(() => {
    void load();
    const channel = supabase
      .channel('app_notifications_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_notifications' },
        (payload) => {
          const n = payload.new as AppNotification;
          if (isStore && n.target !== 'store') return;
          if (!isStore && n.target !== 'customer') return;
          if (!isStore && profile && n.user_id && n.user_id !== profile.user_id) return;
          setNotifications((prev) => [n, ...prev].slice(0, 50));
          setUnreadCount((c) => c + 1);
          playAlarm();
          setAlarmActive(n);
          // Trigger push notification via edge function.
          sendPushNotification(n);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStore, profile?.user_id]);

  async function load() {
    let query = supabase.from('app_notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (isStore) {
      query = query.eq('target', 'store');
    } else if (profile?.user_id) {
      query = query.eq('target', 'customer').eq('user_id', profile.user_id);
    } else {
      setNotifications([]);
      return;
    }
    const { data } = await query;
    if (data) {
      setNotifications(data as AppNotification[]);
      setUnreadCount((data as AppNotification[]).filter((n) => !n.read_at).length);
    }
  }

  function playAlarm() {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      // Sequência de 3 bips ascendentes.
      [880, 1100, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.16);
      });
    } catch {
      // AudioContext pode falhar antes de interação do usuário; ignoramos silenciosamente.
    }
  }

  async function sendPushNotification(n: AppNotification) {
    try {
      const { kind, payload } = n;
      let title = 'Marmitex É De Casa';
      let body = 'Você tem uma nova notificação.';
      if (kind === 'new_order') {
        const total = payload.total as number | undefined;
        title = 'Novo Pedido!';
        body = `Pedido recebido${total ? ` — R$ ${Number(total).toFixed(2)}` : ''}. Toque para ver.`;
      } else if (kind === 'status_update') {
        const status = payload.delivery_status as string | undefined;
        const map: Record<string, string> = {
          preparando: 'Seu pedido entrou em preparação!',
          a_caminho: 'Seu pedido saiu para entrega!',
          entregue: 'Pedido entregue. Obrigado!',
          cancelado: 'Pedido cancelado.',
        };
        title = 'Atualização do Pedido';
        body = map[status ?? ''] ?? 'Atualização no seu pedido.';
      } else if (kind === 'chat') {
        title = 'Nova mensagem';
        body = 'Nova mensagem no chat.';
      }
      const target_user_id = n.target === 'customer' ? n.user_id : null;
      const isStore = n.target === 'store';
      await supabase.functions.invoke('send-push', {
        body: { target_user_id, is_store: isStore, title, body, kind, delivery_status: payload.delivery_status, order_id: payload.order_id },
      });
    } catch {
      // Push falha silenciosamente; o alarme in-app já cobre.
    }
  }

  async function markAllRead() {
    if (notifications.length === 0) return;
    const ids = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from('app_notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  function dismissAlarm() {
    setAlarmActive(null);
  }

  return { notifications, unreadCount, alarmActive, dismissAlarm, markAllRead, playAlarm };
}
