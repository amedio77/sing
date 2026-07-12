// src/modes.js — 3개 학습 모드 = 평범한 배열. 레지스트리·전략 패턴 없음.
// 모드 규약: { id, name(key), generate() → question }
// question: { prompt():str, render(el), choices:[key], answer:key,
//             labelFor(key):str, playAudio(), hint:str, kind, review }

import { CLEFS } from '../data/clefs.js';
import { makeNote, LETTERS, SOLFEGE } from '../data/notes.js';
import { SHARP_ORDER, FLAT_ORDER } from '../data/keys.js';
import { createStaffSVG } from './staff.js';
import { playNote } from './audio.js';
import { getState } from './game.js';
import { t, letterLabel } from './i18n.js';

// ── 유틸 ──────────────────────────────────────────────
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const SIGN_CHAR = { '#': '♯', b: '♭' };
function ordinalEn(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// 오선 위 자연음 풀 (줄 + 칸)
function staffNotes(clef) {
  return [...clef.lines, ...clef.spaces].map(([l, o]) => makeNote(l, o));
}

// ── 모드 A: 음자리표 음 위치 ──────────────────────────
const clefPosition = {
  id: 'clef-position',
  name: 'clefPosition',
  generate() {
    const st = getState();
    // 음자리표는 홈에서 선택한 state.clef를 따른다 (난이도와 분리)
    const clef = st.clef === 'both' ? pick([CLEFS.treble, CLEFS.bass]) : st.clef === 'bass' ? CLEFS.bass : CLEFS.treble;
    const note = pick(staffNotes(clef));
    const distract = shuffle(LETTERS.filter((l) => l !== note.english)).slice(0, 3);
    const choices = shuffle([note.english, ...distract]);
    return {
      kind: 'staff',
      prompt: () => `${getState().lang === 'ko' ? clef.nameKo : clef.nameEn} · ${t('askNoteName')}`,
      render: (c) => c.appendChild(createStaffSVG(clef, note)),
      choices,
      answer: note.english,
      labelFor: (k) => letterLabel(k),
      playAudio: () => playNote(note.midi),
      hint: `${clef.mnemonicLinesKo} (${clef.mnemonicLinesEn}) · ${clef.mnemonicSpacesKo} (${clef.mnemonicSpacesEn})`,
      review: { clef, note },
    };
  },
};

// ── 모드 B: 계이름 ↔ 영어 매칭 ────────────────────────
const noteMatching = {
  id: 'note-matching',
  name: 'noteMatching',
  generate() {
    const st = getState();
    const letter = pick(LETTERS);
    const dir = st.difficulty === 'easy' ? 'ko2en' : pick(['ko2en', 'en2ko']);
    const targetIsEn = dir === 'ko2en';
    const srcLabel = targetIsEn ? SOLFEGE[letter] : letter; // 크게 보여줄 것
    const distract = shuffle(LETTERS.filter((l) => l !== letter)).slice(0, 3);
    const choices = shuffle([letter, ...distract]);
    return {
      kind: 'match',
      prompt: () => t('askMatchTo'),
      render: (c) => {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.textContent = srcLabel;
        card.setAttribute('aria-label', srcLabel);
        c.appendChild(card);
      },
      choices,
      answer: letter,
      labelFor: (k) => (targetIsEn ? k : SOLFEGE[k]), // 목표 체계 라벨(매칭 학습)
      playAudio: () => playNote(letter + '4'),
      hint: '도=C 레=D 미=E 파=F 솔=G 라=A 시=B',
      review: { srcLabel, answerLabel: targetIsEn ? letter : SOLFEGE[letter] },
    };
  },
};

// ── 모드 C: 조표 붙는 순서 ────────────────────────────
const keyOrder = {
  id: 'key-order',
  name: 'keyOrder',
  generate() {
    const st = getState();
    const useSharp = st.difficulty === 'easy' ? true : Math.random() < 0.5;
    const order = useSharp ? SHARP_ORDER : FLAT_ORDER;
    const sign = useSharp ? '#' : 'b';
    const signCh = SIGN_CHAR[sign];
    const type = st.difficulty === 'easy' ? 'next' : pick(['next', 'nth']);

    const idx = type === 'next' ? rnd(order.length) : rnd(order.length);
    const answerLetter = order[idx];
    const answer = answerLetter + sign;
    const distractLetters = shuffle(order.filter((l) => l !== answerLetter)).slice(0, 3);
    const choices = shuffle([answer, ...distractLetters.map((l) => l + sign)]);
    const shown = order.slice(0, idx); // 'next'에서 이미 놓인 조표들

    return {
      kind: 'chips',
      prompt: () => {
        const lang = getState().lang;
        if (type === 'nth') {
          const word = useSharp ? t('sharp') : t('flat');
          return lang === 'ko' ? `${word} ${idx + 1}번째는?` : `${ordinalEn(idx + 1)} ${useSharp ? 'sharp' : 'flat'}?`;
        }
        if (idx === 0) return lang === 'ko' ? '처음 붙는 것은?' : 'Which comes first?';
        return t('askNextAccidental');
      },
      render: (c) => {
        const row = document.createElement('div');
        row.className = 'chip-row';
        if (type === 'next') {
          shown.forEach((l) => {
            const chip = document.createElement('div');
            chip.className = 'chip chip-shown';
            chip.textContent = l + signCh;
            row.appendChild(chip);
          });
          const q = document.createElement('div');
          q.className = 'chip chip-q';
          q.textContent = '?';
          row.appendChild(q);
        } else {
          const badge = document.createElement('div');
          badge.className = 'sign-badge';
          badge.textContent = signCh;
          row.appendChild(badge);
        }
        c.appendChild(row);
      },
      choices,
      answer,
      labelFor: (k) => letterLabel(k),
      playAudio: () => playNote(answerLetter + sign + '4'),
      hint: '샤프: 파도솔레라미시 (F C G D A E B) / 플랫은 역순: 시미라레솔도파 (B E A D G C F)',
      review: { answerLabel: letterLabel(answer) },
    };
  },
};

export const MODES = [clefPosition, noteMatching, keyOrder];
