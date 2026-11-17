/**
 * 서비스 워커: 앱을 설치 가능하게 하고, 화면 뼈대(HTML/CSS/JS)를 캐시해 빠르게 열리게 한다.
 * - /api 요청은 항상 네트워크로 보낸다. (뉴스는 항상 최신이어야 하므로 캐시하지 않는다)
 * - 정적 파일은 "캐시를 먼저 보여주고 뒤에서 새로 받아 갱신"하는 방식이다.
 * 캐시 구조를 바꿀 때는 CACHE_VERSION을 올려 이전 캐시를 지운다.
 */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `news-factory-${CACHE_VERSION}`;
const APP_SHELL = [
  '/', '/css/base.css', '/css/components.css',
  '/js/main.js', '/js/api.js', '/js/state.js', '/js/ui/render.js', '/js/utils/time.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 다른 출처 요청, GET 이외, API 요청은 건드리지 않는다.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached); // 오프라인이면 캐시를 그대로 쓴다.
      return cached || network;
    }),
  );
});
