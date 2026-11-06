// src/ui.js — 홈·게임·결과·설정 화면 렌더링 + 인터랙션/피드백.

import { getState, setState, startQuiz } from './game.js';
import { MODES } from './modes.js';
import { t } from './i18n.js';
import { createStaffSVG } from './staff.js';
import { playCorrect, playWrong, toggleMute, setMuted, setVolume, setTimbre, playNote } from './audio.js';
import { saveSettings, loadRewards, saveRewards } from './storage.js';
import { createMascot, celebrateNotes } from './mascot.js';

// ── DOM 헬퍼 (learn.js도 사용 — learn→ui 단방향, ui는 learn을 import하지 않음) ──
export function h(tag, attrs = {}, ...kids) {
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

export function segmented(options, current, onPick, aria) {
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

export function appBar(state, { backAction, progress, center, noSettings } = {}) {
  // 사운드 quick toggle: setState 없이 직접 갱신 — 피드백 대기 중 재렌더 점프(B1) 방지
  const soundBtn = h(
    'button',
    {
      class: 'iconbtn',
      'aria-label': t('sound'),
      title: t('sound'),
      onclick: () => {
        const muted = toggleMute();
        getState().audioEnabled = !muted;
        saveSettings(getState());
        soundBtn.textContent = muted ? '🔇' : '🔊';
      },
    },
    state.audioEnabled ? '🔊' : '🔇'
  );
  // 설정 진입: 복귀 목적지(settingsReturn) 기록. 설정 화면 자신은 ⚙ 숨김.
  const setBtn = noSettings
    ? null
    : h(
        'button',
        {
          class: 'iconbtn',
          'aria-label': t('settings'),
          title: t('settings'),
          onclick: () => {
            getState().settingsReturn = getState().route;
            location.hash = '#/settings';
          },
        },
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
    : center || h('span', { class: 'progress' });

  return h('header', { class: 'appbar' }, left, mid, h('div', { class: 'appbar-right' }, soundBtn, setBtn));
}

// ── 홈 (메뉴) ────────────────────────────────────────
export function renderMenu(state) {
  window.onkeydown = null;
  const rewards = loadRewards(); // 모드별 최고 별점 배지용
  const cards = MODES.map((mode) => {
    // ⚠️ 새 모드를 MODES에 추가하면 이 맵에도 반드시 넣을 것 — 누락 시 h()가 undefined kid를 건너뛰어
    //    에러 없이 아이콘만 빈칸으로 통과한다(조용한 실패).
    const icon = { 'clef-position': '𝄞 𝄢', 'note-matching': '도 = C', 'key-order': '♯ ♭', chord: '🎹', 'note-value': '♩ ♪' }[mode.id];
    const best = rewards.best[mode.id];
    const bestBadge =
      best && best.stars > 0
        ? h('span', { class: 'card-best', 'aria-label': `${t('best')} ${best.stars}/3` }, '★'.repeat(best.stars) + '☆'.repeat(3 - best.stars))
        : null;
    // 음자리표는 모드 A 한정 옵션 → 카드 안에 배치 (적용 범위가 배치로 자명)
    const clefSeg =
      mode.id === 'clef-position'
        ? h(
            'div',
            { class: 'card-opt' },
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
          )
        : null;
    return h(
      'div',
      { class: 'mode-card', 'data-mode': mode.id },
      bestBadge,
      h('div', { class: 'mode-icon' }, icon),
      h('h2', { class: 'mode-name' }, t(mode.name)),
      h('p', { class: 'mode-desc' }, t(mode.name + 'Desc')),
      clefSeg,
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
      ),
      h(
        'button',
        { class: 'btn ghost learn-btn', onclick: () => (location.hash = '#/learn/' + mode.id) },
        '📖 ' + t('learn'),
        state.learnSeen[mode.id] ? null : h('span', { class: 'new-badge' }, 'NEW')
      )
    );
  });

  // 플레이 옵션(난이도·문항수) = 앱바 중앙 컴팩트 배치 (음소거 버튼 옆).
  // 전역 설정(언어·표기·사운드)은 ⚙ 설정 페이지로 일원화.
  const playOpts = h(
    'div',
    { class: 'appbar-opts', role: 'group', 'aria-label': t('playOptions') },
    segmented(
      [
        { value: 'easy', label: t('easy') },
        { value: 'normal', label: t('normal') },
      ],
      state.difficulty,
      (v) => setState({ difficulty: v }),
      t('difficulty')
    ),
    segmented(
      [
        { value: 5, label: '5' },
        { value: 10, label: '10' },
      ],
      state.total,
      (v) => setState({ total: v }),
      t('questions')
    )
  );

  // 노래 연습 서브앱(karaoke/)으로 가는 링크 카드.
  // MODES에 넣지 않는 이유: MODES는 startQuiz 출제 로직에 묶여 있어 성격이 다르다
  // (별점·학습 페이지·난이도가 모두 퀴즈 전제). 결합은 <a href> 하이퍼링크뿐 —
  // 게임 로직과 JS 의존이 없어 한쪽이 깨져도 다른 쪽에 영향이 없다.
  const appLinks = h(
    'section',
    { class: 'app-links' },
    h('h2', { class: 'app-links-title' }, '🎶 노래 연습'),
    h('div', { class: 'app-links-grid' }, [
      h(
        'a',
        { class: 'link-card', href: 'karaoke/study.html' },
        h('span', { class: 'link-icon' }, '📖'),
        h(
          'span',
          { class: 'link-body' },
          h('strong', {}, '가사 암기'),
          h('span', {}, '곡별 탭으로 정리된 가사 · 가리기 연습')
        )
      ),
      h(
        'a',
        { class: 'link-card', href: 'karaoke/prompter.html' },
        h('span', { class: 'link-icon' }, '🎤'),
        h(
          'span',
          { class: 'link-body' },
          h('strong', {}, '가사 프롬프터'),
          h('span', {}, '실제 곡 시간에 맞춰 흐르는 가사')
        )
      ),
    ])
  );

  app().replaceChildren(
    appBar(state, { center: playOpts }),
    h(
      'main',
      { class: 'menu' },
      // 홈 타이틀: 싱가(idle, 눈 깜빡임만 — 정보 없는 말풍선·상시 모션 금지. docs/05 §2 P6)
      h('h1', { class: 'title' }, state.mascotEnabled ? createMascot({ mood: 'idle', size: 32 }) : '🎵', ' ' + t('appTitle')),
      h('p', { class: 'subtitle' }, t('appSubtitle')),
      h('div', { class: 'mode-grid' }, cards),
      appLinks
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

  // 캐릭터 ON이면 문항 시작부터 싱가 크기만큼 높이 예약(feedback--mascot) — 답변 시 점프 방지
  const feedback = h('div', { class: 'feedback' + (state.mascotEnabled ? ' feedback--mascot' : ''), 'aria-live': 'polite', role: 'status' });

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
        {
          class: 'choice',
          'data-key': key,
          // 보기가 그림(labelNode)이면 버튼 자체에 이름 라벨 — 스크린리더 경로 보존
          'aria-label': q.labelNode ? q.labelFor(key) : null,
          onclick: () => onChoose(mode, key, choices, feedback, hintBox, q),
        },
        h('span', { class: 'choice-num', 'aria-hidden': 'true' }, String(i + 1)),
        h('span', { class: 'choice-label' }, q.labelNode ? q.labelNode(key) : q.labelFor(key))
      )
    )
  );

  // 답변 전에는 revealed=false — 정답을 소리로 누설하는 모드가 이 인자를 본다
  const listen = h('button', { class: 'btn ghost listen', onclick: () => q.playAudio(false) }, '🔊 ' + t('listen'));

  // ⚠️ 스테이지 클래스는 <main>에 붙어야 한다. 내부 .stage-visual div에 붙는 'stage-'+kind와 달리
  //    .choices는 그 div의 형제라서, 보기 버튼 스타일은 여기 있는 클래스로만 잡힌다.
  const stageMod = q.kind === 'chord' ? ' stage-chords' : q.kind === 'rhythm' ? ' stage-rhythm' : '';

  app().replaceChildren(
    appBar(state, { backAction: goHome, progress: { i: quiz.index, total: quiz.total } }),
    h('main', { class: 'stage' + stageMod }, h('p', { class: 'prompt' }, q.prompt()), visual, listen, choices, feedback, hintBox)
  );

  // 키보드: 1~N 보기 선택 / H 힌트 / L 듣기
  window.onkeydown = (e) => {
    if (e.repeat) return; // 키 반복(길게 누르기)으로 예약 재생이 중첩되는 것 차단
    if (e.key >= '1' && e.key <= '9') {
      const btn = choices.children[+e.key - 1];
      if (btn && !btn.disabled) btn.click();
    } else if (e.key.toLowerCase() === 'h') {
      hintBox.open = !hintBox.open;
    } else if (e.key.toLowerCase() === 'l') {
      q.playAudio(false);
    }
  };
}

// 피드백 표시: 텍스트(aria-live 낭독 대상) + 싱가 리액션(장식, aria-hidden).
// 캐릭터 OFF면 텍스트만 — 색·✓✗ 기호 등 비캐릭터 피드백은 그대로 유지(docs/05 §5 토글 폴백).
// hop/tilt 모션은 CSS reduced-motion 블록이 무효화하므로 JS 분기 불필요.
function showFeedback(feedbackEl, ok, msg) {
  const mascotOn = getState().mascotEnabled;
  const kids = [];
  if (mascotOn) {
    const m = createMascot({ mood: ok ? 'happy' : 'hmm', size: 44 });
    m.classList.add(ok ? 'mascot-hop' : 'mascot-tilt');
    kids.push(m);
  }
  kids.push(h('span', {}, msg));
  feedbackEl.replaceChildren(...kids);
  feedbackEl.className = 'feedback' + (mascotOn ? ' feedback--mascot' : '') + (ok ? ' ok' : ' bad');
}

function onChoose(mode, key, gridEl, feedbackEl, hintBox, q) {
  const quiz = getState().quiz;
  if (quiz._locked) return;
  quiz._locked = true;
  const res = quiz.submit(key);
  // 피드백 대기 중 화면 이탈(⚙·홈) 시 지연 동작(정답음·라우팅·재렌더) 억제 — B2
  const stillHere = () => getState().route === '#/mode/' + mode.id;

  for (const b of gridEl.children) {
    b.disabled = true;
    const k = b.getAttribute('data-key');
    if (k === res.correct) b.classList.add('correct', 'pop');
    if (k === key && !res.ok) b.classList.add('wrong', 'shake');
  }

  if (res.ok) {
    showFeedback(feedbackEl, true, '✓ ' + t('correct'));
    playCorrect(); // 구별되는 상승 차임(성공 효과음)
    // 리듬 문항(audioMs 보유)은 정답 시 재생을 생략한다 — 850ms 대기를 건드리지 않기 위함.
    // 쉼표까지 전부 재생하면 easy의 절반이 2초 이상이라 정답 흐름이 무너진다.
    if (!q.audioMs) setTimeout(() => stillHere() && q.playAudio(true), 300); // 그 뒤 실제 음(학습)
  } else {
    showFeedback(feedbackEl, false, `✗ ${t('wrong')} — ${q.labelFor(res.correct)}`);
    hintBox.open = true;
    playWrong(); // 구별되는 하강 버저(실패 효과음)
    setTimeout(() => stillHere() && q.playAudio(true), 500); // 그 뒤 정답 음 각인
  }

  setTimeout(
    () => {
      quiz._locked = false;
      if (!stillHere()) return;
      if (res.done) location.hash = '#/result';
      else setState({}); // 다음 문제 렌더
    },
    // 오답만 재생 길이를 반영 (기존 4모드는 audioMs가 없어 Math.max(1700, 550) = 1700 그대로)
    res.ok ? 850 : Math.max(1700, (q.audioMs || 0) + 550)
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
  const allCorrect = quiz.wrongLog.length === 0;

  // 보상 영속화(sing-rewards-v1) — 최고값만 넓히는 idempotent 병합(재렌더·재진입 무해)
  const rewards = loadRewards();
  const prev = state.activeModeId ? rewards.best[state.activeModeId] : null;
  const firstClear = !!state.activeModeId && !prev;
  const newRecord = !!prev && (stars > prev.stars || quiz.score > prev.score);
  if (state.activeModeId) {
    rewards.best[state.activeModeId] = {
      stars: Math.max(prev ? prev.stars : 0, stars),
      score: Math.max(prev ? prev.score : 0, quiz.score),
    };
    saveRewards(rewards);
  }

  const starEl = h(
    'div',
    { class: 'stars', 'aria-label': `${stars}/3` },
    [0, 1, 2].map((i) => h('span', { class: 'star' }, i < stars ? '★' : '☆'))
  );

  const review = h('div', { class: 'review' });
  quiz.wrongLog.forEach((q) => {
    // 그림으로 복기해야 하는 문항(리듬 등)은 자기 SVG를 직접 준다. cap이 없으면 정답 라벨 폴백.
    if (q.review && q.review.svg) {
      review.appendChild(
        h(
          'div',
          { class: 'review-item' + (q.review.wide ? ' wide' : '') },
          q.review.svg(),
          h('div', { class: 'review-cap' }, q.review.cap || q.labelFor(q.answer))
        )
      );
    } else if (q.kind === 'staff' && q.review) {
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

  // 정확도 <70%(별 0) → 학습 유도가 1순위 (학습→재도전 순환 루프)
  const lowScore = stars === 0 && !!mode;
  const buttons = h(
    'div',
    { class: 'result-btns' },
    lowScore
      ? h('button', { class: 'btn primary', onclick: () => (location.hash = '#/learn/' + mode.id) }, t('learnAndRetry'))
      : null,
    h(
      'button',
      {
        class: lowScore ? 'btn ghost' : 'btn primary',
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

  // 정확도 3구간 표정: 만점=cheer / 별 1개 이상=happy / 미만=hmm+학습 넛지 (실망 연출 금지)
  const heroMood = allCorrect ? 'cheer' : stars >= 1 ? 'happy' : 'hmm';

  app().replaceChildren(
    appBar(state, { backAction: goHome }),
    h(
      'main',
      { class: 'result' },
      h('div', { class: 'result-emoji' }, state.mascotEnabled ? createMascot({ mood: heroMood, size: 88 }) : allCorrect ? '🎉' : '👏'),
      h('h1', { class: 'result-score' }, `${quiz.firstTryCorrect} / ${quiz.total}`),
      starEl,
      h('div', { class: 'accbar' }, h('div', { class: 'accbar-fill', style: `width:${acc}%` })),
      h('p', { class: 'acc-text' }, `${t('accuracy')} ${acc}% · ${t('score')} ${quiz.score} · ${t('combo')} ${quiz.maxCombo}`),
      allCorrect ? h('p', { class: 'all-correct' }, t('allCorrect')) : h('h2', { class: 'review-title' }, t('reviewWrong')),
      review,
      lowScore ? h('p', { class: 'nudge' }, t('lowScoreNudge')) : null,
      buttons
    )
  );

  // 컨페티는 희소 순간 한정: 만점·모드 첫 클리어·신기록, 별 1개 이상일 때만 (docs/05 §2 P2).
  // 세션당 1회(_celebrated) — 결과 화면 재렌더·재진입 시 재발화 방지. reduced-motion no-op은 celebrateNotes 내부 처리.
  if (state.mascotEnabled && stars > 0 && (allCorrect || firstClear || newRecord) && !quiz._celebrated) {
    quiz._celebrated = true;
    celebrateNotes();
  }
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
    onchange: () => saveSettings(getState()), // 드래그 종료 시 1회 저장 (oninput은 setState 우회)
  });

  app().replaceChildren(
    // 명시적 복귀: ⚙ 진입 시 기록한 settingsReturn으로. 직접 진입·새로고침도 앱 내(#/menu) 보장.
    appBar(state, { backAction: () => (location.hash = state.settingsReturn || '#/menu'), noSettings: true }),
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
        h('span', { class: 'set-label' }, t('notation')),
        segmented(
          [
            { value: 'solfege', label: t('notationSolfege') },
            { value: 'english', label: t('notationEnglish') },
            { value: 'both', label: t('notationBoth') },
          ],
          state.notation,
          (v) => setState({ notation: v }),
          t('notation')
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
      // 음색 — 변경 즉시 미리듣기 1음 재생 (WebAudio 합성, 파일 없음)
      h(
        'div',
        { class: 'set-row' },
        h('span', { class: 'set-label' }, t('timbre')),
        segmented(
          [
            { value: 'piano', label: t('timbrePiano') },
            { value: 'simple', label: t('timbreSimple') },
          ],
          state.timbre,
          (v) => {
            setTimbre(v);
            setState({ timbre: v });
            playNote('C4', 400); // 미리듣기
          },
          t('timbre')
        )
      ),
      // 계이름 읽어주기(TTS) — 학습 페이지에서 음 재생 시 이름 발화. 사운드 Off면 함께 무음
      h(
        'div',
        { class: 'set-row' },
        h('span', { class: 'set-label' }, t('speakNames')),
        segmented(
          [
            { value: true, label: 'On' },
            { value: false, label: 'Off' },
          ],
          state.speakNames,
          (v) => setState({ speakNames: v }),
          t('speakNames')
        )
      ),
      // 캐릭터 토글 — 성인 사용자용 안전판. OFF여도 색·기호·게이지 피드백은 유지(docs/05 §5)
      h(
        'div',
        { class: 'set-row' },
        h('span', { class: 'set-label' }, t('mascot')),
        segmented(
          [
            { value: true, label: 'On' },
            { value: false, label: 'Off' },
          ],
          state.mascotEnabled,
          (v) => setState({ mascotEnabled: v }),
          t('mascot')
        )
      ),
      h('p', { class: 'set-foot' }, t('settingsFootnote'))
    )
  );
}
