// src/mascot.js — 마스코트 '싱가(Singa)': 8분음표 의인화 인라인 SVG + 표정(mood) 전환.
// 조형 계약(docs/05-character-direction.md §4·§6):
//  - 기호 원형 보존: 머리·기둥·깃발은 실제 8분음표 형태 유지 (기보 인지 훼손 금지)
//  - 표정 5종 상한(idle/happy/cheer/hmm/sleepy) — 파츠를 전부 겹쳐 두고 data-mood로 opacity 스왑
//  - 색은 --mascot-* 토큰만 (다크 모드는 styles.css 토큰이 처리)
//  - 항상 장식(aria-hidden) — 의미 전달은 텍스트 피드백(aria-live)이 담당

const SVG = 'http://www.w3.org/2000/svg';
export const MOODS = ['idle', 'happy', 'cheer', 'hmm', 'sleepy'];

function el(tag, attrs) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

const INK = 'var(--mascot-ink)';
const STROKE = { fill: 'none', stroke: INK, 'stroke-width': '2.2', 'stroke-linecap': 'round' };

// 표정 파츠 정의 — 눈은 y≈45.5, 입은 y≈51 부근(음표 머리 위)
const FACES = {
  idle: [
    ['circle', { cx: 20.5, cy: 45.5, r: 2.8, fill: INK, class: 'mascot-eye' }],
    ['circle', { cx: 31.5, cy: 45.5, r: 2.8, fill: INK, class: 'mascot-eye' }],
  ],
  happy: [
    ['path', { d: 'M17.5 46.2 Q20.5 43.2 23.5 46.2', ...STROKE }],
    ['path', { d: 'M28.5 46.2 Q31.5 43.2 34.5 46.2', ...STROKE }],
    ['path', { d: 'M23.8 51.4 Q26 53.2 28.2 51.4', ...STROKE, 'stroke-width': '2' }],
  ],
  cheer: [
    ['path', { d: 'M17.5 46.2 Q20.5 43 23.5 46.2', ...STROKE }],
    ['path', { d: 'M28.5 46.2 Q31.5 43 34.5 46.2', ...STROKE }],
    ['path', { d: 'M22.5 50.5 Q26 55 29.5 50.5 Z', fill: INK }],
  ],
  hmm: [
    ['path', { d: 'M18 45.8 L23 46.4', ...STROKE }],
    ['path', { d: 'M29 46.4 L34 45.8', ...STROKE }],
    ['circle', { cx: 26, cy: 52, r: 1.5, fill: 'none', stroke: INK, 'stroke-width': '1.8' }],
  ],
  sleepy: [
    ['path', { d: 'M17.5 44.8 Q20.5 47.4 23.5 44.8', ...STROKE }],
    ['path', { d: 'M28.5 44.8 Q31.5 47.4 34.5 44.8', ...STROKE }],
  ],
};

export function createMascot({ mood = 'idle', size = 64 } = {}) {
  const svg = el('svg', {
    class: 'mascot' + (size < 44 ? ' mascot--sm' : ''), // 소형은 볼터치 제거(판독 우선)
    viewBox: '0 0 64 64',
    width: size,
    height: size,
    'data-mood': MOODS.includes(mood) ? mood : 'idle',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  // 몸통: 기둥 → 깃발 → 머리 순 (머리가 기둥 밑단을 덮음)
  svg.append(
    el('path', { d: 'M38.5 47 L38.5 9', stroke: 'var(--mascot-body)', 'stroke-width': '3.4', 'stroke-linecap': 'round', fill: 'none' }),
    el('path', { d: 'M38.5 9 C 47.5 12.5, 52 20, 48.5 29 C 48.5 21.5, 44.5 16.5, 38.5 16.5 Z', fill: 'var(--mascot-body)' }),
    el('ellipse', { cx: 26, cy: 47, rx: 13.5, ry: 10.5, fill: 'var(--mascot-body)', transform: 'rotate(-14 26 47)' }),
    el('ellipse', { class: 'mascot-cheek', cx: 16.5, cy: 50, rx: 2.6, ry: 1.7 }),
    el('ellipse', { class: 'mascot-cheek', cx: 35.5, cy: 50, rx: 2.6, ry: 1.7 })
  );
  for (const [name, parts] of Object.entries(FACES)) {
    const g = el('g', { 'data-face': name });
    for (const [tag, attrs] of parts) g.appendChild(el(tag, attrs));
    svg.appendChild(g);
  }
  return svg;
}

// 결과 화면 축하 컨페티 — 만점·신기록·첫 클리어 한정(docs/05 §2 빈도 반비례 법칙).
// canvas 1개 + 음표 글리프, ~2.2초 후 자체 정리. reduced-motion이면 no-op.
export function celebrateNotes() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.querySelector('.confetti')) return; // 중복 실행 방지
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.body);
  const palette = ['--brand', '--hint', '--ok', '--mascot-cheek'].map((k) => css.getPropertyValue(k).trim() || '#2f6bff');
  const GLYPHS = ['♪', '♫', '♩'];
  const parts = Array.from({ length: 70 }, () => ({
    x: Math.random() * canvas.width,
    y: -30 - Math.random() * canvas.height * 0.4, // 화면 위쪽 밖에서 낙하 시작
    vy: 2 + Math.random() * 2.5,
    vx: -0.8 + Math.random() * 1.6,
    rot: Math.random() * Math.PI * 2,
    vr: -0.06 + Math.random() * 0.12,
    size: 14 + Math.random() * 14,
    color: palette[(Math.random() * palette.length) | 0],
    glyph: GLYPHS[(Math.random() * GLYPHS.length) | 0],
  }));
  const t0 = performance.now();
  requestAnimationFrame(function frame(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.font = `${p.size}px system-ui`;
      ctx.fillText(p.glyph, 0, 0);
      ctx.restore();
    }
    if (t - t0 < 2200 && canvas.isConnected) requestAnimationFrame(frame);
    else canvas.remove();
  });
}
