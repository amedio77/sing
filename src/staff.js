// src/staff.js — SVG 오선/음표 렌더러. createElementNS로 생성(재렌더·이벤트·접근성 용이).
// 음→y 좌표는 diatonic step 하나로 계산: y = BASE_Y - (dv - dvRef) * HALF.

import { LETTER_STEP } from '../data/notes.js';

const SVG = 'http://www.w3.org/2000/svg';

// 좌표계 (설계 §5.1)
const VB_W = 320;
const VB_H = 140; // 세로는 오선+덧줄 여유만큼만 (원 설계 200 → MVP 축소)
const STAFF_LEFT = 70;
const STAFF_RIGHT = 300;
const SPACE = 12; // 인접 줄 간격
const HALF = 6; // 반 칸 = 한 diatonic step = SPACE/2
const NOTE_X = 190; // 문제당 음표 1개, 가로 위치
const BASE_Y = 88; // 맨 아래 줄(line 1)의 y
const LINE_YS = [40, 52, 64, 76, 88]; // 줄5..줄1 (위→아래로 그리지만 값은 표준)

// dv = octave*7 + LETTER_STEP[letter]. y = BASE_Y - (dv - dvRef) * HALF
export function noteToY(note, clef) {
  return BASE_Y - (note.diatonic - clef.dvRef) * HALF;
}

// 덧줄 y 후보: 위 = 28,16… / 아래 = 100,112…
export function ledgerYs(yNote) {
  const ys = [];
  for (let y = 28; y >= yNote - 1; y -= 12) ys.push(y); // 위쪽
  for (let y = 100; y <= yNote + 1; y += 12) ys.push(y); // 아래쪽
  return ys;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of [].concat(children)) node.appendChild(c);
  return node;
}

// 덧줄 한 줄 (음표중심 ±13)
function ledgerLine(cx, y) {
  return el('line', {
    x1: cx - 13,
    y1: y,
    x2: cx + 13,
    y2: y,
    stroke: 'var(--ink)',
    'stroke-width': 1.4,
    'stroke-linecap': 'round',
  });
}

// 임시표 글리프 (유니코드 ♯/♭/♮ — 일반 폰트에서 안정적)
const ACC_GLYPH = { '-2': '♭♭', '-1': '♭', 0: '', 1: '♯', 2: '♯♯' };
function drawAccidental(x, y, acc) {
  const g = ACC_GLYPH[acc] ?? '';
  if (!g) return null;
  const t = el('text', {
    x,
    y,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    'font-size': 22,
    fill: 'var(--ink)',
    class: 'accidental',
    'aria-hidden': 'true',
  });
  t.textContent = g;
  return t;
}

// tone(음/화음구성음) → diatonic 값 (chords tone엔 diatonic이 있고, 없으면 letter/octave로 계산)
function toneDv(t) {
  return t.diatonic ?? t.octave * 7 + LETTER_STEP[t.letter];
}

// 5줄 + 음자리표 기호
export function drawStaff(clef) {
  const g = el('g', { class: 'staff-lines' });
  for (const y of LINE_YS) {
    g.appendChild(
      el('line', {
        x1: STAFF_LEFT,
        y1: y,
        x2: STAFF_RIGHT,
        y2: y,
        stroke: 'var(--ink)',
        'stroke-width': 1.4,
        'stroke-linecap': 'round',
      })
    );
  }
  // 음자리표 기호: 유니코드 글리프를 <text>로 (무빌드·간단). 오선 중앙 정렬.
  const glyph = el(
    'text',
    {
      x: 34,
      y: 64,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': clef.id === 'treble' ? 66 : 44,
      fill: 'var(--ink)',
      class: 'clef-glyph',
      'aria-hidden': 'true',
    },
    []
  );
  glyph.textContent = clef.glyph;
  g.appendChild(glyph);
  return g;
}

// 음표 머리(notehead) + 임시표 + 덧줄 + 접근성 title
export function drawNote(note, clef, { highlight = false } = {}) {
  const y = noteToY(note, clef);
  const acc = note.acc ?? note.accidental ?? 0; // makeNote=accidental, chord tone=acc 정규화
  const g = el('g', { class: 'notehead-group', role: 'img' });

  const title = el('title');
  title.textContent = `${clef.nameKo} · ${note.solfege ?? ''}(${note.english ?? ''})`;
  g.appendChild(title);

  // 오선 밖이면 덧줄
  if (y < 40 || y > 88) for (const ly of ledgerYs(y)) g.appendChild(ledgerLine(NOTE_X, ly));

  // 임시표 (음표 머리 왼쪽)
  if (acc) { const a = drawAccidental(NOTE_X - 20, y, acc); if (a) g.appendChild(a); }

  const fill = highlight ? 'var(--brand)' : 'var(--ink)';
  g.appendChild(el('ellipse', { cx: NOTE_X, cy: y, rx: 8, ry: 6, transform: `rotate(-20 ${NOTE_X} ${y})`, fill }));
  return g;
}

// 화음 렌더: 같은 x에 음표 머리를 쌓고, 임시표는 세로 근접 시 왼쪽으로 stagger
export function drawChord(tones, clef, { highlight = false } = {}) {
  const g = el('g', { role: 'img' });
  const title = el('title');
  title.textContent = tones.map((t) => t.english).join(' ');
  g.appendChild(title);

  const items = tones.map((t) => ({ y: noteToY({ diatonic: toneDv(t) }, clef), acc: t.acc ?? t.accidental ?? 0 }));

  // 덧줄 (전 음표 합집합, 중복 제거)
  const ledgers = new Set();
  for (const it of items) if (it.y < 40 || it.y > 88) for (const ly of ledgerYs(it.y)) ledgers.add(ly);
  for (const ly of ledgers) g.appendChild(ledgerLine(NOTE_X, ly));

  // 임시표 (세로 16px 이내 근접하면 x를 왼쪽으로 밀어 겹침 방지)
  const accs = items.filter((it) => it.acc).sort((a, b) => a.y - b.y);
  let lastY = -999;
  let slot = 0;
  for (const it of accs) {
    slot = Math.abs(it.y - lastY) < 16 ? slot + 1 : 0;
    lastY = it.y;
    const a = drawAccidental(NOTE_X - 18 - slot * 12, it.y, it.acc);
    if (a) g.appendChild(a);
  }

  // 음표 머리
  const fill = highlight ? 'var(--brand)' : 'var(--ink)';
  for (const it of items) g.appendChild(el('ellipse', { cx: NOTE_X, cy: it.y, rx: 8, ry: 6, transform: `rotate(-20 ${NOTE_X} ${it.y})`, fill }));
  return g;
}

// 조표(key signature) — 높은음자리표 표준 위치 (SHARP_ORDER / FLAT_ORDER 순서 동일 인덱스)
const KEYSIG_POS = {
  '#': [['F', 5], ['C', 5], ['G', 5], ['D', 5], ['A', 4], ['E', 5], ['B', 4]],
  b: [['B', 4], ['E', 5], ['A', 4], ['D', 5], ['G', 4], ['C', 5], ['F', 4]],
};

export function drawKeySignature(sign, count, clef, { showNext = false } = {}) {
  const g = el('g', {});
  const positions = KEYSIG_POS[sign] || KEYSIG_POS['#'];
  const glyph = sign === 'b' ? '♭' : '♯';
  const startX = 78;
  const stepX = 16;
  const yOf = ([letter, oct]) => noteToY({ diatonic: oct * 7 + LETTER_STEP[letter] }, clef);
  for (let i = 0; i < count && i < positions.length; i++) {
    const t = drawAccidental(startX + i * stepX, yOf(positions[i]), sign === 'b' ? -1 : 1);
    if (t) g.appendChild(t);
  }
  // 다음 조표 자리에 옅은 '?' 표시
  if (showNext && count < positions.length) {
    const q = el('text', {
      x: startX + count * stepX,
      y: yOf(positions[count]),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': 20,
      fill: 'var(--brand)',
      'font-weight': '700',
      'aria-hidden': 'true',
    });
    q.textContent = '?';
    g.appendChild(q);
  }
  return g;
}

// 오선(+선택적 음표)을 담은 완성된 <svg> 엘리먼트 반환
export function createStaffSVG(clef, note = null, opts = {}) {
  const svg = el('svg', {
    class: 'staff',
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
  });
  svg.appendChild(drawStaff(clef));
  if (note) svg.appendChild(drawNote(note, clef, opts));
  return svg;
}

// 오선 + 화음(쌓인 음표)
export function createChordSVG(tones, clef, opts = {}) {
  const svg = el('svg', { class: 'staff', viewBox: `0 0 ${VB_W} ${VB_H}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' });
  svg.appendChild(drawStaff(clef));
  svg.appendChild(drawChord(tones, clef, opts));
  return svg;
}

// 오선 + 조표(표준 위치). clef는 표준 관례상 높은음자리표.
export function createKeySigSVG(sign, count, clef, opts = {}) {
  const svg = el('svg', { class: 'staff', viewBox: `0 0 ${VB_W} ${VB_H}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' });
  svg.appendChild(drawStaff(clef));
  svg.appendChild(drawKeySignature(sign, count, clef, opts));
  return svg;
}

// ════════════════════════════════════════════════════════════════
// 리듬 표기 (음표 길이·쉼표·박자표) — 위 9개 export는 무수정.
// 유니코드 음악 기호를 쓰지 않는다: U+1D1xx(SMP) 미지원 폰트에서 쉼표가 tofu가 되면
// 문항 자체가 소실된다. 전부 SVG 작도 + currentColor(색은 CSS 토큰이 처리).
// 표준 사실 근거: docs/00-music-theory-reference.md §5
// ════════════════════════════════════════════════════════════════

const RHY_Y = 64; // 리듬 음높이 = 3번째 줄 고정 (= B4/treble). 음높이는 학습 변수가 아니다
const STEM_LEN = 42; // 3.5 × SPACE = 1옥타브 = 표준 기둥 길이 (docs/00 §5-1-4)
const SYM_X = 185; // 기호 1개 문항의 가로 중앙
const TS_X = 88; // 박자표 x (조표 startX 78 인근)
const SLOT_STEP = 41.25; // 마디 내 균등 간격 — 비례 간격은 폭 눈대중으로 박 합산을 우회시킨다
const SLOT_MID = 202.5; // (120 + 285) / 2
const MAX_SLOTS = 5;

// 음표 머리. 채움/빈은 길이만 나타내며 음높이와 무관하다(docs/00 §5-1-2).
// 배경색 채우기 금지 — 오선 줄 위에서 배경이 어긋난다.
function noteHead(cx, cy, hollow, wide) {
  const a = { class: 'nh', cx, cy, rx: wide ? 11 : 8, ry: 6 };
  if (!wide) a.transform = `rotate(-20 ${cx} ${cy})`; // 온음표 머리는 넓고 기울지 않는다
  if (hollow) {
    a.fill = 'none';
    a.stroke = 'currentColor';
    a['stroke-width'] = 2.2;
  } else a.fill = 'currentColor';
  return el('ellipse', a);
}

// 기둥 x: 아래 기둥이면 머리 왼쪽, 위 기둥이면 오른쪽
const stemX = (cx, down) => (down ? cx - 7.4 : cx + 7.4);
const stemEndY = (cy, down) => (down ? cy + STEM_LEN : cy - STEM_LEN);

function stemLine(cx, cy, down) {
  const x = stemX(cx, down);
  return el('line', {
    x1: x,
    y1: cy,
    x2: x,
    y2: stemEndY(cy, down),
    stroke: 'currentColor',
    'stroke-width': 1.8,
    'stroke-linecap': 'round',
  });
}

// 꼬리(flag) — mascot.js의 8분음표 깃발 베지어를 원점 정규화해 유도(조형 일관, 수치 재작도 금지).
// 위 기둥 1벌만 작도하고, 아래 기둥은 기둥 끝을 축으로 상하반전(x 보존)한다(docs/00 §5-1-5).
const FLAG_D = 'M0 0 C 9 3.5, 13.5 11, 10 20 C 10 12.5, 6 7.5, 0 7.5 Z';
const FLAG_S = 0.9;
function flagGroup(cx, cy, down, n) {
  const g = el('g', { class: 'fl' });
  const x = stemX(cx, down);
  const yEnd = stemEndY(cy, down);
  for (let i = 0; i < n; i++) {
    const y = down ? yEnd - i * 8 : yEnd + i * 8; // 2번째 꼬리는 머리 쪽으로
    const s = down ? `scale(${FLAG_S} ${-FLAG_S})` : `scale(${FLAG_S})`;
    g.appendChild(el('path', { d: FLAG_D, transform: `translate(${x} ${y}) ${s}`, fill: 'currentColor' }));
  }
  return g;
}

// 부점 — 머리가 줄 위면 바로 위 칸(docs/00 §5-3)
const augDot = (cx, cy, wide) => el('circle', { cx: cx + (wide ? 18 : 15), cy: cy - HALF, r: 2.2, fill: 'currentColor' });

// 쉼표 path는 상수로 분리 — 실물과 다르면 로직 무수정으로 d 만 교체할 수 있다.
// 좌표는 기호 중심 x=0 기준이며 y는 오선 절대값(LINE_YS = 40/52/64/76/88).
export const REST_PATHS = {
  quarter: {
    zig: 'M -4.2 50 L 4.4 60 L -3.6 68.6 L 4 77',
    hook: 'M 4 77 C 0.8 75.2, -3.6 76.4, -3.3 79.6 C -3.05 82.1, -0.4 83, 1.6 81.8',
  },
  eighth: {
    stem: 'M 5.2 55.6 L -3.2 76',
    hook: 'M 5.2 55.6 C 2.6 59.6, -0.2 60.2, -2.2 58.6',
    dots: [[-3.6, 56.8]],
  },
  sixteenth: {
    stem: 'M 6 55.6 L -4.4 84',
    hook: 'M 6 55.6 C 3.4 59.6, 0.6 60.2, -1.4 58.6 M 1.7 67.4 C -0.9 71.4, -3.7 72, -5.7 70.4',
    dots: [
      [-2.8, 56.8],
      [-7.1, 68.6],
    ],
  },
};
const REST_KEY = { q: 'quarter', e: 'eighth', s: 'sixteenth' };

// 온쉼표 = 4번 줄(y52)에 매달려 아래로 / 2분쉼표 = 3번 줄(y64) 위에 앉음 — 이 구분이 학습 항목이다
function restShape(valueId, cx) {
  const g = el('g', { class: 'rest', transform: `translate(${cx} 0)` });
  if (valueId === 'w' || valueId === 'h') {
    g.appendChild(el('rect', { x: -9, y: valueId === 'w' ? 52 : 58, width: 18, height: 6, fill: 'currentColor' }));
    return g;
  }
  const P = REST_PATHS[REST_KEY[valueId]];
  const line = (d, w) =>
    el('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  if (valueId === 'q') {
    g.appendChild(line(P.zig, 3.2));
    g.appendChild(line(P.hook, 2.2));
    return g;
  }
  g.appendChild(line(P.stem, 2.4));
  g.appendChild(line(P.hook, 1.8));
  for (const [dx, dy] of P.dots) g.appendChild(el('circle', { cx: dx, cy: dy, r: 2.9, fill: 'currentColor' }));
  return g;
}

// 박자표 — 숫자 두 개. <text> 이지만 아라비아 숫자라 폰트 리스크 0
function drawTimeSig(ts, x) {
  const g = el('g', { class: 'timesig' });
  for (const [val, y] of [
    [ts.top, 52],
    [ts.bottom, 76],
  ]) {
    const t = el('text', {
      x,
      y,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': 26,
      'font-weight': '700',
      fill: 'var(--ink)',
      'aria-hidden': 'true',
    });
    t.textContent = String(val);
    g.appendChild(t);
  }
  return g;
}

// 마디 빈칸 — createKeySigSVG showNext 의 '?' 선례
function drawSlot(x) {
  const g = el('g', { class: 'slot' });
  g.appendChild(
    el('rect', {
      x: x - 16,
      y: 46,
      width: 32,
      height: 36,
      rx: 6,
      fill: 'none',
      stroke: 'var(--brand)',
      'stroke-width': 1.6,
      'stroke-dasharray': '4 3',
    })
  );
  const t = el('text', {
    x,
    y: 64,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    'font-size': 20,
    'font-weight': '700',
    fill: 'var(--brand)',
    'aria-hidden': 'true',
  });
  t.textContent = '?';
  g.appendChild(t);
  return g;
}

// item: { sym } | { blank:true }. 리듬 보표는 3번 줄 고정이라 기둥은 항상 아래.
function drawRhythmItem(item, cx, i) {
  const g = el('g', { class: 'rhy-item', 'data-i': i });
  if (item.blank) {
    g.appendChild(drawSlot(cx));
    return g;
  }
  const sym = item.sym;
  if (sym.rest) {
    g.appendChild(restShape(sym.valueId, cx));
    if (sym.dotted) g.appendChild(augDot(cx, RHY_Y, false));
    return g;
  }
  if (sym.stem) g.appendChild(stemLine(cx, RHY_Y, true));
  if (sym.flags) g.appendChild(flagGroup(cx, RHY_Y, true, sym.flags));
  g.appendChild(noteHead(cx, RHY_Y, !sym.filled, sym.wideHead)); // 머리를 마지막에 — 기둥 밑동을 덮는다
  if (sym.dotted) g.appendChild(augDot(cx, RHY_Y, sym.wideHead));
  return g;
}

// aria: label 이 있으면 role=img(문제 자극 — aria-hidden 금지), 없으면 장식(보기 버튼 내부).
function ariaOn(svg, label) {
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else svg.setAttribute('aria-hidden', 'true');
}

// 기호 1개. compact 는 보기 버튼용 크롭 — 오선 3·4번 줄은 반드시 남긴다
// (온쉼표 '매달림' vs 2분쉼표 '얹힘' 변별이 보기 버튼에서도 성립해야 한다).
export function createSymbolSVG(sym, clef, { compact = false, label = null, highlight = false } = {}) {
  const svg = el('svg', {
    class: 'staff' + (compact ? ' compact' : ''),
    viewBox: compact ? '135 24 100 96' : `0 0 ${VB_W} ${VB_H}`,
    preserveAspectRatio: 'xMidYMid meet',
  });
  ariaOn(svg, label);
  const staff = drawStaff(clef);
  // compact 크롭(x 135~235)은 자리표 글리프(x=34)를 화면 밖으로 밀어낼 뿐 DOM에는 남긴다.
  // 보이지도 않는 SMP 글리프를 보기 버튼마다 심을 이유가 없어 제거한다(drawStaff 자체는 무수정).
  if (compact) staff.querySelector('.clef-glyph')?.remove();
  svg.appendChild(staff);
  const item = drawRhythmItem({ sym }, SYM_X, 0);
  if (highlight) item.setAttribute('class', 'rhy-item is-on');
  svg.appendChild(item);
  return svg;
}

// 마디. items 는 최대 MAX_SLOTS 개, 균등 간격으로 중앙 정렬.
export function createRhythmSVG(items, clef, { ts = null, showBarline = true, label = null, highlightIndex = -1 } = {}) {
  const svg = el('svg', { class: 'staff', viewBox: `0 0 ${VB_W} ${VB_H}`, preserveAspectRatio: 'xMidYMid meet' });
  ariaOn(svg, label);
  svg.appendChild(drawStaff(clef));
  if (ts) svg.appendChild(drawTimeSig(ts, TS_X));
  const n = Math.min(items.length, MAX_SLOTS);
  const x0 = SLOT_MID - ((n - 1) * SLOT_STEP) / 2;
  for (let i = 0; i < n; i++) {
    const g = drawRhythmItem(items[i], x0 + i * SLOT_STEP, i);
    if (i === highlightIndex) g.setAttribute('class', 'rhy-item is-on');
    svg.appendChild(g);
  }
  if (showBarline)
    svg.appendChild(el('line', { x1: STAFF_RIGHT, y1: LINE_YS[0], x2: STAFF_RIGHT, y2: LINE_YS[4], stroke: 'var(--ink)', 'stroke-width': 1.8 }));
  return svg;
}

// 시각 박 — SVG 밖 HTML. 소리 없이도 박이 흐르게 하는 청각 비의존 채널.
export function beatPips(n) {
  const wrap = document.createElement('div');
  wrap.className = 'beat-pips';
  wrap.setAttribute('aria-hidden', 'true'); // 낭독 폭주 방지. 의미는 프롬프트·힌트가 전달
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span');
    p.className = 'beat-pip';
    wrap.appendChild(p);
  }
  return wrap;
}

// 재생 시각 동기화. setTimeout 을 쓰지 않고 rAF가 오디오 클럭을 폴링한다 —
// 두 독립 타이머를 돌리면 오디오(샘플 정확)와 시각(지터 상한 없음)이 어긋나고,
// BPM 100의 16분음표(150ms)에서는 그 어긋남이 눈에 띈다. 백그라운드 복귀 시 자동 재동기.
// clock() 이 null 을 주면(Web Audio 미지원) 호출부가 performance.now 폴백을 넘긴다.
export function syncPlayback(root, { t0, beatSec, nBeats, clock, counterEl = null }) {
  const noop = () => {};
  if (!root || t0 == null || !beatSec) return noop;
  const pips = [...root.querySelectorAll('.beat-pip')];
  const end = t0 + nBeats * beatSec + 0.15;
  let raf = 0;
  let last = -2;
  const clear = () => {
    cancelAnimationFrame(raf);
    for (const p of pips) p.classList.remove('is-on');
    for (const n of root.querySelectorAll('.rhy-item')) n.classList.remove('is-on');
  };
  const tick = () => {
    const t = clock();
    if (t == null || !root.isConnected || t > end) return clear(); // 화면 이탈 시 자체 정리(mascot.js 선례)
    const i = Math.floor((t - t0) / beatSec);
    if (i !== last) {
      last = i;
      pips.forEach((p, k) => p.classList.toggle('is-on', k === i));
      if (counterEl && i >= 0) counterEl.textContent = `${Math.min(i + 1, nBeats)} / ${nBeats}`;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return clear;
}
