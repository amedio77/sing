// src/learn.js — 모드별 사전 학습 화면. 음악 사실은 data/, 렌더는 staff.js, 소리는 audio.js 재사용.
// 원칙: ① 위치=이름=소리 삼중 일치(모든 인터랙션이 셋을 한 제스처에 묶음)
//       ② 페이지당 섹션 3개 이하 + 심화는 details + 하단 CTA
//       ③ 탐색 인터랙션은 로컬 DOM 갱신(setState 아님 — 볼륨 슬라이더 선례). 전역 state는 변경하지 않는다.

import { getState, startQuiz } from './game.js';
import { h, segmented, appBar } from './ui.js';
import { t, noteLabel, letterLabel } from './i18n.js';
import { createStaffSVG, createChordSVG, createKeySigSVG, noteToY } from './staff.js';
import { playNote, playChord, playSequence } from './audio.js';
import { CLEFS } from '../data/clefs.js';
import { LETTERS, SOLFEGE, makeNote } from '../data/notes.js';
import {
  SHARP_ORDER,
  FLAT_ORDER,
  SHARP_KEYS,
  FLAT_KEYS,
  SHARP_MNEMONIC_KO,
  SHARP_MNEMONIC_EN,
  FLAT_MNEMONIC_KO,
  FLAT_MNEMONIC_EN,
  KEY_RULES,
} from '../data/keys.js';
import { CHORD_QUALITIES, makeChord } from '../data/chords.js';
import { saveProgress } from './storage.js';

const app = () => document.getElementById('app');
const lang = () => getState().lang;
function ordinalEn(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
// 시퀀스 재생 버튼: 실재생 시간만큼 disabled (연타로 소리 겹침 방지)
function seqButton(label, notes, gapMs = 350, durMs = 300) {
  const btn = h(
    'button',
    {
      class: 'btn ghost listen',
      onclick: () => {
        btn.disabled = true;
        playSequence(notes(), gapMs, durMs);
        setTimeout(() => (btn.disabled = false), (notes().length - 1) * gapMs + durMs + 100);
      },
    },
    label
  );
  return btn;
}

// ── 라우터 진입점 ─────────────────────────────────────
export function renderLearn(state, mode) {
  window.onkeydown = null; // 퀴즈 키 핸들러 잔존 방지 (숫자키가 이전 퀴즈에 답 제출하는 버그 차단)
  if (!mode) {
    location.hash = '#/menu';
    return;
  }
  // 방문 기록(NEW 배지 해제) — 직접 대입 + 영속화, 재렌더 불필요
  if (!state.learnSeen[mode.id]) {
    state.learnSeen[mode.id] = true;
    saveProgress({ learnSeen: state.learnSeen });
  }

  const main = h('main', { class: 'learn' }, h('h1', { class: 'learn-title' }, '📖 ' + t('learn') + ' · ' + t(mode.name)));
  const builders = {
    'clef-position': learnClef,
    'note-matching': learnMatching,
    'key-order': learnKeyOrder,
    chord: learnChord,
  };
  builders[mode.id](state, main);

  main.appendChild(
    h(
      'div',
      { class: 'learn-cta' },
      h(
        'button',
        {
          class: 'btn primary',
          onclick: () => {
            startQuiz(mode);
            location.hash = '#/mode/' + mode.id;
          },
        },
        t('startQuizNow')
      )
    )
  );

  app().replaceChildren(appBar(state, { backAction: () => (location.hash = '#/menu') }), main);
}

// ── 모드 A: 오선 인터랙티브 탐색 ──────────────────────
function learnClef(state, main) {
  // clef는 로컬 격리 — 전역 state.clef('both' 포함)를 덮어쓰지 않는다. 'both'면 treble 기본 표시.
  let clefId = state.clef === 'bass' ? 'bass' : 'treble';
  const sec = h('div', { class: 'learn-sec' });
  main.appendChild(sec);

  // 탐색 위치: 오선 안 9자리(줄5+칸4) + 가온다(덧줄). 데이터는 clefs.js 그대로.
  function positions(clef) {
    const list = [];
    clef.lines.forEach(([l, o], i) => list.push({ letter: l, oct: o, kind: 'line', idx: i }));
    clef.spaces.forEach(([l, o], i) => list.push({ letter: l, oct: o, kind: 'space', idx: i }));
    list.push({ letter: 'C', oct: 4, kind: 'midc' }); // 두 자리표 공유음
    return list;
  }
  function posDesc(p) {
    if (p.kind === 'midc') return lang() === 'ko' ? '가온다 (덧줄)' : 'middle C (ledger line)';
    const word = t(p.kind === 'line' ? 'lineWord' : 'spaceWord');
    return lang() === 'ko' ? `${p.idx + 1}번째 ${word}` : `${ordinalEn(p.idx + 1)} ${word}`;
  }

  function render() {
    const clef = CLEFS[clefId];
    const label = h('p', { class: 'learn-note-label', 'aria-live': 'polite' }, t('tapLineOrSpace'));
    const staffBox = h('div', { class: 'learn-staff' });

    function drawExploreStaff(note) {
      const svg = createStaffSVG(clef, note, { highlight: true });
      // 투명 클릭밴드(시각 탐색 보조 — 접근성 1급 경로는 아래 칩 버튼)
      for (const p of positions(clef)) {
        const y = noteToY(makeNote(p.letter, p.oct), clef);
        const band = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        band.setAttribute('x', '70');
        band.setAttribute('y', String(y - 3));
        band.setAttribute('width', '230');
        band.setAttribute('height', '6');
        band.setAttribute('fill', 'transparent');
        band.style.cursor = 'pointer';
        band.addEventListener('click', () => pick(p));
        svg.appendChild(band);
      }
      return svg;
    }
    function pick(p) {
      const note = makeNote(p.letter, p.oct);
      staffBox.replaceChildren(drawExploreStaff(note));
      label.textContent = `${noteLabel(note)} — ${posDesc(p)}`; // 이름 + 위치
      playNote(p.letter + p.oct); // + 소리 = 삼중 일치
    }
    staffBox.appendChild(drawExploreStaff(null));

    const chipOf = (p) =>
      h('button', { class: 'chip', onclick: () => pick(p) }, letterLabel(p.letter) + (p.kind === 'midc' ? ' 🔸' : ''));
    const lines = positions(clef).filter((p) => p.kind === 'line');
    const spaces = positions(clef).filter((p) => p.kind === 'space');
    const midc = positions(clef).find((p) => p.kind === 'midc');

    sec.replaceChildren(
      h(
        'div',
        { class: 'learn-seg-row' },
        segmented(
          [
            { value: 'treble', label: t('treble') },
            { value: 'bass', label: t('bass') },
          ],
          clefId,
          (v) => {
            clefId = v; // 로컬만 변경
            render();
          },
          t('clef')
        )
      ),
      staffBox,
      label,
      h('div', { class: 'learn-row' }, h('span', { class: 'learn-seg-label' }, t('lineWord')), lines.map(chipOf)),
      h('div', { class: 'learn-row' }, h('span', { class: 'learn-seg-label' }, t('spaceWord')), spaces.map(chipOf), chipOf(midc)),
      h(
        'div',
        { class: 'learn-card' },
        h('div', { class: 'learn-card-title' }, '💡 ' + t('mnemonic')),
        h('p', {}, `${t('lineWord')}: ${clef.mnemonicLinesKo} · ${clef.mnemonicLinesEn}`),
        h('p', {}, `${t('spaceWord')}: ${clef.mnemonicSpacesKo} · ${clef.mnemonicSpacesEn}`)
      ),
      h(
        'details',
        { class: 'hint' },
        h('summary', {}, '🔸 ' + t('middleCTitle')),
        h(
          'div',
          { class: 'hint-body' },
          h('p', {}, t('middleCDesc')),
          h('button', { class: 'btn ghost listen', onclick: () => playNote('C4') }, t('listenMiddleC'))
        )
      )
    );
  }
  render();
}

// ── 모드 B: 도레미 ↔ CDE 카드 ─────────────────────────
function learnMatching(state, main) {
  // 자리표 로컬 토글 — 계이름↔글자 암기는 자리표 무관(퀴즈는 treble 고정)이지만,
  // 같은 계이름이 낮은음자리표에선 어디 놓이는지도 함께 학습한다.
  let clefId = 'treble';
  const sec = h('div', { class: 'learn-sec' });
  main.appendChild(sec);

  function render() {
    const clef = CLEFS[clefId];
    const baseOct = clefId === 'treble' ? 4 : 3; // bass는 C3~B3가 오선 안팎에 자연스럽게 놓임
    const staffBox = h('div', { class: 'learn-staff' }, createStaffSVG(clef));
    const label = h('p', { class: 'learn-note-label', 'aria-live': 'polite' }, t('tapLineOrSpace'));

    function cardFor(letter, oct, cycle = false) {
      const note = makeNote(letter, oct);
      return h(
        'button',
        {
          class: 'learn-note-card' + (cycle ? ' cycle' : ''),
          onclick: () => {
            staffBox.replaceChildren(createStaffSVG(clef, note, { highlight: true }));
            label.textContent = `${SOLFEGE[letter]} · ${letter}${oct}`;
            playNote(letter + oct);
          },
        },
        h('span', { class: 'lc-solfege' }, (cycle ? '(' : '') + SOLFEGE[letter] + (cycle ? ') ↺' : '')),
        h('span', { class: 'lc-letter' }, letter + oct)
      );
    }
    const cards = [...LETTERS.map((l) => cardFor(l, baseOct)), cardFor('C', baseOct + 1, true)]; // 8번째 = 옥타브 순환

    sec.replaceChildren(
      h(
        'div',
        { class: 'learn-seg-row' },
        segmented(
          [
            { value: 'treble', label: t('treble') },
            { value: 'bass', label: t('bass') },
          ],
          clefId,
          (v) => {
            clefId = v; // 로컬만 변경
            render();
          },
          t('clef')
        )
      ),
      staffBox,
      label,
      h('div', { class: 'learn-cards' }, cards),
      seqButton(t('playInOrder'), () => [...LETTERS.map((l) => l + baseOct), 'C' + (baseOct + 1)]),
      h(
        'div',
        { class: 'learn-card' },
        h('div', { class: 'learn-card-title' }, '💡 ' + t('fixedDoTitle')),
        h('p', {}, t('fixedDoDesc')),
        h('p', {}, t('octaveCycleDesc'))
      )
    );
  }
  render();
}

// ── 모드 C: 조표 순서 스테퍼 ──────────────────────────
function learnKeyOrder(state, main) {
  let sign = '#';
  let n = 0; // 0 = 조표 없음(C장조) — 기준선부터 학습
  const sec = h('div', { class: 'learn-sec' });
  main.appendChild(sec);

  function render(playNew = false) {
    const useSharp = sign === '#';
    const order = useSharp ? SHARP_ORDER : FLAT_ORDER;
    const keys = useSharp ? SHARP_KEYS : FLAT_KEYS;
    const glyph = useSharp ? '♯' : '♭';

    if (playNew && n > 0) playNote(order[n - 1] + sign + '4'); // 방금 추가된 조표 음 재생 (삼중 일치)

    const info =
      n === 0
        ? `${t('noKeySig')} = C ${t('majorSuffix')}`
        : lang() === 'ko'
          ? `${glyph} ${n}개 = ${letterLabel(keys[n])} ${t('majorSuffix')}`
          : `${n} ${useSharp ? 'sharp' : 'flat'}${n > 1 ? 's' : ''} = ${keys[n]} ${t('majorSuffix')}`;

    sec.replaceChildren(
      h(
        'div',
        { class: 'learn-seg-row' },
        h('span', { class: 'learn-seg-label' }, t('signType')),
        segmented(
          [
            { value: '#', label: '♯ ' + t('sharp') },
            { value: 'b', label: '♭ ' + t('flat') },
          ],
          sign,
          (v) => {
            sign = v;
            n = 0;
            render();
          },
          t('signType')
        )
      ),
      h('div', { class: 'learn-staff' }, createKeySigSVG(sign, n, CLEFS.treble, { showNext: n < 7 })),
      h(
        'div',
        { class: 'stepper' },
        h('button', { class: 'iconbtn', 'aria-label': '−', onclick: () => n > 0 && (n--, render()) }, '−'),
        h('span', { class: 'count', 'aria-live': 'polite' }, String(n)),
        h('button', { class: 'iconbtn', 'aria-label': '+', onclick: () => n < 7 && (n++, render(true)) }, '+')
      ),
      h('p', { class: 'learn-note-label', 'aria-live': 'polite' }, info),
      h(
        'div',
        { class: 'chip-row' },
        order.map((l, i) =>
          h('span', { class: 'chip' + (i === n - 1 ? ' active' : i >= n ? ' dim' : '') }, letterLabel(l) + glyph)
        )
      ),
      h(
        'div',
        { class: 'learn-card' },
        h('div', { class: 'learn-card-title' }, '💡 ' + t('mnemonic')),
        h('p', {}, useSharp ? `${SHARP_MNEMONIC_KO} · ${SHARP_MNEMONIC_EN}` : `${FLAT_MNEMONIC_KO} · ${FLAT_MNEMONIC_EN}`)
      ),
      h(
        'div',
        { class: 'learn-card' },
        h('div', { class: 'learn-card-title' }, '🔁 ' + t('reverseRule')),
        h('p', {}, `♯  ${SHARP_ORDER.join(' ')}  →`),
        h('p', {}, `♭  ${FLAT_ORDER.join(' ')}  ←`)
      ),
      h(
        'details',
        { class: 'hint' },
        h('summary', {}, '⚡ ' + t('quickKeyRule')),
        h('div', { class: 'hint-body' }, KEY_RULES.map((r) => h('p', {}, '· ' + (lang() === 'ko' ? r.ko : r.en))))
      )
    );
  }
  render();
}

// ── 모드 D: 화음 쌓기 ─────────────────────────────────
function learnChord(state, main) {
  let root = 'C';
  let quality = 'maj';
  const QUALS = ['maj', 'min', 'aug', 'dim', 'dom7', 'maj7', 'min7'];
  const QUAL_LABEL = { maj: 'maj', min: 'm', aug: 'aug', dim: 'dim', dom7: '7', maj7: 'maj7', min7: 'm7' };
  const sec = h('div', { class: 'learn-sec' });
  main.appendChild(sec);
  const chord = () => makeChord(root, quality);

  function render() {
    const c = chord();
    const roles = c.tones.length === 4 ? [t('seventh'), t('fifth'), t('third'), t('rootLabel')] : [t('fifth'), t('third'), t('rootLabel')];
    const stackBtn = seqButton(t('playStacked'), () => chord().tones.map((tn) => tn.pitch), 400, 350);
    const togetherBtn = h('button', { class: 'btn ghost listen', onclick: () => playChord(chord().tones.map((tn) => tn.pitch)) }, t('playTogether'));
    const cmpBtn = h(
      'button',
      {
        class: 'btn ghost listen',
        onclick: () => {
          cmpBtn.disabled = true;
          playChord(makeChord(root, 'maj').tones.map((tn) => tn.pitch)); // 같은 루트 maj → min 대비
          setTimeout(() => playChord(makeChord(root, 'min').tones.map((tn) => tn.pitch)), 900);
          setTimeout(() => (cmpBtn.disabled = false), 1700);
        },
      },
      t('compareMajMin')
    );

    sec.replaceChildren(
      h(
        'div',
        { class: 'learn-seg-row' },
        h('span', { class: 'learn-seg-label' }, t('rootLabel')),
        segmented(
          LETTERS.map((l) => ({ value: l, label: l })),
          root,
          (v) => {
            root = v;
            render();
          },
          t('rootLabel')
        )
      ),
      h(
        'div',
        { class: 'learn-seg-row' },
        h('span', { class: 'learn-seg-label' }, t('qualityLabel')),
        segmented(
          QUALS.map((q) => ({ value: q, label: QUAL_LABEL[q] })),
          quality,
          (v) => {
            quality = v;
            render();
          },
          t('qualityLabel')
        )
      ),
      h('div', { class: 'learn-staff' }, createChordSVG(c.tones, CLEFS.treble)),
      h('p', { class: 'learn-note-label' }, `${c.symbol} (${lang() === 'ko' ? c.ko : c.nameEn})`),
      h('p', { class: 'learn-baug' }, c.hasDoubleAccidental ? t('doubleAccNote') : ' '),
      h(
        'div',
        { class: 'learn-card' },
        h('div', { class: 'learn-card-title' }, '🧱 ' + t('stackThirds')),
        [...c.tones].reverse().map((tone, i) =>
          h('div', { class: 'stack-row' }, h('span', { class: 'stack-role' }, roles[i]), h('span', { class: 'stack-note' }, noteLabel(tone)))
        ),
        h('p', { class: 'stack-hint' }, (lang() === 'ko' ? c.hint : c.hintEn) + ' — ' + t('stackDesc'))
      ),
      h('div', { class: 'learn-row' }, stackBtn, togetherBtn, cmpBtn),
      // 전체 코드 한눈에 — 성질별 7행 × 루트 7. 칩 클릭 = 위 탐색기에 로드 + 소리 (전수 커버리지)
      h(
        'div',
        { class: 'learn-card' },
        h('div', { class: 'learn-card-title' }, '🗂 ' + t('allChords')),
        QUALS.map((q) =>
          h(
            'div',
            { class: 'chord-grid-row' },
            h('span', { class: 'learn-seg-label' }, QUAL_LABEL[q]),
            LETTERS.map((l) =>
              h(
                'button',
                {
                  class: 'chip chord-chip' + (l === root && q === quality ? ' active' : ''),
                  onclick: () => {
                    root = l;
                    quality = q;
                    render();
                    playChord(makeChord(l, q).tones.map((tn) => tn.pitch));
                  },
                },
                l + CHORD_QUALITIES[q].suffix
              )
            )
          )
        )
      )
    );
  }
  render();
}
