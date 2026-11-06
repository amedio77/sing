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
  $('#url').value = loadVideoId(song.id) ? `https://youtu.be/${loadVideoId(song.id)}` : '';

  renderTabs();
  renderMeta(res.reset);
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

function renderMeta(resetMsg) {
  const tapped = timeline.source === 'tapped';
  $('#meta').replaceChildren(
    document.createTextNode(`${song.artist} · ${fmtTime(song.duration)} · ${lines.length}줄`),
    tag(
      'a',
      {
        class: 'badge ' + (tapped ? 'ok' : 'warn'),
        href: `sync.html#${song.id}`,
        title: tapped ? '탭싱크로 보정된 타임라인' : '추정 타임라인 — 보정하면 정확해집니다',
      },
      tapped ? '✓ 보정 완료' : '추정값 · 보정 권장'
    )
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
  const videoId = loadVideoId(song.id);
  $('#player-wrap').classList.toggle('hidden', !videoId);

  if (!videoId) {
    useTimer('음원 주소가 없어 타이머로 진행합니다. YouTube 주소를 넣으면 실제 음원에 맞춰 흐릅니다.');
    return;
  }

  const yt = createYouTubeClock({ videoId, mount: 'player' });
  yt.onReady(() => {
    const actual = yt.duration();
    // 플레이어가 보고한 실제 길이가 다르면 추정 타임라인을 비율로 맞춘다 (§4.2).
    // 실측(tapped) 타임라인은 훼손하지 않고 안내만 한다.
    if (actual > 0 && Math.abs(actual - timeline.duration) / timeline.duration > 0.02) {
      if (timeline.source === 'tapped') {
        notice(
          `보정된 타임라인은 ${fmtTime(timeline.duration)} 음원 기준인데 이 영상은 ${fmtTime(actual)}입니다. ` +
            `오프셋으로 맞추거나 다시 보정하세요.`
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
  clock = yt;
}

function useTimer(msg, bad = false) {
  if (clock) clock.destroy();
  clock = createTimerClock({ duration: timeline.duration });
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
  // 현재 줄을 무대 중앙에 고정. 글꼴 크기가 바뀐 뒤 측정해야 하므로 class 적용 후에 읽는다.
  const target = lineEls[Math.max(0, i)];
  if (!target) return;
  const stage = $('.stage');
  const shift = stage.clientHeight / 2 - (target.offsetTop + target.offsetHeight / 2);
  $('#rail').style.setProperty('--shift', `${Math.round(shift)}px`);
}

// 앞쪽을 더 넓게 본다 — 부를 때 필요한 건 다음 줄이지 지나간 줄이 아니다.
// 폰 세로 = 이전1·현재·다음2 / 태블릿·노트북 = 이전2·현재·다음3 (§6.2)
function lineWindow() {
  const p = prefs.lineWindow;
  if (typeof p === 'number') return { before: p, after: p + 1 }; // 옛 설정값(숫자) 호환
  if (p && typeof p === 'object') return { before: p.before ?? 1, after: p.after ?? 2 };
  return window.matchMedia('(min-width: 768px)').matches
    ? { before: 2, after: 3 }
    : { before: 1, after: 2 };
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
function updatePlayBtn() {
  const playing = clock?.isPlaying();
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

function nudgeOffset(d) {
  timeline = { ...timeline, offset: Math.round((timeline.offset + d) * 10) / 10 };
  saveTimeline(song.id, timeline);
  $('#off-val').textContent = `${timeline.offset > 0 ? '+' : ''}${timeline.offset.toFixed(1)}s`;
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
  const id = parseVideoId($('#url').value);
  if (!id) return notice('YouTube 주소를 인식할 수 없습니다. 영상 링크를 그대로 붙여넣어 주세요.', true);
  saveVideoId(song.id, id);
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
  if (!loadVideoId(song.id)) return notice('먼저 YouTube 주소를 저장하세요.');
  w.classList.toggle('hidden');
});
$('#fs').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => notice('전체화면을 쓸 수 없습니다.'));
});

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
      $('#fs').click();
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
