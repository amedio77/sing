// src/staff.js — SVG 오선/음표 렌더러. createElementNS로 생성(재렌더·이벤트·접근성 용이).
// 음→y 좌표는 diatonic step 하나로 계산: y = BASE_Y - (dv - dvRef) * HALF.

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

// 음표 머리(notehead) + 덧줄 + 접근성 title
export function drawNote(note, clef, { highlight = false } = {}) {
  const y = noteToY(note, clef);
  const g = el('g', { class: 'notehead-group', role: 'img' });

  // 접근성 라벨: "높은음자리표 셋째 줄, 시 B"
  const title = el('title');
  title.textContent = `${clef.nameKo} · ${note.solfege}(${note.english})`;
  g.appendChild(title);

  // 오선 밖이면 덧줄
  if (y < 40 || y > 88) {
    for (const ly of ledgerYs(y)) {
      g.appendChild(
        el('line', {
          x1: NOTE_X - 13,
          y1: ly,
          x2: NOTE_X + 13,
          y2: ly,
          stroke: 'var(--ink)',
          'stroke-width': 1.4,
          'stroke-linecap': 'round',
        })
      );
    }
  }

  const fill = highlight ? 'var(--brand)' : 'var(--ink)';
  g.appendChild(
    el('ellipse', {
      cx: NOTE_X,
      cy: y,
      rx: 8,
      ry: 6,
      transform: `rotate(-20 ${NOTE_X} ${y})`,
      fill,
    })
  );
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
