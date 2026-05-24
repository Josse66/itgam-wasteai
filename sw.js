// ============================================================
// Service Worker — ITGAM WasteAI
// Versión con cache inteligente: modelos = cache-first, HTML = network-first
// ============================================================

const CACHE_NAME = 'wasteai-v4';

// Solo cachear assets que NO cambian entre deploys
const ASSETS_ESTATICOS = [
    '/manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_ESTATICOS).catch(() => {
                console.log('Algunos assets no se pudieron cachear');
            });
        })
    );
    // Activar inmediatamente sin esperar a que se cierren tabs viejas
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

    // Modelos ONNX — cache first (son grandes, nunca cambian)
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

    // index.html y todo lo demás — SIEMPRE network first
    // Si la red falla, usa cache como fallback (PWA offline)
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
