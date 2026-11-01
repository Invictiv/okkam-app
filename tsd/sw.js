const CACHE_NAME = 'perepak-v2';
const STATIC_RESOURCES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './SKU List_ZFG.xlsx',
  '../assets/vendor/xlsx@0.18.5/xlsx.full.min.js',
  '../assets/vendor/bwip-js@4.1.0/bwip-js-min.js',
  'https://static.tildacdn.com/tild3533-3834-4361-a636-646263663031/logo.svg'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_RESOURCES);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') {
    return;
  }
  
  if (event.request.url.includes('api.php')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      }).catch(function() {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});