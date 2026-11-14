// karaoke/prompter.js — 가사 프롬프터
// 설계 문서 docs/11-karaoke-design.md §5 · §6.2 / 요구사항 FB-1~FB-10
//
// 핵심: 가사 렌더는 "지금 몇 초인가"만 안다. 시간 공급자(YouTube/타이머)는 clock.js 가
// 동일 인터페이스로 추상화하므로, 임베드가 막히면 clock 변수만 갈아끼우고 루프는 그대로 돈다.

import { SONGS } from './songs.js';
import { expand, indexAt, progressAt, fmtTime } from './timeline.js';
import {
  loadTimeline,
  saveTimeline,
  loadVideoId,
  saveVideoId,
  parseVideoId,
  loadPrefs,
  savePrefs,
} from './store.js';
import { createTimerClock, createYouTubeClock } from './clock.js';

const $ = (s) => document.querySelector(s);

let prefs = loadPrefs();
let song;
let lines = []; // expand() 결과
let timeline; // §3.4 객체
let clock = null;
let raf = 0;
let lastIndex = -2; // -1(인트로)과 구분되는 초기값 → 첫 렌더 보장
let lineEls = [];
let wakeLock = null;

// ── 초기 곡 결정: #해시 > 마지막 곡 > 첫 곡 ───────────
function songFromHash() {
  const id = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  return SONGS.find((s) => s.id === id);
}

function notice(msg, bad = false) {
  const n = $('#notice');
  n.textContent = msg || '';
  n.classList.toggle('bad', Boolean(bad));
}

// ── 곡 로드 ───────────────────────────────────────────
function loadSong(next) {
  stopLoop();
  if (clock) {
    clock.destroy();
    clock = null;
  }

  song = next;
  lines = expand(song);
  const res = loadTimeline(song);
  timeline = res.timeline;
  lastIndex = -2;

  prefs = savePrefs({ lastSongId: song.id });
  if (songFromHash()?.id !== song.id) history.replaceState(null, '', '#' + song.id);

  $('#title').textContent = song.title;
  $('#sync-link').href = `sync.html#${song.id}`;
  const vid = loadVideoId(song);
  $('#url').value = vid ? `https://youtu.be/${vid}` : '';

  renderTabs();
  renderMeta(res.reset);
  renderOffset();
  renderRail();
  attachClock();
  paint(true);
}

function renderTabs() {
  $('#songtabs').replaceChildren(
    ...SONGS.map((s, i) =>
      tag(
        'button',
        {
          class: 'songtab',
          role: 'tab',
          'aria-selected': String(s.id === song.id),
          onclick: () => loadSong(s),
        },
        `${i + 1}. ${s.title}`
      )
    )
  );
}

// 타임라인 출처별 배지 — 사용자가 지금 믿어도 되는 값인지 한눈에 보이게 한다
const BADGE = {
  tapped: ['ok', '✓ 보정 완료', '탭싱크로 직접 찍은 타임라인'],
  synced: ['ok', '✓ 음원 싱크', '기본 영상 기준 실측 싱크 — 어긋나면 오프셋으로 맞추세요'],
  estimated: ['warn', '추정값 · 보정 권장', '추정 타임라인 — 탭싱크로 보정하면 정확해집니다'],
};

function renderMeta(resetMsg) {
  const [cls, label, title] = BADGE[timeline.source] || BADGE.estimated;
  $('#meta').replaceChildren(
    document.createTextNode(`${song.artist} · ${fmtTime(song.duration)} · ${lines.length}줄`),
    tag('a', { class: 'badge ' + cls, href: `sync.html#${song.id}`, title }, label)
  );
  if (resetMsg) notice(resetMsg);
  else notice('');
}

// 줄 DOM 은 곡 로드 때 한 번만 만든다. 이후엔 class 만 바꾼다.
function renderRail() {
  const rail = $('#rail');
  lineEls = lines.map((l, i) => {
    const node = tag(
      'div',
      { class: 'line', 'data-i': String(i) },
      tag('div', { class: 'line-text' }, l.text),
      tag('div', { class: 'lineprog' }, tag('i', {}))
    );
    // 블록이 바뀌는 지점에 라벨을 달아 "다음은 후렴"을 미리 알 수 있게 한다
    const next = lines[i + 1];
    if (next && next.blockStart && next.blockIndex !== l.blockIndex) {
      node.appendChild(tag('span', { class: 'blocktag' }, `─ ${next.label} ─`));
    }
    return node;
  });
  rail.replaceChildren(...lineEls);
}

// ── 시간 소스 + 폴백 (§5.4) ──────────────────────────
function attachClock() {
  const videoId = loadVideoId(song);
  $('#player-wrap').classList.toggle('hidden', !videoId);

  if (!videoId) {
    useTimer('음원 주소가 없어 타이머로 진행합니다. YouTube 주소를 넣으면 실제 음원에 맞춰 흐릅니다.');
    return;
  }

  // 실측 싱크는 특정 영상 기준이다. 다른 영상을 쓰면 인트로 길이가 달라 어긋날 수 있다.
  if (timeline.source === 'synced' && timeline.videoId && videoId !== timeline.videoId) {
    notice('저장해 둔 다른 영상을 쓰는 중입니다. 싱크는 기본 영상 기준이라 어긋나면 오프셋으로 맞추거나, 주소 칸을 비우고 저장하면 기본 영상으로 돌아갑니다.');
  }

  const yt = createYouTubeClock({ videoId, mount: 'player' });
  yt.onReady(() => {
    const actual = yt.duration();
    // 플레이어가 보고한 실제 길이가 다르면 추정 타임라인만 비율로 맞춘다 (§4.2).
    // 실측(tapped·synced) 타임라인은 늘이거나 줄이면 오히려 틀어지므로 안내만 한다
    // — 영상마다 다른 건 대개 인트로·끝 무음 길이라 비율 문제가 아니다.
    if (actual > 0 && Math.abs(actual - timeline.duration) / timeline.duration > 0.02) {
      if (timeline.source !== 'estimated') {
        notice(
          `타임라인은 ${fmtTime(timeline.duration)} 음원 기준인데 이 영상은 ${fmtTime(actual)}입니다. ` +
            `어긋나면 오프셋으로 맞추거나 탭싱크로 다시 보정하세요.`
        );
      } else {
        const k = actual / timeline.duration;
        timeline = {
          ...timeline,
          duration: actual,
          lines: timeline.lines.map((t) => Math.round(t * k * 100) / 100),
        };
        saveTimeline(song.id, timeline);
        notice(`영상 길이(${fmtTime(actual)})에 맞춰 추정 타임라인을 다시 계산했습니다.`);
        lastIndex = -2;
      }
    }
    paint(true);
  });
  yt.onError((msg) => {
    $('#player-wrap').classList.add('hidden');
    useTimer(`${msg} 타이머 모드로 전환했습니다.`, true);
  });
  clock = wireClock(yt);
}

function useTimer(msg, bad = false) {
  if (clock) clock.destroy();
  clock = wireClock(createTimerClock({ duration: timeline.duration }));
  notice(msg, bad);
  updatePlayBtn();
}

// ── 렌더 루프 (§5.5 · NF-2) ──────────────────────────
// 줄이 바뀌는 프레임에서만 DOM 트리를 만진다. 나머지 프레임은 CSS 변수 1개만 갱신.
function paint(force = false) {
  if (!clock) return;
  const t = clock.now() + timeline.offset;
  const i = indexAt(timeline.lines, t);

  if (i !== lastIndex || force) {
    applyActive(i);
    lastIndex = i;
  }

  const p = progressAt(timeline.lines, t, timeline.duration - song.outro);
  if (i >= 0 && lineEls[i]) lineEls[i].querySelector('.lineprog').style.setProperty('--p', p);

  const ci = $('#countin');
  if (i < 0 && timeline.lines.length) {
    ci.classList.add('on');
    $('#countin-num').textContent = String(Math.max(0, Math.ceil(timeline.lines[0] - t)));
  } else {
    ci.classList.remove('on');
  }

  $('#clock').textContent = `${fmtTime(Math.max(0, t))} / ${fmtTime(
    clock.duration() || timeline.duration
  )}`;
}

function applyActive(i) {
  const { before, after } = lineWindow();
  for (let k = 0; k < lineEls.length; k++) {
    const d = k - i; // 부호를 살린다 — 다음 줄과 지나간 줄은 쓸모가 다르다
    let cls = 'line';
    if (d === 0) cls = 'line active';
    else if (d === 1) cls = 'line next'; // 미리 읽고 준비하는 줄
    else if (d > 1 && d <= after) cls = 'line soon';
    else if (d < 0 && -d <= before) cls = 'line past';
    if (lineEls[k].className !== cls) lineEls[k].className = cls;
  }
  // 현재 줄을 무대 위쪽 ANCHOR 지점에 둔다.
  // 정중앙(0.5)에 두면 위 절반이 '지난 줄'(거의 안 보이는) 차지라 그냥 빈 공간이 된다.
  // 위로 올릴수록 아래에 다음 줄이 더 들어와, 부를 때 필요한 정보가 화면을 채운다.
  // 글꼴 크기가 바뀐 뒤 측정해야 하므로 class 적용 후에 읽는다.
  const target = lineEls[Math.max(0, i)];
  if (!target) return;
  const stage = $('.stage');
  const shift = stage.clientHeight * ANCHOR - (target.offsetTop + target.offsetHeight / 2);
  $('#rail').style.setProperty('--shift', `${Math.round(shift)}px`);
}

// 현재 줄이 놓이는 세로 위치 (무대 높이 대비). 0.5 = 정중앙.
const ANCHOR = 0.34;

// 앞쪽을 더 넓게 본다 — 부를 때 필요한 건 다음 줄이지 지나간 줄이 아니다.
// 창 크기가 아니라 '무대 높이'로 정한다: 집중 모드면 무대가 두 배가 되므로
// 그만큼 다음 줄을 더 채워야 빈 공간이 생기지 않는다. (§6.2)
function lineWindow() {
  const p = prefs.lineWindow;
  if (typeof p === 'number') return { before: p, after: p + 1 }; // 옛 설정값(숫자) 호환
  if (p && typeof p === 'object') return { before: p.before ?? 1, after: p.after ?? 2 };
  const h = $('.stage')?.clientHeight ?? 320;
  if (h >= 640) return { before: 2, after: 7 }; // 집중 모드
  if (h >= 420) return { before: 2, after: 4 }; // 노트북·태블릿 기본
  return { before: 1, after: 3 }; // 폰 세로 기본
}

function startLoop() {
  if (raf) return;
  const frame = () => {
    paint();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}

function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

// ── 컨트롤 ───────────────────────────────────────────
// 시계의 재생/정지 변화를 구독한다. 유튜브 화면 자체의 ▶ 로 재생해도 가사가 따라 흐르고,
// 앱 버튼 라벨이 실제 상태와 어긋나지 않는다(버퍼링 중 0.12초 뒤 한 번 확인하던 방식은
// 라벨이 '▶ 재생'으로 굳는 일이 있었다).
function wireClock(c) {
  c.onState((playing) => {
    if (c !== clock) return; // 갈아끼운 옛 시계의 늦은 알림은 무시
    if (playing) {
      startLoop();
      requestWake();
    } else {
      stopLoop();
      releaseWake();
      paint(true);
    }
    updatePlayBtn(playing);
  });
  return c;
}

function updatePlayBtn(playing = clock?.isPlaying()) {
  $('#play').textContent = playing ? '❙❙ 일시정지' : '▶ 재생';
}

function beginPlayback() {
  clock.play();
  startLoop();
  requestWake();
  setTimeout(updatePlayBtn, 120);
}

async function togglePlay() {
  if (!clock) return;
  if (clock.isPlaying()) {
    clock.pause();
    stopLoop();
    releaseWake();
    setTimeout(updatePlayBtn, 120); // YouTube 는 상태 반영이 한 틱 늦는다
  } else {
    // 인트로는 건드리지 않는다 — 건너뛰기는 '바로 시작'(skipIntro)의 역할이다.
    beginPlayback();
  }
}

// 인트로를 통째로 건너뛰고 첫 소절부터 바로 부른다.
function skipIntro() {
  if (!clock) return;
  seekToLine(0);
  if (!clock.isPlaying()) beginPlayback();
}

function seekToLine(i) {
  const n = timeline.lines.length;
  const k = Math.max(0, Math.min(n - 1, i));
  clock.seek(Math.max(0, timeline.lines[k] - timeline.offset));
  lastIndex = -2;
  paint(true);
}

// 오프셋 표시 — 조정할 때뿐 아니라 곡을 불러올 때도 저장값을 보여줘야 한다
// (안 그러면 실제로는 +0.2s 가 적용돼 있는데 화면엔 0.0s 로 보인다)
function renderOffset() {
  $('#off-val').textContent = `${timeline.offset > 0 ? '+' : ''}${timeline.offset.toFixed(1)}s`;
}

function nudgeOffset(d) {
  timeline = { ...timeline, offset: Math.round((timeline.offset + d) * 10) / 10 };
  saveTimeline(song.id, timeline);
  renderOffset();
  lastIndex = -2;
  paint(true);
}

// 화면 꺼짐 방지 (FB-9) — 미지원이면 조용히 넘어간다
async function requestWake() {
  try {
    if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    /* 지원 안 함 / 권한 없음 — 기능 저하만 */
  }
}
function releaseWake() {
  try {
    wakeLock?.release();
  } catch {
    /* noop */
  }
  wakeLock = null;
}

// ── 이벤트 배선 ──────────────────────────────────────
$('#play').addEventListener('click', togglePlay);
$('#skip-intro').addEventListener('click', skipIntro);
$('#prev-line').addEventListener('click', () => seekToLine(lastIndex - 1));
$('#next-line').addEventListener('click', () => seekToLine(lastIndex + 1));
$('#restart').addEventListener('click', () => {
  clock.seek(0);
  lastIndex = -2;
  paint(true);
});
$('#off-m5').addEventListener('click', () => nudgeOffset(-0.5));
$('#off-m1').addEventListener('click', () => nudgeOffset(-0.1));
$('#off-p1').addEventListener('click', () => nudgeOffset(0.1));
$('#off-p5').addEventListener('click', () => nudgeOffset(0.5));

$('#url-save').addEventListener('click', () => {
  const raw = $('#url').value.trim();
  // 비우고 저장 = 기본 영상(실측 싱크 기준)으로 되돌리기
  if (!raw) {
    saveVideoId(song.id, '');
    loadSong(song);
    return notice('기본 영상으로 되돌렸습니다.');
  }
  const id = parseVideoId(raw);
  if (!id) return notice('YouTube 주소를 인식할 수 없습니다. 영상 링크를 그대로 붙여넣어 주세요.', true);
  // 기본 영상과 같은 주소를 넣으면 굳이 따로 저장하지 않는다
  saveVideoId(song.id, id === song.youtubeId ? '' : id);
  loadSong(song);
});
$('#url-search').addEventListener('click', () => {
  window.open(
    'https://www.youtube.com/results?search_query=' + encodeURIComponent(song.searchQuery),
    '_blank',
    'noopener'
  );
});
$('#player-toggle').addEventListener('click', () => {
  const w = $('#player-wrap');
  if (!loadVideoId(song)) return notice('먼저 YouTube 주소를 저장하세요.');
  w.classList.toggle('hidden');
});
// ── 집중 모드 ────────────────────────────────────────
// 브라우저 전체화면만으로는 앱 상단 UI가 남아 가사 영역이 안 늘어난다.
// 레이아웃(집중 모드)과 브라우저 전체화면을 함께 켜되, 전체화면이 거부돼도
// 집중 모드는 그대로 동작하게 둘을 분리해 둔다.
let focusMode = false;

function applyFocus(on) {
  focusMode = on;
  document.body.classList.toggle('focus', on);
  const btn = $('#fs');
  btn.setAttribute('aria-pressed', String(on));
  btn.title = on ? '집중 모드 끄기' : '집중 모드 (가사만 크게)';
  // 무대 높이가 바뀌므로 중앙 정렬을 다시 계산한다
  lastIndex = -2;
  requestAnimationFrame(() => paint(true));
}

async function toggleFocus(on = !focusMode) {
  applyFocus(on);
  try {
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    else if (!on && document.fullscreenElement) await document.exitFullscreen();
  } catch {
    // 전체화면이 거부돼도(iOS Safari 등) 집중 모드 레이아웃은 유효하다
  }
}

// Esc·시스템 제스처로 전체화면이 풀리면 집중 모드도 같이 해제한다
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && focusMode) applyFocus(false);
});

$('#fs').addEventListener('click', () => toggleFocus());
$('#focus-exit').addEventListener('click', () => toggleFocus(false));

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  const idx = SONGS.findIndex((s) => s.id === song.id);
  switch (e.key) {
    case ' ':
      togglePlay();
      break;
    case 'ArrowLeft':
      nudgeOffset(-0.1);
      break;
    case 'ArrowRight':
      nudgeOffset(0.1);
      break;
    case 'ArrowUp':
      seekToLine(lastIndex - 1);
      break;
    case 'ArrowDown':
      seekToLine(lastIndex + 1);
      break;
    case 'f':
    case 'F':
      toggleFocus();
      break;
    case 'Escape':
      // 전체화면이 켜져 있으면 브라우저가 먼저 처리하고 fullscreenchange 로 해제된다.
      // 전체화면 없이 집중 모드만 쓰는 경우를 위해 여기서도 받는다.
      if (!focusMode) return;
      toggleFocus(false);
      break;
    case 's':
    case 'S':
      skipIntro();
      break;
    default:
      if (/^[1-9]$/.test(e.key) && SONGS[Number(e.key) - 1]) loadSong(SONGS[Number(e.key) - 1]);
      else return;
  }
  e.preventDefault();
});

// 글꼴·창 크기가 바뀌면 중앙 정렬을 다시 계산한다
window.addEventListener('resize', () => paint(true));
window.addEventListener('hashchange', () => {
  const s = songFromHash();
  if (s && s.id !== song.id) loadSong(s);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseWake();
});

function tag(name, attrs = {}, ...kids) {
  const e = document.createElement(name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    e.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return e;
}

document.documentElement.style.setProperty('--font-scale', String(prefs.fontScale));
loadSong(songFromHash() || SONGS.find((s) => s.id === prefs.lastSongId) || SONGS[0]);
// 루프는 재생 전에도 한 번 돌려 현재 줄·시계를 그려둔다
paint(true);
