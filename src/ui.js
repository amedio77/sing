// src/ui.js — 홈·게임·결과·설정 화면 렌더링 + 인터랙션/피드백.

import { getState, setState, startQuiz } from './game.js';
import { MODES } from './modes.js';
import { t } from './i18n.js';
import { createStaffSVG } from './staff.js';
import { playCorrect, playWrong, toggleMute, setMuted, setVolume } from './audio.js';

// ── DOM 헬퍼 ─────────────────────────────────────────
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    e.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return e;
}
const app = () => document.getElementById('app');

// ── 공통 컨트롤 ──────────────────────────────────────
function goHome() {
  const st = getState();
  st.quiz = null;
  st.activeModeId = null;
  location.hash = '#/menu';
}
function toggleSound() {
  const muted = toggleMute();
  setState({ audioEnabled: !muted });
}
function toggleLang() {
  setState({ lang: getState().lang === 'ko' ? 'en' : 'ko' });
}

function segmented(options, current, onPick, aria) {
  return h(
    'div',
    { class: 'seg', role: 'group', 'aria-label': aria || '' },
    options.map((o) =>
      h(
        'button',
        {
          class: 'seg-btn' + (o.value === current ? ' active' : ''),
          'aria-pressed': o.value === current ? 'true' : 'false',
          onclick: () => onPick(o.value),
        },
        o.label
      )
    )
  );
}

function appBar(state, { backAction, progress } = {}) {
  const soundBtn = h(
    'button',
    { class: 'iconbtn', 'aria-label': t('sound'), title: t('sound'), onclick: toggleSound },
    state.audioEnabled ? '🔊' : '🔇'
  );
  const langBtn = h(
    'button',
    { class: 'iconbtn lang', 'aria-label': t('language'), onclick: toggleLang },
    state.lang === 'ko' ? '한 · EN' : 'KO · EN'
  );
  const setBtn = h(
    'button',
    { class: 'iconbtn', 'aria-label': t('settings'), title: t('settings'), onclick: () => (location.hash = '#/settings') },
    '⚙'
  );

  const left = backAction
    ? h('button', { class: 'iconbtn back', onclick: backAction }, '← ' + t('home'))
    : h('span', { class: 'appbar-brand' }, '🎵');

  const mid = progress
    ? h(
        'div',
        { class: 'progress', 'aria-live': 'off' },
        h(
          'span',
          { class: 'dots', 'aria-hidden': 'true' },
          Array.from({ length: progress.total }, (_, i) => h('span', { class: 'dot' + (i < progress.i ? ' on' : '') }))
        ),
        h('span', { class: 'progress-text' }, `${progress.i} / ${progress.total}`)
      )
    : h('span', { class: 'progress' });

  return h('header', { class: 'appbar' }, left, mid, h('div', { class: 'appbar-right' }, soundBtn, langBtn, setBtn));
}

// ── 홈 (메뉴) ────────────────────────────────────────
export function renderMenu(state) {
  window.onkeydown = null;
  const cards = MODES.map((mode) => {
    const icon = { 'clef-position': '𝄞 𝄢', 'note-matching': '도 = C', 'key-order': '♯ ♭', chord: '🎹' }[mode.id];
    return h(
      'div',
      { class: 'mode-card', 'data-mode': mode.id },
      h('div', { class: 'mode-icon' }, icon),
      h('h2', { class: 'mode-name' }, t(mode.name)),
      h('p', { class: 'mode-desc' }, t(mode.name + 'Desc')),
      h(
        'button',
        {
          class: 'btn primary',
          onclick: () => {
            startQuiz(mode);
            location.hash = '#/mode/' + mode.id;
          },
        },
        t('start')
      )
    );
  });

  const controls = h(
    'div',
    { class: 'menu-controls' },
    h(
      'div',
      { class: 'ctrl-row' },
      h('span', { class: 'ctrl-label' }, t('clef')),
      segmented(
        [
          { value: 'treble', label: t('treble') },
          { value: 'bass', label: t('bass') },
          { value: 'both', label: t('both') },
        ],
        state.clef,
        (v) => setState({ clef: v }),
        t('clef')
      )
    ),
    h('p', { class: 'ctrl-note' }, t('clefAppliesToModeA')),
    h(
      'div',
      { class: 'ctrl-row' },
      h('span', { class: 'ctrl-label' }, t('difficulty')),
      segmented(
        [
          { value: 'easy', label: t('easy') },
          { value: 'normal', label: t('normal') },
        ],
        state.difficulty,
        (v) => setState({ difficulty: v }),
        t('difficulty')
      )
    ),
    h(
      'div',
      { class: 'ctrl-row' },
      h('span', { class: 'ctrl-label' }, t('questions')),
      segmented(
        [
          { value: 5, label: '5' },
          { value: 10, label: '10' },
        ],
        state.total,
        (v) => setState({ total: v }),
        t('questions')
      )
    )
  );

  app().replaceChildren(
    appBar(state, {}),
    h(
      'main',
      { class: 'menu' },
      h('h1', { class: 'title' }, '🎵 ' + t('appTitle')),
      h('p', { class: 'subtitle' }, t('appSubtitle')),
      h('div', { class: 'mode-grid' }, cards),
      controls
    )
  );
}

// ── 게임 모드 화면 ───────────────────────────────────
export function renderMode(state, mode) {
  if (!mode) {
    location.hash = '#/menu';
    return;
  }
  if (state.activeModeId !== mode.id || !state.quiz) startQuiz(mode);
  const quiz = state.quiz;
  const q = quiz.current();
  if (!q) {
    location.hash = '#/result';
    return;
  }

  const visual = h('div', { class: 'stage-visual stage-' + q.kind });
  q.render(visual);

  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite', role: 'status' });

  const hintBox = h(
    'details',
    { class: 'hint' },
    h('summary', {}, '💡 ' + t('hint')),
    h('div', { class: 'hint-body' }, q.hint)
  );

  const choices = h(
    'div',
    { class: 'choices' },
    q.choices.map((key, i) =>
      h(
        'button',
        { class: 'choice', 'data-key': key, onclick: () => onChoose(mode, key, choices, feedback, hintBox, q) },
        h('span', { class: 'choice-num', 'aria-hidden': 'true' }, String(i + 1)),
        h('span', { class: 'choice-label' }, q.labelFor(key))
      )
    )
  );

  const listen = h('button', { class: 'btn ghost listen', onclick: () => q.playAudio() }, '🔊 ' + t('listen'));

  app().replaceChildren(
    appBar(state, { backAction: goHome, progress: { i: quiz.index, total: quiz.total } }),
    h('main', { class: 'stage' + (q.kind === 'chord' ? ' stage-chords' : '') }, h('p', { class: 'prompt' }, q.prompt()), visual, listen, choices, feedback, hintBox)
  );

  // 키보드: 1~N 보기 선택 / H 힌트 / L 듣기
  window.onkeydown = (e) => {
    if (e.key >= '1' && e.key <= '9') {
      const btn = choices.children[+e.key - 1];
      if (btn && !btn.disabled) btn.click();
    } else if (e.key.toLowerCase() === 'h') {
      hintBox.open = !hintBox.open;
    } else if (e.key.toLowerCase() === 'l') {
      q.playAudio();
    }
  };
}

function onChoose(mode, key, gridEl, feedbackEl, hintBox, q) {
  const quiz = getState().quiz;
  if (quiz._locked) return;
  quiz._locked = true;
  const res = quiz.submit(key);

  for (const b of gridEl.children) {
    b.disabled = true;
    const k = b.getAttribute('data-key');
    if (k === res.correct) b.classList.add('correct', 'pop');
    if (k === key && !res.ok) b.classList.add('wrong', 'shake');
  }

  if (res.ok) {
    feedbackEl.textContent = '✓ ' + t('correct');
    feedbackEl.className = 'feedback ok';
    playCorrect(); // 구별되는 상승 차임(성공 효과음)
    setTimeout(() => q.playAudio(), 300); // 그 뒤 실제 음(학습)
  } else {
    feedbackEl.textContent = `✗ ${t('wrong')} — ${q.labelFor(res.correct)}`;
    feedbackEl.className = 'feedback bad';
    hintBox.open = true;
    playWrong(); // 구별되는 하강 버저(실패 효과음)
    setTimeout(() => q.playAudio(), 500); // 그 뒤 정답 음 각인
  }

  setTimeout(
    () => {
      quiz._locked = false;
      if (res.done) location.hash = '#/result';
      else setState({}); // 다음 문제 렌더
    },
    res.ok ? 850 : 1700
  );
}

// ── 결과 화면 ────────────────────────────────────────
export function renderResult(state) {
  window.onkeydown = null;
  const quiz = state.quiz;
  if (!quiz) {
    location.hash = '#/menu';
    return;
  }
  const mode = MODES.find((m) => m.id === state.activeModeId);
  const acc = Math.round(quiz.accuracy() * 100);
  const stars = quiz.stars();
  const starEl = h(
    'div',
    { class: 'stars', 'aria-label': `${stars}/3` },
    [0, 1, 2].map((i) => h('span', { class: 'star' }, i < stars ? '★' : '☆'))
  );

  const review = h('div', { class: 'review' });
  quiz.wrongLog.forEach((q) => {
    if (q.kind === 'staff' && q.review) {
      review.appendChild(
        h(
          'div',
          { class: 'review-item' },
          createStaffSVG(q.review.clef, q.review.note, { highlight: true }),
          h('div', { class: 'review-cap' }, q.labelFor(q.answer))
        )
      );
    } else if (q.review && q.review.symbol && q.review.notes) {
      review.appendChild(
        h('div', { class: 'review-item text' }, h('div', { class: 'review-cap' }, `${q.review.symbol} = ${q.review.notes}`))
      );
    } else {
      const from = q.review && q.review.srcLabel ? q.review.srcLabel + ' → ' : '';
      review.appendChild(h('div', { class: 'review-item text' }, h('div', { class: 'review-cap' }, from + q.labelFor(q.answer))));
    }
  });

  const buttons = h(
    'div',
    { class: 'result-btns' },
    h(
      'button',
      {
        class: 'btn primary',
        onclick: () => {
          if (mode) {
            startQuiz(mode);
            location.hash = '#/mode/' + mode.id;
          } else goHome();
        },
      },
      '↻ ' + t('playAgain')
    ),
    h('button', { class: 'btn ghost', onclick: goHome }, '🏠 ' + t('toHome'))
  );

  const allCorrect = quiz.wrongLog.length === 0;

  app().replaceChildren(
    appBar(state, { backAction: goHome }),
    h(
      'main',
      { class: 'result' },
      h('div', { class: 'result-emoji' }, allCorrect ? '🎉' : '👏'),
      h('h1', { class: 'result-score' }, `${quiz.firstTryCorrect} / ${quiz.total}`),
      starEl,
      h('div', { class: 'accbar' }, h('div', { class: 'accbar-fill', style: `width:${acc}%` })),
      h('p', { class: 'acc-text' }, `${t('accuracy')} ${acc}% · ${t('score')} ${quiz.score} · ${t('combo')} ${quiz.maxCombo}`),
      allCorrect ? h('p', { class: 'all-correct' }, t('allCorrect')) : h('h2', { class: 'review-title' }, t('reviewWrong')),
      review,
      buttons
    )
  );
}

// ── 설정 화면 ────────────────────────────────────────
export function renderSettings(state) {
  window.onkeydown = null;
  const volLabel = h('span', { class: 'vol-val' }, Math.round(state.volume * 100) + '%');
  const volSlider = h('input', {
    type: 'range',
    min: '0',
    max: '100',
    value: String(Math.round(state.volume * 100)),
    class: 'vol-slider',
    'aria-label': t('volume'),
    oninput: (e) => {
      const v = +e.target.value / 100;
      setVolume(v);
      state.volume = v; // 재렌더 없이 라이브 반영(슬라이더 포커스 유지)
      volLabel.textContent = e.target.value + '%';
    },
  });

  app().replaceChildren(
    appBar(state, { backAction: () => history.back() }),
    h(
      'main',
      { class: 'settings' },
      h('h1', { class: 'title' }, '⚙ ' + t('settings')),
      h(
        'div',
        { class: 'set-row' },
        h('span', { class: 'set-label' }, t('language')),
        segmented(
          [
            { value: 'ko', label: '한국어' },
            { value: 'en', label: 'English' },
          ],
          state.lang,
          (v) => setState({ lang: v }),
          t('language')
        )
      ),
      h(
        'div',
        { class: 'set-row' },
        h('span', { class: 'set-label' }, t('sound')),
        segmented(
          [
            { value: true, label: 'On' },
            { value: false, label: 'Off' },
          ],
          state.audioEnabled,
          (v) => {
            setMuted(!v); // v=true(On)→muted=false
            setState({ audioEnabled: v });
          },
          t('sound')
        )
      ),
      h('div', { class: 'set-row' }, h('span', { class: 'set-label' }, t('volume')), volSlider, volLabel),
      h('p', { class: 'set-foot' }, t('settingsFootnote'))
    )
  );
}
