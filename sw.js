// MAKAN Translate — lets the app open with no internet.
const CACHE = 'makan-translate-v16';
const SHELL = [
  './',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/tabs.css',
  './js/store.js',
  './js/i18n.js',
  './js/translate.js',
  './js/speech.js',
  './js/text.js',
  './js/subtitles.js',
  './js/documents.js',
  './js/voice.js',
  './js/compare.js',
  './js/settings.js',
  './js/models.js',
  './js/voice-picker.js',
  './js/init.js',
  './js/dictionary.js',
  './js/idioms.js',
  './js/screen.js',
  './ai-worker.js',
  './asr-guard.js',
  './models-catalog.js',
  './piper-worker.js',
  './translation-memory.js',
  './manifest.webmanifest',
  './extension/engine.js',
  './extension/dictionary.js',
  './icon-192.png',
  './icon-512.png'
];
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];
// Model files (huggingface.co, and the *.hf.co hosts it redirects to) are deliberately not handled here: the model library keeps its own copy in browser storage.

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('makan-translate-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Dictionary packs are big and go to the dictionary's own database; only the small pack list is saved for offline use.
  if (url.origin === location.origin && url.pathname.includes('/dict/') && !url.pathname.endsWith('/packs.json')) return;
  if (url.origin === location.origin) {            // app files: fresh copy when online, saved copy when not
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./'))));
  } else if (STATIC_HOSTS.includes(url.hostname)) { // fonts + AI library: saved copy first
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })));
  }                                                 // translation APIs and model downloads go straight to the network
});
