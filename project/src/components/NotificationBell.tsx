import { useEffect, useState } from 'react';
import { Bell, BellRing, X, ShoppingBag, Truck, MessageCircle, Clock, Check, Loader2, AlertCircle, BellOff } from 'lucide-react';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';

function iconFor(kind: string) {
  if (kind === 'new_order') return ShoppingBag;
  if (kind === 'status_update') return Truck;
  if (kind === 'chat') return MessageCircle;
  return Bell;
}

function labelFor(kind: string, payload: Record<string, unknown>): string {
  if (kind === 'new_order') {
    const total = payload.total as number | undefined;
    return `Novo pedido recebido${total ? ` — R$ ${Number(total).toFixed(2)}` : ''}!`;
  }
  if (kind === 'status_update') {
    const status = payload.delivery_status as string | undefined;
    const map: Record<string, string> = {
      preparando: 'Seu pedido entrou em preparação!',
      a_caminho: 'Seu pedido saiu para entrega!',
      entregue: 'Pedido entregue. Obrigado!',
      cancelado: 'Pedido cancelado.',
    };
    return map[status ?? ''] ?? 'Atualização no seu pedido.';
  }
  if (kind === 'chat') return 'Nova mensagem no chat.';
  return 'Você tem uma nova notificação.';
}

export function NotificationBell({ isStore, onOpenOrder }: { isStore: boolean; onOpenOrder?: (orderId: string) => void }) {
  const { notifications, unreadCount, alarmActive, dismissAlarm, markAllRead } = useNotifications(isStore);
  const { status, message, requestPermission } = usePushNotifications(isStore);
  const [dismissedPush, setDismissedPush] = useState(false);

  useEffect(() => {
    if (!alarmActive) return;
    const t = setTimeout(() => dismissAlarm(), 8000);
    return () => clearTimeout(t);
  }, [alarmActive, dismissAlarm]);

  function handleNotificationClick(n: AppNotification) {
    const orderId = n.payload.order_id as string | undefined;
    if (orderId && onOpenOrder) onOpenOrder(orderId);
  }

  const showPushPrompt = status !== 'subscribed' && !dismissedPush;

  return (
    <>
      {/* Push subscription prompt */}
      {showPushPrompt && (
        <div className="bg-blue-950/40 border border-blue-700/50 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
              <BellRing size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-blue-300">Ativar notificações no celular?</p>
              <p className="text-[10px] text-zinc-400">Receba alertas mesmo com o app fechado.</p>
            </div>
            {status !== 'requesting' && (
              <button
                onClick={() => setDismissedPush(true)}
                className="text-zinc-500 hover:text-zinc-300 shrink-0"
                aria-label="Dispensar"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {status !== 'requesting' && status !== 'denied' && status !== 'error' && status !== 'unsupported' && (
            <button
              onClick={() => requestPermission()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg py-2 text-xs transition flex items-center justify-center gap-1.5"
            >
              <BellRing size={13} /> Ativar notificações
            </button>
          )}
          {status === 'requesting' && (
            <div className="flex items-center justify-center gap-2 text-xs text-blue-300 py-1.5">
              <Loader2 size={14} className="animate-spin" />
              <span>{message || 'Processando...'}</span>
            </div>
          )}
          {status === 'denied' && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-lg p-2 flex items-start gap-2">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-red-300 flex-1">{message}</p>
            </div>
          )}
          {status === 'error' && (
            <div className="bg-amber-950/40 border border-amber-700/40 rounded-lg p-2 flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-300 flex-1">{message}</p>
              <button
                onClick={() => requestPermission()}
                className="text-[9px] bg-amber-600 hover:bg-amber-500 text-white font-bold rounded px-2 py-1 shrink-0"
              >
                Tentar de novo
              </button>
            </div>
          )}
          {status === 'unsupported' && (
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-2 flex items-start gap-2">
              <BellOff size={14} className="text-zinc-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-zinc-400 flex-1">
                As notificações push não são suportadas neste navegador/preview. Abra o app numa aba nova do celular ou desktop para ativar.
              </p>
            </div>
          )}
        </div>
      )}

      {status === 'subscribed' && (
        <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-lg p-2 flex items-center gap-2">
          <Check size={14} className="text-emerald-400 shrink-0" />
          <p className="text-[10px] text-emerald-400 flex-1">Notificações push ativas. Avisaremos você no celular.</p>
          <button
            onClick={() => {
              try {
                const n = new Notification('Marmitex É De Casa', { body: 'Teste: notificações funcionando!' });
                setTimeout(() => n.close(), 4000);
              } catch { /* ignore */ }
            }}
            className="text-[9px] bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-300 font-bold rounded px-2 py-1 shrink-0 transition"
          >
            Testar
          </button>
        </div>
      )}

      {alarmActive && (
        <div className="fixed inset-x-0 top-2 z-50 px-3 animate-[pulsate_1s_ease-in-out_infinite]">
          <div className="max-w-md mx-auto bg-red-600 text-white rounded-xl shadow-2xl p-3 flex items-center gap-3 border-2 border-yellow-400">
            <div className="w-10 h-10 rounded-full bg-yellow-500 text-black flex items-center justify-center shrink-0">
              <BellRing size={20} className="animate-pulse" />
            </div>
            <button
              onClick={() => {
                const orderId = alarmActive.payload.order_id as string | undefined;
                if (orderId && onOpenOrder) onOpenOrder(orderId);
                dismissAlarm();
              }}
              className="min-w-0 flex-1 text-left"
            >
              <p className="text-xs font-black uppercase">Alerta</p>
              <p className="text-sm font-bold truncate">{labelFor(alarmActive.kind, alarmActive.payload)}</p>
              <p className="text-[10px] text-white/70 mt-0.5">Toque para ver</p>
            </button>
            <button onClick={dismissAlarm} className="text-white/80 hover:text-white shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {unreadCount > 0 && !alarmActive && (
        <div className="bg-red-600/90 text-white rounded-xl p-2.5 flex items-center gap-2 shadow-lg">
          <BellRing size={16} className="animate-pulse shrink-0" />
          <span className="text-xs font-bold flex-1">
            {unreadCount === 1 ? '1 nova notificação' : `${unreadCount} novas notificações`}
          </span>
          <button onClick={markAllRead} className="text-[10px] bg-white/20 hover:bg-white/30 rounded px-2 py-1 font-bold">
            Marcar lidas
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {notifications.slice(0, 8).map((n: AppNotification) => {
          const Icon = iconFor(n.kind);
          const orderId = n.payload.order_id as string | undefined;
          const canInteract = !!orderId && !!onOpenOrder;
          return (
            <button
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              disabled={!canInteract}
              className={`w-full text-left flex items-start gap-2 rounded-lg p-2 transition ${
                n.read_at ? 'bg-zinc-800/30' : 'bg-zinc-800/70 border border-yellow-500/30'
              } ${canInteract ? 'hover:bg-zinc-800 cursor-pointer' : 'cursor-default'}`}
            >
              <Icon size={14} className="text-yellow-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-zinc-200">{labelFor(n.kind, n.payload)}</p>
                <p className="text-[9px] text-zinc-500">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
                {canInteract && !n.read_at && (
                  <p className="text-[9px] text-yellow-400 mt-0.5">Toque para abrir o pedido</p>
                )}
              </div>
              {!n.read_at && <Clock size={11} className="text-zinc-500 shrink-0" />}
            </button>
          );
        })}
        {notifications.length === 0 && (
          <p className="text-[11px] text-zinc-500 text-center py-2">Nenhuma notificação ainda.</p>
        )}
      </div>
    </>
  );
}
