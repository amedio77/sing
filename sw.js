// sw.js — 오프라인 지원 서비스워커. 네트워크 우선 + 캐시 폴백:
// 온라인이면 항상 서버 최신(배포 즉시 반영, 낡은 코드 고착 없음), 오프라인이면 마지막 캐시로 동작.
const CACHE = 'sing-v5'; // v5: 노래 연습(가사 암기·프롬프터) 서브앱 추가
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/main.js',
  './src/game.js',
  './src/ui.js',
  './src/learn.js',
  './src/modes.js',
  './src/staff.js',
  './src/mascot.js',
  './src/audio.js',
  './src/speech.js',
  './src/i18n.js',
  './src/storage.js',
  './data/notes.js',
  './data/clefs.js',
  './data/keys.js',
  './data/chords.js',
  './data/rhythm.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // 노래 연습 서브앱 — 타이머 프롬프터·학습 뷰는 오프라인에서도 완전 동작해야 한다.
  // 프리캐시하지 않으면 오프라인 첫 방문 때 fetch 폴백이 index.html(게임 홈)을 돌려준다.
  './karaoke/study.html',
  './karaoke/prompter.html',
  './karaoke/sync.html',
  './karaoke/karaoke.css',
  './karaoke/songs.js',
  './karaoke/timeline.js',
  './karaoke/clock.js',
  './karaoke/store.js',
  './karaoke/study.js',
  './karaoke/prompter.js',
  './karaoke/sync.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then((m) => m || caches.match('./index.html'))
      )
  );
});
