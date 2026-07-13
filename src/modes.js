// src/modes.js — 4개 학습 모드 = 평범한 배열. 레지스트리·전략 패턴 없음.
// 모드 규약: { id, name(key), generate() → question }
// question: { key:str, prompt():str, render(el), choices:[key], answer:key,
//             labelFor(key):str, playAudio(), hint:str, kind, review }
// key = 문제 정체성(그 모드가 평가하는 학습 항목이 같으면 같은 key).
//       createQuiz(game.js)가 세션 내 무중복 판정에 사용. 누락 시 해당 문항만 dedup 제외.

import { CLEFS } from '../data/clefs.js';
import { makeNote, LETTERS, SOLFEGE } from '../data/notes.js';
import { SHARP_ORDER, FLAT_ORDER } from '../data/keys.js';
import { makeChord } from '../data/chords.js';
import { createStaffSVG, createChordSVG, createKeySigSVG } from './staff.js';
import { playNote, playChord } from './audio.js';
import { getState } from './game.js';
import { t, letterLabel, noteLabel } from './i18n.js';

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

// diatonic 값 → makeNote (덧줄 음 포함 풀 생성용)
function noteFromDv(dv) {
  return makeNote(LETTERS[((dv % 7) + 7) % 7], Math.floor(dv / 7));
}
// 음자리표 음 풀: 쉬움=오선 안(dvRef..+8), 보통=덧줄 포함(dvRef−3..+10)
function notePool(clef, difficulty) {
  const lo = difficulty === 'easy' ? clef.dvRef : clef.dvRef - 3;
  const hi = clef.dvRef + (difficulty === 'easy' ? 8 : 10);
  const pool = [];
  for (let dv = lo; dv <= hi; dv++) pool.push(noteFromDv(dv));
  return pool;
}

// ── 모드 A: 음자리표 음 위치 ──────────────────────────
const clefPosition = {
  id: 'clef-position',
  name: 'clefPosition',
  generate() {
    const st = getState();
    // 음자리표는 홈에서 선택한 state.clef를 따른다 (난이도와 분리)
    const clef = st.clef === 'both' ? pick([CLEFS.treble, CLEFS.bass]) : st.clef === 'bass' ? CLEFS.bass : CLEFS.treble;
    const note = pick(notePool(clef, st.difficulty)); // 덧줄 포함 확장 풀
    const distract = shuffle(LETTERS.filter((l) => l !== note.english)).slice(0, 3);
    const choices = shuffle([note.english, ...distract]);
    return {
      kind: 'staff',
      key: `${clef.id}:${note.english}${note.octave}`, // 위치 읽기가 학습 항목 → 옥타브 포함
      prompt: () => `${getState().lang === 'ko' ? clef.nameKo : clef.nameEn} · ${t('askNoteName')}`,
      render: (c) => c.appendChild(createStaffSVG(clef, note)),
      choices,
      answer: note.english,
      labelFor: (k) => letterLabel(k),
      playAudio: () => playNote(note.letter + note.octave), // 문자열 피치 필수 — 숫자는 Hz로 해석됨(audio.js noteToFreq)
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
    const oct = pick([4, 5]); // 오선 위치 다양화
    const dir = st.difficulty === 'easy' ? 'ko2en' : pick(['ko2en', 'en2ko']);
    const targetIsEn = dir === 'ko2en';
    const srcLabel = targetIsEn ? SOLFEGE[letter] : letter; // 병기할 출처 라벨
    const note = makeNote(letter, oct); // 오선 표시용 (자연음, 옥타브 랜덤)
    const distract = shuffle(LETTERS.filter((l) => l !== letter)).slice(0, 3);
    const choices = shuffle([letter, ...distract]);
    return {
      kind: 'match',
      key: `${dir}:${letter}`, // 글자 매칭이 학습 항목 → 옥타브(표시용 변화)는 제외
      prompt: () => t('askMatchTo'),
      render: (c) => {
        const wrap = document.createElement('div');
        wrap.className = 'match-staff';
        wrap.appendChild(createStaffSVG(CLEFS.treble, note)); // 높은음자리표에 음 표시
        const sub = document.createElement('div');
        sub.className = 'match-sub';
        sub.textContent = srcLabel; // 출처 체계 라벨 병기
        wrap.appendChild(sub);
        c.appendChild(wrap);
      },
      choices,
      answer: letter,
      labelFor: (k) => (targetIsEn ? k : SOLFEGE[k]), // 목표 체계 라벨(매칭 학습)
      playAudio: () => playNote(letter + oct),
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
    const useSharp = Math.random() < 0.5; // 쉬움/보통 모두 샤프·플랫 혼합
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
      key: `${sign}:${idx}`, // next/nth는 같은 사실(order[idx])의 문구 변형 → type 제외로 세션당 1회
      prompt: () => {
        const lang = getState().lang;
        if (type === 'nth') {
          const word = useSharp ? t('sharp') : t('flat');
          return lang === 'ko' ? `${word} ${idx + 1}번째는?` : `${ordinalEn(idx + 1)} ${useSharp ? 'sharp' : 'flat'}?`;
        }
        const word = useSharp ? t('sharp') : t('flat');
        return lang === 'ko'
          ? `${idx === 0 ? '처음' : '다음에'} 붙는 ${word}는?`
          : `Which ${useSharp ? 'sharp' : 'flat'} comes ${idx === 0 ? 'first' : 'next'}?`;
      },
      render: (c) => {
        if (type === 'next') {
          // 지금까지 붙은 조표를 실제 조표 위치로 오선에 표시(+다음 자리 '?')
          c.appendChild(createKeySigSVG(sign, idx, CLEFS.treble, { showNext: true }));
        } else {
          const badge = document.createElement('div');
          badge.className = 'sign-badge';
          badge.textContent = signCh;
          c.appendChild(badge);
        }
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

// ── 모드 D: 피아노 코드 (화음) ─────────────────────────
const TRIADS = ['maj', 'min', 'aug', 'dim'];
const SEVENTHS = ['dom7', 'maj7', 'min7'];

// 겹임시표(Baug 등) 제외하고 유효 코드 하나 뽑기
function pickChord(qualities) {
  let c;
  let guard = 0;
  do {
    c = makeChord(pick(LETTERS), pick(qualities));
  } while (c.hasDoubleAccidental && guard++ < 40);
  return c;
}

const chord = {
  id: 'chord',
  name: 'chord',
  generate() {
    const st = getState();
    const qualities = st.difficulty === 'easy' ? TRIADS : [...TRIADS, ...SEVENTHS];
    const target = pickChord(qualities);
    const dir = pick(['notes2name', 'name2notes']); // 둘 다(방향 랜덤)

    // 오답 코드 3개 (겹임시표 제외, id 중복 없음)
    const seen = new Set([target.id]);
    const distractors = [];
    let g = 0;
    while (distractors.length < 3 && g++ < 100) {
      const c = pickChord(qualities);
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      distractors.push(c);
    }
    const options = shuffle([target, ...distractors]);
    const byId = Object.fromEntries(options.map((c) => [c.id, c]));
    const notesLabel = (c) => c.tones.map((tn) => noteLabel(tn)).join(' · ');
    const choices = options.map((c) => c.id);

    return {
      kind: 'chord',
      key: `${dir}:${target.id}`,
      prompt: () => (dir === 'notes2name' ? t('askChordName') : t('askChordNotes')),
      render: (el) => {
        if (dir === 'notes2name') {
          el.appendChild(createChordSVG(target.tones, CLEFS.treble)); // 화음을 오선에 쌓아 표시
        } else {
          const card = document.createElement('div');
          card.className = 'chord-card name';
          card.textContent = target.symbol; // 코드 심볼
          el.appendChild(card);
        }
      },
      choices,
      answer: target.id,
      labelFor: (id) => (dir === 'notes2name' ? byId[id].symbol : notesLabel(byId[id])),
      playAudio: () => playChord(target.tones.map((tn) => tn.pitch)),
      hint: `${target.symbol} (${target.ko}) = ${target.hint}`,
      review: { kind: 'chord', symbol: target.symbol, notes: notesLabel(target) },
    };
  },
};

export const MODES = [clefPosition, noteMatching, keyOrder, chord];
