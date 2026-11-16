// 홈 화면 설치용 최소 서비스 워커. 저장(캐시)은 하지 않는다 — 기사·브리핑은 항상 네트워크에서 새로 받는다.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
