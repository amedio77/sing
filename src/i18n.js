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
    // 음자리표 선택 (모드 A 카드 내)
    clef: '음자리표',
    treble: '높은음',
    bass: '낮은음',
    both: '둘 다',
    playOptions: '플레이 옵션',
    // 계이름 표기 (설정)
    notation: '계이름 표기',
    notationSolfege: '도레미',
    notationEnglish: 'CDE',
    notationBoth: '도 · C',
    // 모드 D: 피아노 코드
    chord: '피아노 코드',
    chordDesc: '화음 ↔ 구성음',
    askChordName: '이 화음의 코드는?',
    askChordNotes: '이 코드의 구성음은?',
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
    settingsFootnote: '※ 설정은 이 기기에 자동 저장돼요',
    // 학습 페이지
    learn: '학습',
    startQuizNow: '▶ 바로 퀴즈 시작',
    learnAndRetry: '📖 학습하고 다시 풀기',
    lowScoreNudge: '개념을 학습하고 다시 도전해 보세요!',
    mnemonic: '외우는 법',
    tapLineOrSpace: '줄·칸이나 아래 버튼을 눌러 음을 확인해 보세요',
    lineWord: '줄',
    spaceWord: '칸',
    middleCTitle: '가온다 C4 이야기',
    middleCDesc: '높은음자리표 아래 첫 덧줄과 낮은음자리표 위 첫 덧줄은 같은 음, 가온다(C4)예요.',
    listenMiddleC: '🔊 가온다 듣기',
    fixedDoTitle: '고정도 (Fixed Do)',
    fixedDoDesc: '조가 바뀌어도 「도」는 언제나 C예요.',
    octaveCycleDesc: '시(B) 다음은 다시 도(C5) — 옥타브 번호가 1 올라가요.',
    playInOrder: '🔊 차례로 듣기',
    signType: '종류',
    majorSuffix: '장조',
    noKeySig: '조표 없음',
    reverseRule: '플랫 순서는 샤프 순서의 정확한 역순!',
    quickKeyRule: '조 이름 빨리 찾기',
    rootLabel: '루트',
    qualityLabel: '성질',
    stackThirds: '3도씩 쌓기',
    stackDesc: '루트 위에 3도를 두 번 쌓으면 3화음이 돼요.',
    playStacked: '🔊 쌓아서 듣기',
    playTogether: '🔊 한번에 듣기',
    compareMajMin: '🎧 메이저 vs 마이너',
    doubleAccNote: '♯♯(겹올림표)가 필요한 특수 코드예요 — 퀴즈에는 나오지 않아요',
    third: '3도',
    fifth: '5도',
    seventh: '7도',
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
    clef: 'Clef',
    treble: 'Treble',
    bass: 'Bass',
    both: 'Both',
    playOptions: 'Play options',
    notation: 'Note names',
    notationSolfege: 'Do Re Mi',
    notationEnglish: 'C D E',
    notationBoth: 'Do · C',
    chord: 'Chords',
    chordDesc: 'Chord ↔ notes',
    askChordName: 'Name this chord',
    askChordNotes: 'Pick the notes',
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
    settingsFootnote: '※ Settings are saved on this device',
    learn: 'Learn',
    startQuizNow: '▶ Start the quiz',
    learnAndRetry: '📖 Review & retry',
    lowScoreNudge: 'Review the concepts and try again!',
    mnemonic: 'How to remember',
    tapLineOrSpace: 'Tap a line, space, or a button below to hear the note',
    lineWord: 'line',
    spaceWord: 'space',
    middleCTitle: 'Middle C (C4)',
    middleCDesc: 'The first ledger line below the treble staff and above the bass staff are the same note: middle C (C4).',
    listenMiddleC: '🔊 Hear middle C',
    fixedDoTitle: 'Fixed Do',
    fixedDoDesc: '"Do" is always C, whatever the key.',
    octaveCycleDesc: 'After B comes C again (C5) — one octave up.',
    playInOrder: '🔊 Play in order',
    signType: 'Type',
    majorSuffix: 'major',
    noKeySig: 'No sharps or flats',
    reverseRule: 'Flats are exactly the sharps in reverse!',
    quickKeyRule: 'Find the key fast',
    rootLabel: 'Root',
    qualityLabel: 'Quality',
    stackThirds: 'Stack in thirds',
    stackDesc: 'Stack two thirds on the root to build a triad.',
    playStacked: '🔊 Hear one by one',
    playTogether: '🔊 Hear together',
    compareMajMin: '🎧 Major vs minor',
    doubleAccNote: 'This chord needs a double sharp — it never appears in quizzes',
    third: '3rd',
    fifth: '5th',
    seventh: '7th',
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
