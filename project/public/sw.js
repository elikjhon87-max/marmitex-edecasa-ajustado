const CACHE_NAME = 'edecasa-v2';
const PRECACHE_URLS = ['/', '/index.html', '/manifest.webmanifest', '/assets/5049368D-D189-404F-ABC1-277F472E981E.jpeg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
      }
      return response;
    }).catch(() => cached)),
  );
});

// ===== Push notifications =====

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Marmitex É De Casa', body: 'Você tem uma nova notificação.' };
  }

  const title = data.title ?? 'Marmitex É De Casa';
  const body = data.body ?? 'Você tem uma nova notificação.';
  const icon = data.icon ?? '/assets/5049368D-D189-404F-ABC1-277F472E981E.jpeg';
  const badge = data.badge ?? '/assets/5049368D-D189-404F-ABC1-277F472E981E.jpeg';
  const tag = data.tag ?? 'edecasa-notification';
  const url = data.url ?? '/';

  // Action buttons depend on kind.
  const actions = [];
  if (data.kind === 'new_order') {
    actions.push({ action: 'view_order', title: 'Ver Pedido' });
    actions.push({ action: 'dismiss', title: 'Dispensar' });
  } else if (data.kind === 'status_update') {
    if (data.delivery_status === 'entregue') {
      actions.push({ action: 'rate_order', title: 'Avaliar Pedido' });
    }
    actions.push({ action: 'view_order', title: 'Acompanhar' });
  } else if (data.kind === 'chat') {
    actions.push({ action: 'open_chat', title: 'Responder' });
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url, ...data },
      actions: actions.length > 0 ? actions : undefined,
      vibrate: [200, 100, 200],
      requireInteraction: data.kind === 'new_order',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};
  let targetUrl = data.url ?? '/';

  if (action === 'view_order' && data.order_id) {
    targetUrl = `/?order=${data.order_id}`;
  } else if (action === 'rate_order' && data.order_id) {
    targetUrl = `/?order=${data.order_id}&rate=1`;
  } else if (action === 'open_chat') {
    targetUrl = '/?tab=perfil';
  } else if (action === 'dismiss') {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});