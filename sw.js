// Service Worker untuk TabunganKu PWA & Pengingat Tagihan
const CACHE_NAME = 'tabunganku-cache-v3';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Tangani klik pada notifikasi pengingat
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data?.url || '/#tagihan', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Tangani pesan dari halaman aplikasi utama
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, data } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: tag || 'tabunganku-reminder',
      renotify: true,
      data: data || { url: '/#tagihan' },
      vibrate: [200, 100, 200]
    });
  }
});
