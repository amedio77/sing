// data/chords.js — 코드(화음) 품질 상수 + makeChord 팩토리.
// makeNote와 동일한 데이터-팩토리 패턴. 자연음 루트만 사용.
// 정확한 스펠링: 루트에서 3도씩 글자를 쌓고(letterOffset) 반음(semitoneOffset)으로 임시표 결정.
// 자연루트×품질 조합은 임시표 ±1 이내 — 유일 예외 Baug(B·D♯·F𝄪)만 hasDoubleAccidental=true → 모드에서 제외.

import { LETTERS, LETTER_STEP, SEMITONE, SOLFEGE } from './notes.js';

export const CHORD_QUALITIES = {
  maj: { semis: [0, 4, 7], letters: [0, 2, 4], suffix: '', ko: '메이저', triad: true, hint: '루트 + 장3도(4반음) + 완전5도(7반음)' },
  min: { semis: [0, 3, 7], letters: [0, 2, 4], suffix: 'm', ko: '마이너', triad: true, hint: '루트 + 단3도(3반음) + 완전5도(7반음)' },
  aug: { semis: [0, 4, 8], letters: [0, 2, 4], suffix: 'aug', ko: '증3화음', triad: true, hint: '루트 + 장3도 + 증5도(8반음)' },
  dim: { semis: [0, 3, 6], letters: [0, 2, 4], suffix: 'dim', ko: '감3화음', triad: true, hint: '루트 + 단3도 + 감5도(6반음)' },
  dom7: { semis: [0, 4, 7, 10], letters: [0, 2, 4, 6], suffix: '7', ko: '도미넌트7', triad: false, hint: '메이저 + 단7도(10반음)' },
  maj7: { semis: [0, 4, 7, 11], letters: [0, 2, 4, 6], suffix: 'maj7', ko: '메이저7', triad: false, hint: '메이저 + 장7도(11반음)' },
  min7: { semis: [0, 3, 7, 10], letters: [0, 2, 4, 6], suffix: 'm7', ko: '마이너7', triad: false, hint: '마이너 + 단7도(10반음)' },
};

const ACC_SYM = { '-2': '♭♭', '-1': '♭', 0: '', 1: '♯', 2: '♯♯' };
const accStr = (a) => ACC_SYM[a] ?? '';
const accPitch = (a) => (a === 2 ? '##' : a === -2 ? 'bb' : a === 1 ? '#' : a === -1 ? 'b' : '');

// 자연음 루트(letter) + 품질 id → 코드 객체
export function makeChord(rootLetter, quality) {
  const q = CHORD_QUALITIES[quality];
  const rootIdx = LETTER_STEP[rootLetter]; // 0..6
  const rootAbs = SEMITONE[rootLetter]; // 루트는 자연음(임시표 0)
  const baseOct = 4;
  const tones = q.semis.map((s, i) => {
    const li = rootIdx + q.letters[i];
    const wrap = Math.floor(li / 7);
    const letter = LETTERS[li % 7];
    const desiredAbs = rootAbs + s; // 루트 C기준 절대 반음
    const natAbs = SEMITONE[letter] + wrap * 12; // 그 글자의 자연 절대 반음
    const acc = desiredAbs - natAbs; // 임시표 (보통 -1/0/+1)
    const oct = baseOct + wrap;
    return {
      letter,
      acc,
      octave: oct,
      diatonic: oct * 7 + LETTER_STEP[letter], // 오선 위치(y) 계산용
      midi: (oct + 1) * 12 + SEMITONE[letter] + acc, // C4=60
      solfege: SOLFEGE[letter] + accStr(acc),
      english: letter + accStr(acc),
      pitch: letter + accPitch(acc) + oct, // 'F#4' (오디오용)
    };
  });
  return {
    id: rootLetter + q.suffix, // 'Cm7'
    symbol: rootLetter + q.suffix,
    root: rootLetter,
    quality,
    ko: q.ko,
    hint: q.hint,
    tones,
    // 겹임시표(±2) 포함 여부 — 모드 출제 풀 제외 판정용 (Baug=F##)
    hasDoubleAccidental: tones.some((t) => Math.abs(t.acc) >= 2),
  };
}
