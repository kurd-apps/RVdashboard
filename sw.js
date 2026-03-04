const CACHE_NAME = 'rv-dashboard-v1';
const urlsToCache = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // گەڕاندنەوەی فایلی کاشکراو (ئۆفلاین کار دەکات)
        }
        return fetch(event.request);
      })
  );
});
