const VERSION = 'webquiz-pwa-v1';
const STATIC_CACHE = `${VERSION}-static`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/webquiz-icon.svg',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }),
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key.startsWith('webquiz-pwa-') && key !== STATIC_CACHE;
            })
            .map(function (key) {
              return caches.delete(key);
            }),
        );
      })
      .then(function () {
        return clients.claim();
      }),
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;
  if (url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(function (cache) {
            cache.put('/index.html', copy);
          });
          return response;
        })
        .catch(function () {
          return caches.match('/index.html').then(function (cachedIndex) {
            return cachedIndex || caches.match('/offline.html');
          });
        }),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(function (cache) {
            cache.put(request, copy);
          });
          return response;
        });
      }),
    );
  }
});

self.addEventListener('push', function (event) {
  let data = { title: 'WebQuiz', body: 'You have a new notification.' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || data.message || '',
    icon: '/webquiz-icon.svg',
    badge: '/webquiz-icon.svg',
    data: {
      url: data.url || '/',
    },
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(data.title || 'WebQuiz', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
