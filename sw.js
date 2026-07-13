const CACHE_NAME = 'atelier-costura-v1';

const ARQUIVOS_ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/index.js',
  './js/constants.js',
  './js/utils.js',
  './js/storage.js',
  './js/validators.js',
  './js/clientesRepository.js',
  './js/backupService.js',
  './icons/icon.svg'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_ESSENCIAIS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((chave) => chave !== CACHE_NAME).map((chave) => caches.delete(chave))))
      .then(() => self.clients.claim())
  );
});

// Cache-first para os arquivos do app shell; qualquer outra requisição
// (ex: fontes externas, se um dia forem adicionadas) cai direto na rede.
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;

  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      if (respostaCache) return respostaCache;

      return fetch(evento.request)
        .then((respostaRede) => {
          const clone = respostaRede.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, clone));
          return respostaRede;
        })
        .catch(() => {
          if (evento.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});
