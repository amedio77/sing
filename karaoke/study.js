// karaoke/study.js — 암기용 학습 뷰
// 설계 문서 docs/11-karaoke-design.md §6.1 / 요구사항 FA-1~FA-8

import { SONGS } from './songs.js';
import { fmtTime } from './timeline.js';
import { loadMemo, saveMemo, loadPrefs, savePrefs } from './store.js';

const $ = (sel) => document.querySelector(sel);

// 학습 뷰는 blocks 원본을 쓴다 — 전개(sequence)는 프롬프터·싱크만 필요하다.
// 같은 후렴을 두 번 외울 이유가 없다. (§3.2)

let prefs = loadPrefs();
let song = SONGS.find((s) => s.id === prefs.lastSongId) || SONGS[0];
let memo = loadMemo(song.id);
const revealed = new Set(); // 가리기 모드에서 탭해 공개한 블록 (세션 한정)

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
          title: `${s.artist} · ${fmtTime(s.duration)}`,
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

function render() {
  const mode = prefs.maskMode;
  const done = memo.checkedBlocks.size;
  const total = song.blocks.length;

  const header = el(
    'div',
    {},
    el(
      'div',
      { class: 'meta' },
      `${song.artist} · ${song.source} · ${fmtTime(song.duration)}`,
      el(
        'a',
        { class: 'badge ok', href: `prompter.html#${song.id}`, title: '프롬프터로 이동' },
        '🎤 프롬프터로'
      )
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
      el('span', { class: 'ctrl-label' }, `${done}/${total} 블록`)
    )
  );

  const blocks = el(
    'div',
    { class: 'blocks' },
    song.blocks.map((b, bi) => {
      const isDone = memo.checkedBlocks.has(bi);
      const masked = mode === 'block' && !revealed.has(bi);

      const lines = b.lines.map((text) =>
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
          class: [
            'block',
            b.kind,
            isDone ? 'done' : '',
            masked ? 'masked' : '',
          ]
            .filter(Boolean)
            .join(' '),
          ...(masked
            ? {
                onclick: () => {
                  revealed.add(bi);
                  render();
                },
              }
            : {}),
        },
        el(
          'div',
          { class: 'block-head' },
          el('span', { class: 'block-label' }, b.label),
          el('span', { class: 'spacer' }),
          el(
            'button',
            {
              class: 'chk',
              'aria-label': `${b.label} 암기 완료`,
              'aria-pressed': String(isDone),
              onclick: (e) => {
                e.stopPropagation();
                toggleBlock(bi);
              },
            },
            isDone ? '✓' : ''
          )
        ),
        el('ul', { class: 'lyric' }, lines),
        masked ? el('p', { class: 'mask-hint' }, `${b.lines.length}줄 — 탭하면 공개`) : null
      );
    })
  );

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
