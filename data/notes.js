// data/notes.js — 음 테이블 (계이름 / 영어 / MIDI). 단일 진실 소스, 로직 없는 순수 상수.
// 고정도(fixed do). 옥타브 경계는 C→B (B 다음이 다음 옥타브 C).

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// 계이름 ↔ 영어 (고정도). 한/영 토글 학습에 사용
export const SOLFEGE = { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' };

// letter → 옥타브 내 diatonic step 인덱스 (음→y 좌표 계산의 핵심)
export const LETTER_STEP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// MIDI 계산용 반음 오프셋 (C 기준)
export const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 음 하나를 표현하는 표준 객체 팩토리
// accidental: -1 flat, 0 natural, +1 sharp
export function makeNote(letter, octave, accidental = 0) {
  const midi = (octave + 1) * 12 + SEMITONE[letter] + accidental; // C4=60
  return {
    letter,
    octave,
    accidental,
    midi,
    solfege: SOLFEGE[letter], // '솔'
    english: letter, // 'G'
    diatonic: octave * 7 + LETTER_STEP[letter], // 오선 위치 계산용 절대 step (dv)
  };
}

// A4 = 440Hz 기준 12평균율. 오디오·표시 모두 이 하나만 신뢰
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
// 검증: midiToFreq(60)≈261.63, midiToFreq(69)===440, midiToFreq(72)≈523.25
