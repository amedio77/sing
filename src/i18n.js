// src/i18n.js — 한/영 딕셔너리 + t(), noteLabel().
// 두 개의 독립 축: (1) UI 언어(DICT)  (2) 계이름 표기(notation).

import { getState } from './game.js';

const DICT = {
  ko: {
    appTitle: '악보 배우기',
    appSubtitle: '음악 이론 첫걸음 학습 게임',
    // 메뉴
    start: '시작',
    difficulty: '난이도',
    easy: '쉬움',
    normal: '보통',
    questions: '문항수',
    // 모드
    clefPosition: '음자리표 위치',
    clefPositionDesc: '오선 위 음의 이름 찾기',
    noteMatching: '계이름 매칭',
    noteMatchingDesc: '도레미 ↔ ABC',
    keyOrder: '조표 순서',
    keyOrderDesc: '♯ · ♭ 붙는 순서',
    // 앱바
    home: '홈',
    back: '뒤로',
    settings: '설정',
    sound: '사운드',
    volume: '볼륨',
    language: '언어',
    // 프롬프트
    askNoteName: '이 음의 이름은?',
    askMatchTo: '이것과 같은 음은?',
    askNextAccidental: '다음에 붙는 것은?',
    askNthAccidental: '번째는?',
    sharp: '샤프',
    flat: '플랫',
    // 피드백/결과
    correct: '정답!',
    wrong: '아쉬워요',
    hint: '힌트',
    listen: '들어보기',
    resultTitle: '정답!',
    accuracy: '정확도',
    reviewWrong: '틀린 문제 다시 보기',
    allCorrect: '모두 맞혔어요! 완벽해요 🎉',
    playAgain: '다시 하기',
    toHome: '홈으로',
    score: '점수',
    combo: '콤보',
    ordinal: '', // 한국어는 "3번째" → 접미 방식으로 처리
    settingsFootnote: '(진행 저장·별 해금은 후속 버전)',
  },
  en: {
    appTitle: 'Learn the Staff',
    appSubtitle: 'A beginner music-theory game',
    start: 'Start',
    difficulty: 'Difficulty',
    easy: 'Easy',
    normal: 'Normal',
    questions: 'Questions',
    clefPosition: 'Clef Position',
    clefPositionDesc: 'Name the note on the staff',
    noteMatching: 'Note Matching',
    noteMatchingDesc: 'Do-Re-Mi ↔ ABC',
    keyOrder: 'Key Signature Order',
    keyOrderDesc: 'Order of ♯ · ♭',
    home: 'Home',
    back: 'Back',
    settings: 'Settings',
    sound: 'Sound',
    volume: 'Volume',
    language: 'Language',
    askNoteName: 'Name this note',
    askMatchTo: 'Which is the same note?',
    askNextAccidental: 'Which comes next?',
    askNthAccidental: 'th one?',
    sharp: 'Sharp',
    flat: 'Flat',
    correct: 'Correct!',
    wrong: 'Not quite',
    hint: 'Hint',
    listen: 'Listen',
    resultTitle: 'Correct!',
    accuracy: 'Accuracy',
    reviewWrong: 'Review missed questions',
    allCorrect: 'Perfect score! 🎉',
    playAgain: 'Play again',
    toHome: 'Home',
    score: 'Score',
    combo: 'Combo',
    ordinal: '',
    settingsFootnote: '(Progress save & unlocks: later version)',
  },
};

export function t(key) {
  const lang = getState().lang;
  return DICT[lang][key] ?? DICT.ko[key] ?? key;
}

// 음이름 표기: UI 언어와 별개로 notation 축을 따른다.
// note 는 makeNote() 결과 또는 {solfege, english} 를 가진 객체.
export function noteLabel(note) {
  switch (getState().notation) {
    case 'solfege':
      return note.solfege; // "도"
    case 'english':
      return note.english; // "C"
    default:
      return `${note.solfege} · ${note.english}`; // "도 · C"
  }
}

// 영어 letter(key) 하나로부터 표기 라벨 생성 (보기 버튼용)
const SOLFEGE = { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' };
export function letterLabel(letter) {
  const base = letter.replace(/[#b]/, '');
  const acc = letter.includes('#') ? '♯' : letter.includes('b') ? '♭' : '';
  const note = { solfege: (SOLFEGE[base] ?? base) + acc, english: base + acc };
  return noteLabel(note);
}
