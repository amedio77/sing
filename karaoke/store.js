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
// 저장된 타임라인이 없거나, sequence 변경으로 줄 수가 어긋나면 추정값으로 재생성한다.
// 조용히 잘라 쓰면 가사와 시간이 밀리므로 통째로 다시 만든다 (Fail Fast).
export function loadTimeline(song) {
  const expected = (song.sequence ?? song.blocks.map((_, i) => i)).reduce(
    (n, bi) => n + song.blocks[bi].lines.length,
    0
  );
  const saved = readJSON('timeline.' + song.id);

  if (!saved || !Array.isArray(saved.lines)) return { timeline: estimateTimeline(song), reset: null };

  if (saved.lines.length !== expected) {
    const fresh = estimateTimeline(song);
    writeJSON('timeline.' + song.id, fresh);
    return {
      timeline: fresh,
      reset: `반복 구조가 바뀌어(${saved.lines.length}→${expected}줄) 타임라인을 다시 계산했습니다.`,
    };
  }

  return {
    timeline: {
      source: saved.source === 'tapped' ? 'tapped' : 'estimated',
      offset: Number(saved.offset) || 0,
      duration: Number(saved.duration) || song.duration,
      lines: saved.lines.map(Number),
      // 보정 중 기록(미기록 줄은 null). 부분 기록도 새로고침 후 이어서 찍을 수 있어야 한다.
      taps:
        Array.isArray(saved.taps) && saved.taps.length === expected
          ? saved.taps.map((v) => (v == null ? null : Number(v)))
          : null,
      updatedAt: saved.updatedAt || null,
    },
    reset: null,
  };
}

export function saveTimeline(songId, timeline) {
  writeJSON('timeline.' + songId, { ...timeline, updatedAt: new Date().toISOString() });
}

export const clearTimeline = (songId) => rawDel('timeline.' + songId);

// ── YouTube 영상 ID (§3.5) ────────────────────────────
// 설계상 ID 를 코드에 하드코딩하지 않는다 — 올바른 음원인지·임베드 허용인지 보증할 수 없다(R-2).
export const loadVideoId = (songId) => rawGet('yt.' + songId) || '';
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
