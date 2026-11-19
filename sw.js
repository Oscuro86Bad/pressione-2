/* ============================================================
   PRESSIONE 2.0 — service worker
   App shell offline + cache dei moduli OCR/Supabase da CDN.
   Cambiare SW_VERSION quando si aggiornano i file.
   ============================================================ */
const SW_VERSION = '2.0.2-20261118';
const APP_CACHE = 'dp2-app-' + SW_VERSION;
const CDN_CACHE = 'dp2-cdn-v1';

const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/config.js',
  'js/format.js',
  'js/ocr-parse.js',
  'js/stats.js',
  'js/store.js',
  'js/cloud.js',
  'js/chart.js',
  'js/ocr.js',
  'js/supabase-config.js',
  'js/ui/common.js',
  'js/ui/onboarding.js',
  'js/ui/auth.js',
  'js/ui/entry.js',
  'js/ui/dashboard.js',
  'js/ui/diary.js',
  'js/ui/report.js',
  'js/ui/settings.js',
  'js/app.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'supabase/schema.sql'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(APP_CACHE).then(function (cache) {
      return Promise.all(APP_SHELL.map(function (url) {
        return cache.add(url).catch(function () { /* un file mancante non blocca l'installazione */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== APP_CACHE && key !== CDN_CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isStaticAsset(url) {
  return /\.(?:css|js|mjs|svg|png|jpg|jpeg|webp|ico|webmanifest|json|sql|woff2?|ttf)$/i.test(url.pathname) ||
    url.pathname.endsWith('/');
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }

  // Navigazione: prima la rete (per aggiornamenti), poi la copia offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(APP_CACHE).then(function (cache) { cache.put('index.html', copy); });
        }
        return response;
      }).catch(function () {
        return caches.match('index.html', { ignoreSearch: true }).then(function (cached) {
          return cached || caches.match('./', { ignoreSearch: true });
        });
      })
    );
    return;
  }

  // File dell'app: cache-first con aggiornamento in sottofondo.
  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(function (cached) {
        const network = fetch(request).then(function (response) {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(APP_CACHE).then(function (cache) { cache.put(request, copy); });
          }
          return response;
        }).catch(function () { return null; });

        if (cached) {
          event.waitUntil(network.then(function () { return null; }).catch(function () { return null; }));
          return cached;
        }
        return network.then(function (response) {
          if (response) return response;
          return new Response('Risorsa non disponibile offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      })
    );
    return;
  }

  // Librerie e dati OCR da jsDelivr: cache-first per l'uso offline.
  // Supabase (API e auth) NON viene mai messo in cache: sono dati personali.
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response && (response.ok || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(CDN_CACHE).then(function (cache) { cache.put(request, copy); });
          }
          return response;
        });
      })
    );
  }
});
