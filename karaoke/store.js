// karaoke/store.js — localStorage 영속 (순수 로직, DOM 모름)
// 설계 문서 docs/11-karaoke-design.md §3.4 · §3.5
//
// 모든 키는 `karaoke.` 접두 → 기존 악보 게임의 localStorage 와 충돌하지 않는다.
// 사생활 보호 모드 등에서 localStorage 접근이 throw 할 수 있으므로 전부 try/catch 로 감싸고
// 실패 시 메모리 폴백으로 세션 동안은 동작하게 한다 (경고는 1회만).

import { estimateTimeline } from './timeline.js';

const PREFIX = 'karaoke.';
const mem = new Map(); // localStorage 불가 시 폴백
let warned = false;

function warnOnce(err) {
  if (warned) return;
  warned = true;
  console.warn('[karaoke] localStorage 사용 불가 — 이 세션에서만 유지됩니다.', err?.message || err);
}

function rawGet(key) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? (mem.has(key) ? mem.get(key) : null) : v;
  } catch (err) {
    warnOnce(err);
    return mem.has(key) ? mem.get(key) : null;
  }
}

function rawSet(key, value) {
  mem.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch (err) {
    warnOnce(err);
  }
}

function rawDel(key) {
  mem.delete(key);
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (err) {
    warnOnce(err);
  }
}

function readJSON(key) {
  const raw = rawGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[karaoke] ${key} 파싱 실패 — 초기화합니다.`, err.message);
    rawDel(key);
    return null;
  }
}

const writeJSON = (key, obj) => rawSet(key, JSON.stringify(obj));

// ── 타임라인 (§3.4) ───────────────────────────────────
// 우선순위
//   1) tapped    — 사용자가 탭싱크로 전부 찍은 값. 본인 음원 기준이라 가장 정확하다.
//   2) synced    — songs.js 에 실린 실측 싱크(기본 영상 기준). 일부만 찍은 줄은 덮어쓴다.
//   3) estimated — 실측 싱크가 없는 곡의 추정값.
// 줄 수가 어긋나면 조용히 잘라 쓰지 않고 바탕값으로 통째로 되돌린다 (Fail Fast).

const expectedLines = (song) =>
  (song.sequence ?? song.blocks.map((_, i) => i)).reduce((n, bi) => n + song.blocks[bi].lines.length, 0);

// 사용자 기록이 하나도 없을 때의 타임라인
export function baseTimeline(song) {
  const t = song.timing;
  if (t && Array.isArray(t.lines) && t.lines.length === expectedLines(song)) {
    return {
      source: 'synced',
      offset: 0,
      duration: t.duration || song.duration,
      lines: t.lines.slice(),
      videoId: t.videoId || null,
      updatedAt: null,
    };
  }
  return estimateTimeline(song);
}

export function loadTimeline(song) {
  const expected = expectedLines(song);
  const base = baseTimeline(song);
  const saved = readJSON('timeline.' + song.id);

  if (!saved || !Array.isArray(saved.lines)) return { timeline: base, reset: null };

  if (saved.lines.length !== expected) {
    writeJSON('timeline.' + song.id, base);
    return {
      timeline: base,
      reset: `가사 줄 수가 바뀌어(${saved.lines.length}→${expected}줄) 타임라인을 새로 불러왔습니다.`,
    };
  }

  const taps =
    Array.isArray(saved.taps) && saved.taps.length === expected
      ? saved.taps.map((v) => (v == null ? null : Number(v)))
      : null;

  if (saved.source === 'tapped') {
    return {
      timeline: {
        source: 'tapped',
        offset: Number(saved.offset) || 0,
        duration: Number(saved.duration) || song.duration,
        lines: saved.lines.map(Number),
        taps,
        updatedAt: saved.updatedAt || null,
      },
      reset: null,
    };
  }

  // 바탕이 바뀌었다(추정 → 실측). 옛 추정값에 맞춰 둔 오프셋·기록을 실측 싱크에 얹으면
  // 오히려 어긋나므로 버리고 새 바탕을 그대로 쓴다.
  if (saved.source !== base.source) return { timeline: base, reset: null };

  // 같은 바탕 위에서 사용자가 일부 줄만 찍었으면 그 줄만 덮어쓴다.
  // 바탕 줄 값은 저장본이 아니라 항상 songs.js 에서 읽는다 — 싱크를 고쳐 배포하면 바로 반영된다.
  const lines = base.lines.slice();
  if (taps) taps.forEach((v, i) => v != null && (lines[i] = v));
  for (let i = 1; i < lines.length; i++) if (lines[i] <= lines[i - 1]) lines[i] = lines[i - 1] + 0.3;

  return {
    timeline: { ...base, offset: Number(saved.offset) || 0, lines, taps, updatedAt: saved.updatedAt || null },
    reset: null,
  };
}

export function saveTimeline(songId, timeline) {
  writeJSON('timeline.' + songId, { ...timeline, updatedAt: new Date().toISOString() });
}

export const clearTimeline = (songId) => rawDel('timeline.' + songId);

// ── YouTube 영상 ID (§3.5) ────────────────────────────
// 기본 영상은 songs.js 의 youtubeId — 실측 싱크가 그 영상 기준으로 검증돼 있다.
// 사용자가 다른 주소를 넣으면 그 값을 저장해 우선하고, 비우면 기본 영상으로 돌아간다.
export const loadCustomVideoId = (songId) => rawGet('yt.' + songId) || '';
export const loadVideoId = (song) => loadCustomVideoId(song.id) || song.youtubeId || '';
export const saveVideoId = (songId, id) => (id ? rawSet('yt.' + songId, id) : rawDel('yt.' + songId));

// 유튜브 URL/ID 어느 쪽을 붙여넣어도 11자 ID 를 뽑아낸다.
export function parseVideoId(input) {
  const s = (input || '').trim();
  if (!s) return '';
  if (/^[\w-]{11}$/.test(s)) return s;
  const m =
    s.match(/[?&]v=([\w-]{11})/) ||
    s.match(/youtu\.be\/([\w-]{11})/) ||
    s.match(/\/(?:embed|shorts|live)\/([\w-]{11})/);
  return m ? m[1] : '';
}

// ── 암기 체크 (§3.5) ──────────────────────────────────
export function loadMemo(songId) {
  const m = readJSON('memo.' + songId);
  const checked = Array.isArray(m?.checkedBlocks) ? m.checkedBlocks.map(Number) : [];
  return { checkedBlocks: new Set(checked) };
}

export const saveMemo = (songId, checkedSet) =>
  writeJSON('memo.' + songId, { checkedBlocks: [...checkedSet].sort((a, b) => a - b) });

// ── 전역 설정 (§3.5) ──────────────────────────────────
const DEFAULT_PREFS = {
  fontScale: 1,
  maskMode: 'reveal', // reveal | block | initial
  lastSongId: null,
  lineWindow: null, // null = 화면 폭에 따라 자동
};

export function loadPrefs() {
  return { ...DEFAULT_PREFS, ...(readJSON('prefs') || {}) };
}

export function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch };
  writeJSON('prefs', next);
  return next;
}
