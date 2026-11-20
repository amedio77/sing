// karaoke/study.js — 암기용 학습 뷰
// 설계 문서 docs/11-karaoke-design.md §6.1 / 요구사항 FA-1~FA-8

import { SONGS } from './songs.js';
import { fmtTime } from './timeline.js';
import { loadMemo, saveMemo, loadPrefs, savePrefs, loadMentEdit, saveMentEdit } from './store.js';

const $ = (sel) => document.querySelector(sel);

// 학습 뷰는 blocks 원본을 쓴다 — 전개(sequence)는 프롬프터·싱크만 필요하다.
// 같은 후렴을 두 번 외울 이유가 없다. (§3.2)

let prefs = loadPrefs();
let song = SONGS.find((s) => s.id === prefs.lastSongId) || SONGS[0];
let memo = loadMemo(song.id);
const revealed = new Set(); // 가리기 모드에서 탭해 공개한 블록 (세션 한정)
let editing = null; // 수정 중인 멘트 part ('ment' | 'closing')

const MASK_MODES = [
  { value: 'reveal', label: '전체공개' },
  { value: 'block', label: '블록가림' },
  { value: 'initial', label: '첫글자' },
];

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    e.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return e;
}

// FA-4 첫 글자 힌트 — 각 줄의 첫 글자만 남기고 나머지를 블록 문자로 치환.
// 공백은 살려서 어절 수가 보이게 한다(리듬 단서).
function initialHint(line) {
  const words = line.split(/\s+/);
  return words
    .map((w, i) => {
      if (!w) return w;
      if (i === 0) return w[0] + '█'.repeat(Math.max(0, w.length - 1));
      return '█'.repeat(w.length);
    })
    .join(' ');
}

function renderTabs() {
  const bar = $('#songtabs');
  bar.replaceChildren(
    ...SONGS.map((s, i) =>
      el(
        'button',
        {
          class: 'songtab',
          role: 'tab',
          'aria-selected': String(s.id === song.id),
          onclick: () => selectSong(s),
          title: s.duration ? `${s.artist} · ${fmtTime(s.duration)}` : s.artist,
        },
        `${i + 1}. ${s.title}`
      )
    )
  );
}

function selectSong(next) {
  if (next.id === song.id) return;
  song = next;
  memo = loadMemo(song.id);
  revealed.clear();
  editing = null;
  prefs = savePrefs({ lastSongId: song.id });
  renderTabs();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setMask(mode) {
  prefs = savePrefs({ maskMode: mode });
  revealed.clear();
  render();
}

function toggleBlock(bi) {
  if (memo.checkedBlocks.has(bi)) memo.checkedBlocks.delete(bi);
  else memo.checkedBlocks.add(bi);
  saveMemo(song.id, memo.checkedBlocks);
  render();
}

const MENT_KEY = -1;
const CLOSING_KEY = -2;

// 말하는 시간 추정 — 공백·(웃음) 같은 지시문을 빼고 초당 약 5자(분당 300자)
function speakTime(lines) {
  const n = lines.join('').replace(/\([^)]*\)/g, '').replace(/\s/g, '').length;
  return `약 ${Math.max(5, Math.round(n / 5 / 5) * 5)}초`;
}

// 기본 멘트(songs.js) 위에 이 기기에서 고친 멘트가 있으면 그것을 쓴다
function mentLines(part) {
  return loadMentEdit(song.id, part) ?? song[part] ?? [];
}

const toLines = (text) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

// 멘트 편집기 — 한 줄 = 한 호흡. 입력하는 동안 예상 시간을 바로 보여 준다
function editor({ part, label, lines, edited }) {
  const ta = el('textarea', { class: 'ment-edit', rows: String(Math.max(6, lines.length + 2)), 'aria-label': label });
  ta.value = lines.join('\n');
  const time = el('span', { class: 'ctrl-label' }, speakTime(lines));
  ta.addEventListener('input', () => (time.textContent = speakTime(toLines(ta.value))));
  const done = (fn) => () => {
    fn();
    editing = null;
    render();
  };
  return el(
    'section',
    { class: 'block ment editing' },
    el('div', { class: 'block-head' }, el('span', { class: 'block-label' }, label.split(' · ')[0] + ' 수정'), el('span', { class: 'spacer' }), time),
    ta,
    el('p', { class: 'ment-help' }, '한 줄에 한 호흡씩 적으세요. 이 기기에 저장됩니다.'),
    el(
      'div',
      { class: 'ment-actions' },
      el('button', { class: 'btn primary', onclick: done(() => saveMentEdit(song.id, part, toLines(ta.value))) }, '저장'),
      el('button', { class: 'btn', onclick: done(() => {}) }, '취소'),
      edited
        ? el('button', { class: 'btn', onclick: done(() => saveMentEdit(song.id, part, null)) }, '기본 멘트로')
        : null
    )
  );
}

function card(c, mode) {
  if (c.part && editing === c.part) return editor(c);
  const { key, kind, label, lines: texts } = c;
  const isDone = memo.checkedBlocks.has(key);
  const masked = mode === 'block' && !revealed.has(key);

  const lines = texts.map((text) =>
    el(
      'li',
      { class: masked ? 'hidden' : '' },
      mode === 'initial'
        ? el('span', { class: 'initial', title: '탭하면 전체공개 모드로' }, initialHint(text))
        : text
    )
  );

  return el(
    'section',
    {
      class: ['block', kind, isDone ? 'done' : '', masked ? 'masked' : ''].filter(Boolean).join(' '),
      ...(masked
        ? {
            onclick: () => {
              revealed.add(key);
              render();
            },
          }
        : {}),
    },
    el(
      'div',
      { class: 'block-head' },
      el('span', { class: 'block-label' }, label),
      el('span', { class: 'spacer' }),
      c.part
        ? el(
            'button',
            {
              class: 'chk edit',
              'aria-label': `${label} 수정`,
              title: '멘트 수정',
              onclick: (e) => {
                e.stopPropagation();
                editing = c.part;
                render();
              },
            },
            '✏️'
          )
        : null,
      el(
        'button',
        {
          class: 'chk',
          'aria-label': `${label} 암기 완료`,
          'aria-pressed': String(isDone),
          onclick: (e) => {
            e.stopPropagation();
            toggleBlock(key);
          },
        },
        isDone ? '✓' : ''
      )
    ),
    el('ul', { class: 'lyric' }, lines),
    masked ? el('p', { class: 'mask-hint' }, `${texts.length}줄 — 탭하면 공개`) : null
  );
}

function render() {
  const mode = prefs.maskMode;
  const done = [...memo.checkedBlocks].filter((k) => k >= 0 && k < song.blocks.length).length;
  const total = song.blocks.length;
  const mentKeys = [song.ment?.length && MENT_KEY, song.closing?.length && CLOSING_KEY].filter(Boolean);
  const mentDone = mentKeys.filter((k) => memo.checkedBlocks.has(k)).length;

  const header = el(
    'div',
    {},
    song.scene ? el('p', { class: 'scene' }, song.scene) : null,
    el(
      'div',
      { class: 'meta' },
      [song.artist, song.source, song.duration ? fmtTime(song.duration) : null].filter(Boolean).join(' · ')
      // 프롬프터는 당분간 숨김 — 다시 쓰려면 아래 주석을 푼다
      // el(
      //   'a',
      //   { class: 'badge ok', href: `prompter.html#${song.id}`, title: '프롬프터로 이동' },
      //   '🎤 프롬프터로'
      // )
    ),
    el(
      'div',
      { class: 'ctrl-row' },
      el('span', { class: 'ctrl-label' }, '가리기'),
      el(
        'div',
        { class: 'seg', role: 'group', 'aria-label': '가리기 모드' },
        MASK_MODES.map((m) =>
          el(
            'button',
            { 'aria-pressed': String(m.value === mode), onclick: () => setMask(m.value) },
            m.label
          )
        )
      )
    ),
    el(
      'div',
      { class: 'ctrl-row' },
      el('span', { class: 'ctrl-label' }, '암기'),
      el('div', { class: 'progress' }, el('i', { style: `--p:${total ? done / total : 0}` })),
      el(
        'span',
        { class: 'ctrl-label' },
        `${done}/${total} 블록` + (mentKeys.length ? ` · 멘트 ${mentDone}/${mentKeys.length}` : '')
      )
    ),
    song.ment?.length || song.closing?.length
      ? el(
          'div',
          { class: 'ctrl-row' },
          el('span', { class: 'ctrl-label' }, '멘트'),
          el(
            'div',
            { class: 'seg', role: 'group', 'aria-label': '멘트 보이기' },
            [
              [true, '보이기'],
              [false, '숨기기'],
            ].map(([v, label]) =>
              el(
                'button',
                {
                  'aria-pressed': String((prefs.showMent !== false) === v),
                  onclick: () => {
                    prefs = savePrefs({ showMent: v });
                    render();
                  },
                },
                label
              )
            )
          )
        )
      : null
  );

  // 멘트 카드는 가사 블록과 같은 가리기·체크를 쓴다. 키: 가사 = 블록 번호(0~), 멘트 = -1, 마무리 = -2
  const showMent = prefs.showMent !== false;
  const talk = (part, key, title) => {
    const base = song[part] || [];
    if (!showMent || !base.length) return null;
    const lines = mentLines(part);
    const edited = loadMentEdit(song.id, part) != null;
    return { key, kind: 'ment', part, edited, label: `${title} · ${speakTime(lines)}${edited ? ' · 수정됨' : ''}`, lines };
  };
  const cards = [
    talk('ment', MENT_KEY, '🎤 멘트'),
    ...song.blocks.map((b, bi) => ({ key: bi, kind: b.kind, label: b.label, lines: b.lines })),
    talk('closing', CLOSING_KEY, '🎤 마무리 멘트'),
  ].filter(Boolean);

  const blocks = el('div', { class: 'blocks' }, cards.map((c) => card(c, mode)));

  $('#view').replaceChildren(header, blocks);
  document.documentElement.style.setProperty('--font-scale', String(prefs.fontScale));
}

// ── 글자 크기 (FA-6) ─────────────────────────────────
function bumpFont(delta) {
  const next = Math.min(1.8, Math.max(0.8, Math.round((prefs.fontScale + delta) * 10) / 10));
  prefs = savePrefs({ fontScale: next });
  document.documentElement.style.setProperty('--font-scale', String(next));
}

$('#font-up').addEventListener('click', () => bumpFont(0.1));
$('#font-down').addEventListener('click', () => bumpFont(-0.1));

// ── 키보드 (§6.4) ────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  const i = SONGS.findIndex((s) => s.id === song.id);
  if (e.key === 'ArrowRight') selectSong(SONGS[(i + 1) % SONGS.length]);
  else if (e.key === 'ArrowLeft') selectSong(SONGS[(i - 1 + SONGS.length) % SONGS.length]);
  else if (/^[1-9]$/.test(e.key) && SONGS[Number(e.key) - 1]) selectSong(SONGS[Number(e.key) - 1]);
  else return;
  e.preventDefault();
});

renderTabs();
render();
