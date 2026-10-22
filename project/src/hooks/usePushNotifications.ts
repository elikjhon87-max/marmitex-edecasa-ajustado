import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const VAPID_PUBLIC_KEY = 'BFEkcoEyDKtaRO_XMpt-YmrsIV4PIbZKvuq9btWXUv5cdzilEhLLyRDEc7zVl6xc4kzSM0g1zyTK9ZkvMVIvJ4U';

function base64UrlToBase64(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return (input + pad).replace(/-/g, '+').replace(/_/g, '/');
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const b64 = base64UrlToBase64(base64);
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type PushStatus = 'idle' | 'requesting' | 'subscribed' | 'denied' | 'unsupported' | 'error';
export type PushState = {
  status: PushStatus;
  message: string;
  requestPermission: () => Promise<void>;
  unsubscribe: () => Promise<void>;
};

export function usePushNotifications(isStore: boolean): PushState {
  const { profile } = useAuth();
  const [status, setStatus] = useState<PushStatus>('idle');
  const [message, setMessage] = useState('');
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    // Check if push is supported at all.
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      setMessage('Seu navegador não suporta notificações push.');
      return;
    }

    // If already granted, check for existing subscription.
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (sub) {
            setStatus('subscribed');
            setMessage('');
          } else {
            setStatus('idle');
            setMessage('');
          }
        })
        .catch(() => {
          setStatus('idle');
        });
    } else if (Notification.permission === 'denied') {
      setStatus('denied');
      setMessage('As notificações foram bloqueadas. Toque no ícone de cadeado no navegador para permitir.');
    }
  }, []);

  const subscribeWithReg = useCallback(async (reg: ServiceWorkerRegistration): Promise<boolean> => {
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await existing.unsubscribe();
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const subJson = sub.toJSON();
    const insertPayload = {
      user_id: profileRef.current?.user_id ?? null,
      endpoint: subJson.endpoint,
      keys_p256dh: subJson.keys?.p256dh ?? '',
      keys_auth: subJson.keys?.auth ?? '',
      is_store: isStore,
    };

    await supabase.from('push_subscriptions').delete().eq('endpoint', subJson.endpoint);
    const { error } = await supabase.from('push_subscriptions').insert(insertPayload);
    if (error) {
      throw new Error('Não foi possível salvar a inscrição no servidor.');
    }
    return true;
  }, [isStore]);

  const requestPermission = useCallback(async (): Promise<void> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      setMessage('Seu navegador não suporta notificações push.');
      return;
    }

    setStatus('requesting');
    setMessage('Solicitando permissão...');

    try {
      // Step 1: Request notification permission.
      const result = await Notification.requestPermission();

      if (result !== 'granted') {
        setStatus('denied');
        setMessage(
          result === 'denied'
            ? 'As notificações foram bloqueadas. Toque no ícone de cadeado no navegador e permita notificações.'
            : 'Permissão não concedida. Tente novamente.'
        );
        return;
      }

      // Step 2: Wait for service worker to be ready.
      setMessage('Registrando notificações...');
      const reg = await navigator.serviceWorker.ready;

      // Step 3: Subscribe to push.
      setMessage('Ativando push...');
      await subscribeWithReg(reg);

      setStatus('subscribed');
      setMessage('');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      // Detect iframe restriction.
      if (errMsg.includes('Permission') || errMsg.includes('denied') || errMsg.includes('opaque')) {
        setStatus('denied');
        setMessage('O navegador bloqueou a notificação. Abra o app diretamente no navegador (fora do preview) para ativar.');
      } else {
        setStatus('error');
        setMessage('Não foi possível ativar as notificações. Tente novamente. Detalhe: ' + errMsg);
      }
    }
  }, [subscribeWithReg]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
      setStatus('idle');
      setMessage('');
    } catch {
      setStatus('error');
      setMessage('Erro ao desativar notificações.');
    }
  }, []);

  return { status, message, requestPermission, unsubscribe };
}
