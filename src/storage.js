// src/storage.js — localStorage 최소 래퍼. 실패 시 조용히 무저장(세션 메모리로 정상 동작).
// 키 정책: 설정 = sing-settings-v1(아래 PICK 키) / 학습·진행 = sing-progress-v1(learnSeen 등)
//        / 보상 = sing-rewards-v1(모드별 최고 기록).
// 설정·진행은 스키마 변경 시 새 버전 키로 교체 허용(값 재설정 무해).
// 보상은 사용자가 "획득한 자산" — 가산적 스키마만 허용(필드 추가만, 삭제·리셋 금지. docs/05 §6.5).

const SETTINGS_KEY = 'sing-settings-v1';
const PROGRESS_KEY = 'sing-progress-v1';
const REWARDS_KEY = 'sing-rewards-v1';

const PICK = ['lang', 'notation', 'audioEnabled', 'volume', 'difficulty', 'total', 'clef', 'mascotEnabled'];

// 항목 단위 화이트리스트: 오염·구버전 값은 그 항목만 버리고 기본값 유지 (fail-safe)
const VALID = {
  lang: (v) => v === 'ko' || v === 'en',
  notation: (v) => ['solfege', 'english', 'both'].includes(v),
  audioEnabled: (v) => typeof v === 'boolean',
  volume: (v) => typeof v === 'number' && v >= 0 && v <= 1,
  difficulty: (v) => v === 'easy' || v === 'normal',
  total: (v) => v === 5 || v === 10,
  clef: (v) => ['treble', 'bass', 'both'].includes(v),
  mascotEnabled: (v) => typeof v === 'boolean',
};

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') || {};
  } catch {
    return {}; // 프라이빗 모드 SecurityError / JSON 손상 → 기본값 폴백
  }
}
function write(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {
    /* quota·프라이빗 모드 → 무시. 앱은 세션 메모리로 계속 동작 */
  }
}

export function loadSettings() {
  const parsed = read(SETTINGS_KEY);
  const out = {};
  for (const k of PICK) if (VALID[k](parsed[k])) out[k] = parsed[k];
  return out;
}

export function saveSettings(state) {
  write(SETTINGS_KEY, Object.fromEntries(PICK.map((k) => [k, state[k]])));
}

export const PERSIST_KEYS = PICK;

// 진행 데이터 — 현재는 학습 페이지 방문 기록(learnSeen)만
export function loadProgress() {
  const p = read(PROGRESS_KEY);
  return { learnSeen: p.learnSeen && typeof p.learnSeen === 'object' ? p.learnSeen : {} };
}

export function saveProgress(progress) {
  write(PROGRESS_KEY, progress);
}

// 보상 데이터 — best: { [modeId]: { stars, score } }. 병합은 호출부(결과 화면)에서 최고값만 넓힘.
// 설정과 동일한 fail-safe: 오염된 엔트리(NaN 등)는 그 모드만 버림 — Math.max 병합에 NaN 전파 방지.
export function loadRewards() {
  const r = read(REWARDS_KEY);
  const best = {};
  if (r.best && typeof r.best === 'object') {
    for (const [id, e] of Object.entries(r.best)) {
      if (e && Number.isFinite(e.stars) && Number.isFinite(e.score)) best[id] = { stars: e.stars, score: e.score };
    }
  }
  return { best };
}

export function saveRewards(rewards) {
  write(REWARDS_KEY, rewards);
}
