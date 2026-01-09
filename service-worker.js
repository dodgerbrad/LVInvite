const CACHE_NAME = 'scorecard-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/score.css',
    '/score.js',
    '/manifest.json',
    '/LV.png',
    '/LV.png'
];
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});