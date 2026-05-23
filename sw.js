// ============================================================
// Service Worker — ITGAM WasteAI
// ============================================================

const CACHE_NAME = 'wasteai-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/model/model.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch(() => {
                console.log('Algunos assets no se pudieron cachear');
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // No interceptar POST ni llamadas a API
    if (e.request.method !== 'GET') return;
    if (e.request.url.includes('/api/')) return;

    const url = new URL(e.request.url);

    // Archivos del modelo — cache first
    if (url.pathname.startsWith('/model/')) {
        e.respondWith(
            caches.match(e.request).then((cached) => {
                if (cached) return cached;
                return fetch(e.request).then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    return res;
                });
            })
        );
        return;
    }

    // Todo lo demás — network first, fallback a cache
    e.respondWith(
        fetch(e.request)
            .then((res) => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});