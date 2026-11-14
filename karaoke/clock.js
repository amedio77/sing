// karaoke/clock.js — 시간 소스 추상화 (순수 로직, 가사 렌더를 모름)
// 설계 문서 docs/11-karaoke-design.md §5
//
// 프롬프터는 "지금 몇 초인가"만 알면 된다. 그래서 두 구현이 같은 모양을 갖는다:
//   now() duration() play() pause() seek() isPlaying() destroy() onReady() onError() onState()
// onState(cb): 재생/정지가 바뀔 때 cb(playing). 유튜브 화면 자체의 버튼으로 재생해도
// 가사가 따라 움직이고 앱의 ▶/❙❙ 라벨이 맞게 하려면 상태를 '구독'해야 한다.
// 임베드가 막히면 clock 변수만 갈아끼우면 되고 렌더 루프는 건드리지 않는다.

// ── 공통: 콜백 보관 ───────────────────────────────────
function hooks() {
  const ready = [];
  const error = [];
  const state = [];
  return {
    onReady: (cb) => ready.push(cb),
    onError: (cb) => error.push(cb),
    onState: (cb) => state.push(cb),
    fireState: (playing) => state.forEach((cb) => cb(playing)),
    fireReady: (...a) => ready.splice(0).forEach((cb) => cb(...a)),
    fireError: (...a) => error.forEach((cb) => cb(...a)),
  };
}

// ── 타이머 시계 (§5.2) ────────────────────────────────
// performance.now() 기준점 차이로 계산한다. setInterval 로 누적하면 백그라운드 탭에서
// 타이머가 느려져 드리프트가 생기는데, 기준점 방식은 복귀 후에도 정확하다.
export function createTimerClock({ duration = 0, rate = 1 } = {}) {
  const h = hooks();
  let startedAt = 0; // 재생 시작 시점의 performance.now()
  let base = 0; // 그때까지 누적된 재생 위치(초)
  let playing = false;
  let speed = rate;

  const now = () => (playing ? base + ((performance.now() - startedAt) / 1000) * speed : base);

  setTimeout(() => h.fireReady(), 0); // 즉시 준비됨 (비동기로 통일)

  return {
    kind: 'timer',
    now,
    duration: () => duration,
    isPlaying: () => playing,
    play() {
      if (playing) return;
      base = now();
      startedAt = performance.now();
      playing = true;
      h.fireState(true);
    },
    pause() {
      if (!playing) return;
      base = now();
      playing = false;
      h.fireState(false);
    },
    seek(sec) {
      base = Math.max(0, sec);
      startedAt = performance.now();
    },
    setRate(r) {
      base = now();
      startedAt = performance.now();
      speed = r;
    },
    getRate: () => speed,
    destroy() {
      playing = false;
    },
    onReady: h.onReady,
    onError: h.onError,
    onState: h.onState,
  };
}

// ── YouTube 시계 (§5.3) ───────────────────────────────
const YT_ERRORS = {
  2: '영상 ID 가 잘못되었습니다. URL 을 다시 확인해 주세요.',
  5: '이 영상은 브라우저 플레이어에서 재생할 수 없습니다.',
  100: '영상을 찾을 수 없습니다 (삭제되었거나 비공개).',
  101: '이 영상은 외부 사이트에서 재생할 수 없도록 설정돼 있습니다.',
  150: '이 영상은 외부 사이트에서 재생할 수 없도록 설정돼 있습니다.',
};

let apiPromise = null;

// IFrame API 스크립트는 한 번만 삽입한다.
function loadYouTubeAPI() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve(window.YT);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => reject(new Error('YouTube 플레이어를 불러올 수 없습니다 (네트워크 확인).'));
    document.head.appendChild(tag);
    setTimeout(() => reject(new Error('YouTube 플레이어 로딩이 지연됩니다.')), 10000);
  });
  return apiPromise;
}

// 플레이어 상태 (YT.PlayerState)
const UNSTARTED = -1;
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;
const CUED = 5;

export function createYouTubeClock({ videoId, mount }) {
  const h = hooks();
  let player = null;
  let destroyed = false;
  // 한 번도 재생하지 않은(시작 전·대기) 영상은 seekTo 를 무시하고 0초부터 재생한다.
  // '바로 시작'은 열자마자 누르는 버튼이라 이 경우가 기본이다 — 이동 위치를 들고 있다가
  // 실제 재생이 시작되는 순간 적용한다.
  let pendingSeek = null;

  loadYouTubeAPI()
    .then((YT) => {
      if (destroyed) return;
      player = new YT.Player(mount, {
        videoId,
        playerVars: {
          controls: 1,
          rel: 0,
          playsinline: 1, // iOS 에서 전체화면 강제 전환 방지 — 가사와 동시 표시에 필수
          modestbranding: 1,
          origin: location.origin,
        },
        events: {
          onReady: () => !destroyed && h.fireReady(),
          onStateChange: (e) => {
            if (e.data === PLAYING && pendingSeek != null) {
              const t = pendingSeek;
              pendingSeek = null;
              player.seekTo(t, true);
            }
            // 버퍼링(3)은 건너뛴다 — 재생 의도가 유지되는 중간 상태라 라벨을 흔들지 않는다
            if (e.data === PLAYING) h.fireState(true);
            else if (e.data === PAUSED || e.data === ENDED) h.fireState(false);
          },
          onError: (e) =>
            !destroyed && h.fireError(YT_ERRORS[e.data] || `재생 오류 (코드 ${e.data}).`),
        },
      });
    })
    .catch((err) => !destroyed && h.fireError(err.message));

  const safe = (fn, fallback) => {
    try {
      return player ? fn() : fallback;
    } catch {
      return fallback;
    }
  };

  return {
    kind: 'youtube',
    // 이동 대기 중이면 목표 위치를 현재 시각으로 보여 준다 — 가사가 먼저 그 줄로 가 있어야
    // 재생이 시작되는 순간 어긋나 보이지 않는다.
    now: () => (pendingSeek != null ? pendingSeek : safe(() => player.getCurrentTime() || 0, 0)),
    duration: () => safe(() => player.getDuration() || 0, 0),
    isPlaying: () => safe(() => player.getPlayerState() === 1, false),
    play: () => safe(() => player.playVideo()),
    pause: () => safe(() => player.pauseVideo()),
    seek: (sec) =>
      safe(() => {
        const t = Math.max(0, sec);
        const st = player.getPlayerState();
        // 시작 전에는 seekTo 를 부르지 않는다 — 유튜브는 시작 전 영상에 seekTo 를 받으면
        // 스스로 재생을 시작해 버려서, 줄을 고르는 동안 노래가 흘러나온다.
        // 위치만 들고 있다가 재생 버튼으로 실제 재생이 시작될 때 적용한다.
        if (st === UNSTARTED || st === CUED) {
          pendingSeek = t;
          return;
        }
        pendingSeek = null;
        player.seekTo(t, true);
      }),
    setRate: (r) => safe(() => player.setPlaybackRate(r)),
    getRate: () => safe(() => player.getPlaybackRate() || 1, 1),
    destroy() {
      destroyed = true;
      safe(() => player.destroy());
      player = null;
    },
    onReady: h.onReady,
    onError: h.onError,
    onState: h.onState,
  };
}
