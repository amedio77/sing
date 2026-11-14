// karaoke/sync.js — 탭싱크 보정 도구
// 설계 문서 docs/11-karaoke-design.md §6.3 / 요구사항 FC-1~FC-4
//
// 기본 타임라인은 실측 싱크(기본 영상 기준) 또는 추정값이다. 내 음원·다른 영상으로 부르거나
// 미세하게 어긋나면, 노래 한 번 들으며 줄마다 탭해 직접 맞춘다.
// 매 탭마다 저장하므로 중간에 창이 닫혀도 진행분이 남는다.

import { SONGS } from './songs.js';
import { expand, indexAt, fmtTime } from './timeline.js';
import {
  loadTimeline,
  baseTimeline,
  saveTimeline,
  clearTimeline,
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
let lines = [];
let base = null; // 탭하지 않은 줄을 메울 바탕(실측 싱크 또는 추정값) — 차이 표시(FC-4)에도 쓴다
let taps = []; // 기록된 시각. null = 아직 안 찍음
let cursor = 0;
let clock = null;
let raf = 0;
let rowEls = [];

const songFromHash = () =>
  SONGS.find((s) => s.id === decodeURIComponent((location.hash || '').replace(/^#/, '')));

function notice(msg, bad = false) {
  $('#notice').textContent = msg || '';
  $('#notice').classList.toggle('bad', Boolean(bad));
}

// ── 곡 로드 ───────────────────────────────────────────
function loadSong(next) {
  stopLoop();
  clock?.destroy();
  clock = null;

  song = next;
  lines = expand(song);
  base = baseTimeline(song);

  const { timeline } = loadTimeline(song);
  // 보정 기록을 그대로 복원한다. 부분 기록(미기록 줄 null)도 이어서 찍을 수 있어야 한다.
  // taps 가 없는 옛 데이터는 실측(tapped)일 때만 lines 를 기록으로 간주한다.
  if (timeline.taps) taps = timeline.taps.slice();
  else taps = timeline.source === 'tapped' ? timeline.lines.slice() : lines.map(() => null);
  cursor = taps.findIndex((t) => t == null);
  if (cursor < 0) cursor = 0;

  prefs = savePrefs({ lastSongId: song.id });
  if (songFromHash()?.id !== song.id) history.replaceState(null, '', '#' + song.id);

  $('#title').textContent = `보정 · ${song.title}`;
  $('#back').href = `prompter.html#${song.id}`;
  const vid = loadVideoId(song);
  $('#url').value = vid ? `https://youtu.be/${vid}` : '';

  renderTabs();
  renderList();
  attachClock();
  updateStatus();
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

function renderList() {
  rowEls = lines.map((l, i) =>
    tag(
      'li',
      { 'data-i': String(i), onclick: () => setCursor(i) },
      tag('span', { class: 'n' }, String(i + 1)),
      tag('span', { class: 't' }, '──────'),
      tag('span', { class: 'line-text' }, l.text),
      tag('span', { class: 'd' }, '')
    )
  );
  $('#taplist').replaceChildren(...rowEls);
  rowEls.forEach((_, i) => paintRow(i));
}

function paintRow(i) {
  const row = rowEls[i];
  if (!row) return;
  const t = taps[i];
  row.className = [
    t != null ? 'recorded' : '',
    i === cursor ? 'cursor' : '',
    lines[i].kind === 'chorus' ? 'chorus' : '',
  ]
    .filter(Boolean)
    .join(' ');
  row.children[1].textContent = t == null ? '──────' : fmtMs(t);
  // FC-4: 바탕(실측 싱크 또는 추정값)과 얼마나 달랐는지
  const d = t == null ? null : t - base.lines[i];
  row.children[3].textContent = d == null ? '' : `${d >= 0 ? '+' : ''}${d.toFixed(1)}`;
}

function setCursor(i) {
  cursor = Math.max(0, Math.min(lines.length - 1, i));
  rowEls.forEach((_, k) => paintRow(k));
  rowEls[cursor]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  updateStatus();
}

// ── 시간 소스 ────────────────────────────────────────
function attachClock() {
  const videoId = loadVideoId(song);
  $('#player-wrap').classList.toggle('hidden', !videoId);

  if (!videoId) {
    clock = createTimerClock({ duration: song.duration });
    notice('음원 없이 타이머로 보정합니다. 노래를 따로 재생하고 동시에 시작하세요.');
    return;
  }
  const yt = createYouTubeClock({ videoId, mount: 'player' });
  yt.onError((msg) => {
    $('#player-wrap').classList.add('hidden');
    clock?.destroy();
    clock = createTimerClock({ duration: song.duration });
    notice(`${msg} 타이머 모드로 전환했습니다.`, true);
  });
  clock = yt;
}

// ── 탭 기록 (FC-1) ───────────────────────────────────
function tapNow() {
  if (!clock || cursor >= lines.length) return;
  taps[cursor] = Math.round(clock.now() * 100) / 100;
  persist();
  paintRow(cursor);
  if (cursor < lines.length - 1) setCursor(cursor + 1);
  else {
    updateStatus();
    notice('마지막 줄까지 기록했습니다. "프롬프터에 적용"을 누르세요.');
  }
}

// FC-2 되돌리기
function undo() {
  const i = taps[cursor] != null ? cursor : cursor - 1;
  if (i < 0) return;
  taps[i] = null;
  persist();
  paintRow(i);
  setCursor(i);
}

function resetAll() {
  if (!confirm(`「${song.title}」의 보정 기록을 모두 지웁니다. 계속할까요?`)) return;
  taps = lines.map(() => null);
  clearTimeline(song.id);
  cursor = 0;
  rowEls.forEach((_, k) => paintRow(k));
  updateStatus();
  notice(base.source === 'synced'
    ? '기록을 지웠습니다. 프롬프터는 기본 음원 싱크로 돌아갑니다.'
    : '기록을 지웠습니다. 프롬프터는 추정 타임라인으로 돌아갑니다.');
}

// 매 탭마다 저장한다. 미기록 줄은 바탕값으로 메워 언제든 프롬프터가 동작하게 한다.
// 전부 찍었을 때만 source='tapped' — 부분 기록을 실측이라 주장하지 않는다.
function merged() {
  const complete = taps.every((t) => t != null);
  const out = taps.map((t, i) => (t != null ? t : base.lines[i]));
  // 단조 증가 보장: 부분 기록과 바탕값이 섞이면 역순이 생길 수 있다
  for (let i = 1; i < out.length; i++) {
    if (out[i] <= out[i - 1]) out[i] = out[i - 1] + 0.3;
  }
  return { complete, lines: out };
}

function persist() {
  const { complete, lines: ls } = merged();
  saveTimeline(song.id, {
    // 부분 기록은 바탕과 같은 출처로 저장해야 loadTimeline 이 바탕 위에 덮어쓴다
    source: complete ? 'tapped' : base.source,
    offset: 0,
    duration: clock?.duration() || song.duration,
    lines: ls,
    taps: taps.slice(), // 부분 기록 보존 — 중간에 창이 닫혀도 이어서 찍을 수 있다
  });
}

function updateStatus() {
  const n = taps.filter((t) => t != null).length;
  $('#count').textContent = `${n} / ${lines.length} 줄`;
  $('#prog').style.setProperty('--p', lines.length ? n / lines.length : 0);
  $('#apply').disabled = n === 0;
  $('#tap').disabled = cursor >= lines.length;
  $('#tap').textContent =
    cursor >= lines.length ? '완료' : `스페이스 = ${cursor + 1}번째 줄 시작`;
}

// ── 루프 (시계·현재 위치 표시) ───────────────────────
function startLoop() {
  if (raf) return;
  const frame = () => {
    if (clock) {
      const t = clock.now();
      $('#clock').textContent = `${fmtTime(t)} / ${fmtTime(clock.duration() || song.duration)}`;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function togglePlay() {
  if (!clock) return;
  if (clock.isPlaying()) {
    clock.pause();
    stopLoop();
  } else {
    clock.play();
    startLoop();
  }
  setTimeout(() => {
    $('#play').textContent = clock.isPlaying() ? '❙❙ 일시정지' : '▶ 재생';
  }, 120);
}

// ── JSON 입출력 (FC-3) ───────────────────────────────
function exportJSON() {
  const { complete, lines: ls } = merged();
  return JSON.stringify(
    {
      songId: song.id,
      title: song.title,
      source: complete ? 'tapped' : 'partial',
      duration: clock?.duration() || song.duration,
      lines: ls,
    },
    null,
    2
  );
}

function importJSON() {
  let data;
  try {
    data = JSON.parse($('#io').value);
  } catch (e) {
    return notice('JSON 형식이 아닙니다: ' + e.message, true);
  }
  if (!Array.isArray(data?.lines)) return notice('lines 배열이 없습니다.', true);
  if (data.songId && data.songId !== song.id)
    return notice(`다른 곡의 데이터입니다 (${data.songId}). 해당 곡 탭에서 가져오세요.`, true);
  if (data.lines.length !== lines.length)
    return notice(`줄 수가 다릅니다 (${data.lines.length} ≠ ${lines.length}).`, true);

  taps = data.lines.map(Number);
  persist();
  cursor = 0;
  rowEls.forEach((_, k) => paintRow(k));
  updateStatus();
  notice('가져왔습니다. 프롬프터에서 확인하세요.');
}

// ── 배선 ─────────────────────────────────────────────
$('#tap').addEventListener('click', tapNow);
$('#undo').addEventListener('click', undo);
$('#reset').addEventListener('click', resetAll);
$('#play').addEventListener('click', togglePlay);
$('#apply').addEventListener('click', () => {
  persist();
  location.href = `prompter.html#${song.id}`;
});
$('#export').addEventListener('click', () => {
  $('#io').value = exportJSON();
  notice('아래 칸의 JSON을 복사하세요.');
});
$('#download').addEventListener('click', () => {
  const blob = new Blob([exportJSON()], { type: 'application/json' });
  const a = tag('a', { href: URL.createObjectURL(blob), download: `${song.id}-timeline.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#import').addEventListener('click', importJSON);

$('#url-save').addEventListener('click', () => {
  const raw = $('#url').value.trim();
  if (!raw) {
    // 비우고 저장 = 기본 영상(실측 싱크 기준)으로 되돌리기
    saveVideoId(song.id, '');
    loadSong(song);
    return notice('기본 영상으로 되돌렸습니다.');
  }
  const id = parseVideoId(raw);
  if (!id) return notice('YouTube 주소를 인식할 수 없습니다.', true);
  saveVideoId(song.id, id === song.youtubeId ? '' : id);
  loadSong(song);
});
$('#url-search').addEventListener('click', () =>
  window.open(
    'https://www.youtube.com/results?search_query=' + encodeURIComponent(song.searchQuery),
    '_blank',
    'noopener'
  )
);

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if (e.key === ' ') tapNow();
  else if (e.key === 'Backspace') undo();
  else if (e.key === 'ArrowUp') setCursor(cursor - 1);
  else if (e.key === 'ArrowDown') setCursor(cursor + 1);
  else if (e.key === 'Enter') togglePlay();
  else if (/^[1-9]$/.test(e.key) && SONGS[Number(e.key) - 1]) loadSong(SONGS[Number(e.key) - 1]);
  else return;
  e.preventDefault();
});

window.addEventListener('hashchange', () => {
  const s = songFromHash();
  if (s && s.id !== song.id) loadSong(s);
});

function fmtMs(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

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

loadSong(songFromHash() || SONGS.find((s) => s.id === prefs.lastSongId) || SONGS[0]);
startLoop();
