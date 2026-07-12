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
