// data/rhythm.js — 박자 표준 사실(음표 길이·쉼표·박자표). notes.js/chords.js와 동일한 데이터-팩토리 패턴.
// 랜덤 0 · DOM 0 · 오디오 0 — 순수 상수 + 팩토리만.
// 표준 사실 근거: docs/00-music-theory-reference.md §5 (음가·쉼표 위치·점음표·박자표)
//
// ⚠️ 길이 산술의 단일 진실 소스는 정수 units 다. beats(0.25/0.5/1.5)는 표시·오디오용 파생값.
//    셋잇단음표(1/3)가 도입되면 마디 합산에 부동소수 오차가 생기므로, 정수 units 기준이면
//    재정의가 1곳(16분=1 → 48분=1)으로 국소화된다.

export const UNITS_PER_BEAT = 4; // 1박(♩) = 16분음표 4개
// BPM은 이 파일 전체에서 항상 ♩(4분음표) 기준. 분모가 4가 아닌 박자표는 unitSec()로 환산(audio.js).

// 리듬 보표는 음높이가 학습 변수가 아니다 → 오선 3번째 줄 고정.
// y=64 ⇒ diatonic 34 ⇒ B4 (staff.js noteToY + clefs.js treble.dvRef 30 에서 도출)
export const RHY_CLEF = 'treble';
export const RHY_PITCH = 'B4';

// k = 분할 차수. 렌더 스펙 도출 공식 (docs/00 §5-1-2):
//   value = 1/2^k · filled = (k>=2) · stem = (k>=1) · flags = max(0, k-2)
export const NOTE_VALUES = [
  { id: 'w', k: 0, units: 16, ko: '온음표', en: 'whole note', restKo: '온쉼표', restEn: 'whole rest' },
  { id: 'h', k: 1, units: 8, ko: '2분음표', en: 'half note', restKo: '2분쉼표', restEn: 'half rest' },
  { id: 'q', k: 2, units: 4, ko: '4분음표', en: 'quarter note', restKo: '4분쉼표', restEn: 'quarter rest' },
  { id: 'e', k: 3, units: 2, ko: '8분음표', en: 'eighth note', restKo: '8분쉼표', restEn: 'eighth rest' },
  { id: 's', k: 4, units: 1, ko: '16분음표', en: '16th note', restKo: '16분쉼표', restEn: '16th rest' },
];

const BY_ID = Object.fromEntries(NOTE_VALUES.map((v) => [v.id, v]));

// 점음표는 units가 정수로 유지되는 조합만 허용: w(24)·h(12)·q(6)·e(3). s(1.5)는 금지.
// 여기서 w를 뺀 것은 정수 계약이 아니라 교육과정 범위(점2분·점4분·점8분) 때문.
export const DOTTABLE = ['h', 'q', 'e'];

// 음 하나(음표 또는 쉼표)를 표현하는 표준 객체 팩토리
export function makeSymbol(valueId, { rest = false, dotted = false } = {}) {
  const v = BY_ID[valueId];
  if (!v) throw new Error('bad note value: ' + valueId); // fail-fast (makeNote 선례)
  const units = dotted ? v.units * 1.5 : v.units;
  if (!Number.isInteger(units)) throw new Error('dotted units must stay integer: ' + valueId); // 정수 불변식
  const ko = (dotted ? '점' : '') + (rest ? v.restKo : v.ko);
  const en = (dotted ? 'dotted ' : '') + (rest ? v.restEn : v.en);
  return {
    id: v.id + (dotted ? '.' : '') + (rest ? 'r' : ''), // 'q' | 'q.' | 'qr'
    valueId: v.id,
    k: v.k,
    rest,
    dotted,
    units, // 정수 — 비교·합산의 SSOT
    beats: units / UNITS_PER_BEAT,
    // 렌더 스펙 (staff.js가 소비. 유니코드 글리프 없음 — 전부 SVG 작도)
    filled: v.k >= 2,
    stem: v.k >= 1,
    flags: Math.max(0, v.k - 2),
    wideHead: v.id === 'w', // 온음표 머리는 넓고 기울지 않는다 (docs/00 §5-7)
    ko,
    en,
  };
}

// 난이도별 값 집합 — 모드 출제 풀의 기반
export const EASY_IDS = ['w', 'h', 'q', 'e']; // 박 값 {4, 2, 1, ½}
export const NORMAL_IDS = ['w', 'h', 'q', 'e', 's']; // + {¼}

// 난이도 → 기호 전체 풀 (음표 + 쉼표 + normal 한정 점음표)
// easy 8 (4음표+4쉼표) / normal 13 (5음표+5쉼표+3점음표)
export function symbolPool(difficulty) {
  const ids = difficulty === 'easy' ? EASY_IDS : NORMAL_IDS;
  const pool = [];
  for (const id of ids) pool.push(makeSymbol(id));
  for (const id of ids) pool.push(makeSymbol(id, { rest: true }));
  if (difficulty !== 'easy') for (const id of DOTTABLE) pool.push(makeSymbol(id, { dotted: true }));
  return pool;
}

// 온쉼표(4박)↔2분쉼표(2박)는 사각형이 줄 위에 앉느냐 아래에 매달리느냐만 다른 최악의 시각 혼동쌍인데,
// normal에서는 사이에 3박(점2분)이 끼어 인접 규칙에서 밀린다 → 오답으로 강제 선삽입.
// 이것이 distractor 규칙의 유일한 예외다.
export const VISUAL_PAIR = { wr: 'hr', hr: 'wr' };

// 박 라벨: ¼ ½ ¾ 1 1½ 2 3 4
const FRAC = ['', '¼', '½', '¾'];
export function beatsLabel(beats, lang = 'ko') {
  const units = Math.round(beats * UNITS_PER_BEAT);
  const whole = Math.floor(units / UNITS_PER_BEAT);
  const num = (whole ? String(whole) : '') + FRAC[units % UNITS_PER_BEAT];
  if (lang === 'en') return `${num || '0'} ${beats > 1 ? 'beats' : 'beat'}`;
  return `${num || '0'}박`;
}

// 박자표 — bottom·accents를 데이터로 두어 재생 산술과 강세 서술을 한 곳에 고정.
// accents: 2=센박(강) · 1=중강 · 0=여린박(약)  (docs/00 §5-4)
export const TIME_SIGS = [
  { id: '2/4', top: 2, bottom: 4, accents: [2, 0] },
  { id: '3/4', top: 3, bottom: 4, accents: [2, 0, 0] },
  { id: '4/4', top: 4, bottom: 4, accents: [2, 0, 1, 0] }, // 강·약·중강·약
  { id: '6/8', top: 6, bottom: 8, accents: [2, 0, 0, 1, 0, 0] }, // 겹박자 — 읽기 전용
  { id: '2/2', top: 2, bottom: 2, accents: [2, 0] }, // alla breve — 읽기 전용
];
export const TS_BY_ID = Object.fromEntries(TIME_SIGS.map((t) => [t.id, t]));

// 마디 채우기(모드 F, 백로그)는 분모 4 고정 — 6/8·2/2는 "4분음표=1박" 전제와 충돌한다.
export const BAR_TS = ['2/4', '3/4', '4/4'];

// 힌트 카피는 data에 둔다 (chords.js hint/hintEn 패턴과 통일 — modes.js 하드코딩 금지)
export const HINT_KO =
  '온 4 · 2분 2 · 4분 1 · 8분 ½ · 16분 ¼ (4분음표를 1박으로 할 때) — ' +
  '한 단계 내려갈 때마다 길이가 반. 점(·)은 앞 길이의 절반을 더해요.';
export const HINT_EN =
  'Whole 4 · half 2 · quarter 1 · eighth ½ · 16th ¼ (with a quarter note = 1 beat) — ' +
  "each step down halves the length. A dot adds half of the note's length.";

// 검증: makeSymbol('w').units===16 · makeSymbol('q').beats===1 · makeSymbol('q',{dotted:true}).units===6
//       makeSymbol('h',{dotted:true}).beats===3 · makeSymbol('s',{dotted:true}) → throw (정수 불변식)
//       symbolPool('easy').length===8 · symbolPool('normal').length===13
