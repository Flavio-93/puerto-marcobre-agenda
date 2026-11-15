const CACHE_NAME = 'marcobre-puerto-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching offline assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignorar llamadas de API externas o Webhooks
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Estrategia Network-First con fallback a Caché para contenido fresco
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// =========================================================================
// EVENTOS DE NOTIFICACIONES PUSH Y ALARMAS DE SISTEMA (MÓVILES)
// =========================================================================

// Escuchar mensaje del cliente para disparar notificación con vibración
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_NOTIFICATION') {
    const { title, body, tag } = event.data;
    const options = {
      body: body || 'Alerta operativa de Puerto Marcobre',
      icon: '/logo.png',
      badge: '/favicon.ico',
      tag: tag || 'alerta-marcobre',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 400],
      data: {
        url: self.location.origin
      }
    };
    self.registration.showNotification(title || '⚓ Puerto Marcobre', options);
  }
});

// Evento de Notificación Push del Servidor en Segundo Plano
self.addEventListener('push', (event) => {
  let data = {
    title: '⚓ Puerto Marcobre - Alerta',
    body: 'Tienes una tarea o relevo pendiente.',
    tag: 'marcobre-alerta',
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/favicon.ico',
    tag: data.tag || 'marcobre-tarea',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 400],
    data: {
      url: self.location.origin
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Al hacer clic en la notificación en el celular
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
