// ============================================================
// Service Worker — ITGAM WasteAI
// Cachea el modelo y la app para uso offline
// ============================================================

const CACHE_NAME = 'wasteai-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/model/model.json'
    // Los shards del modelo se cachean dinámicamente
];

// Instalar — cachear assets esenciales
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS).catch(() => {
                // Si falla algún asset, continuar sin error
                console.log('Algunos assets no se pudieron cachear');
            });
        })
    );
    self.skipWaiting();
});

// Activar — limpiar caches viejos
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

// Fetch — cache first para modelo, network first para API
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Las llamadas a Gemini API siempre van a la red
    if (url.hostname.includes('generativelanguage.googleapis.com')) {
        return;
    }

    // Los archivos del modelo se cachean (son grandes, no cambian)
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
