// src/game.js — 단일 상태 객체 + 공통 퀴즈 엔진. 프레임워크·pub/sub 없음.

export const state = {
  lang: 'ko', // UI 언어: 'ko' | 'en'
  notation: 'both', // 계이름 표기: 'solfege' | 'english' | 'both'
  route: '', // 현재 해시 라우트
  audioEnabled: true, // 소리 On/Off (음소거 토글)
  volume: 0.3,
  total: 10, // 한 스테이지 문항 수 (5 | 10)
  difficulty: 'easy', // 'easy' | 'normal'
  clef: 'treble', // 모드 A 음자리표: 'treble' | 'bass' | 'both' (홈에서 선택)
  activeModeId: null, // 현재 진행 중인 모드 id
  quiz: null, // 활성 퀴즈 세션 (createQuiz 결과)
};

let rerender = () => {}; // main.js가 현재 뷰 render를 등록
export function bindView(fn) {
  rerender = fn;
}
export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  rerender(state); // 상태 갱신 후 현재 뷰 1회 재렌더
}

// 모든 모드가 공유하는 퀴즈 엔진. 모드는 문제 생성 함수(generate)만 제공.
// question 규약: { prompt():str, render(el), choices:[key], answer:key,
//                  labelFor(key):str, playAudio(), hint:str, review?:obj }
export function createQuiz({ generate, total = 10 }) {
  return {
    total,
    index: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    firstTryCorrect: 0, // 정확도 산출용
    wrongLog: [], // 오답 리뷰용
    questions: Array.from({ length: total }, generate), // 미리 total개 생성
    current() {
      return this.questions[this.index];
    },
    submit(choice) {
      const q = this.current();
      const ok = choice === q.answer;
      if (ok) {
        this.score += 100;
        this.combo++;
        this.score += Math.min(this.combo, 5) * 20; // 콤보 보너스
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        if (!q.retried) this.firstTryCorrect++; // MVP: 재출제 없음 → retried는 항상 false
      } else {
        this.combo = 0; // 감점 없음, 콤보만 리셋
        this.wrongLog.push(q); // 표시용 기록(F-20 결과 화면 리뷰). 재출제는 백로그
      }
      this.index++;
      return { ok, done: this.index >= this.total, correct: q.answer, submitted: choice };
    },
    accuracy() {
      return this.total ? this.firstTryCorrect / this.total : 0;
    },
    stars() {
      const a = this.accuracy();
      return a === 1 ? 3 : a >= 0.85 ? 2 : a >= 0.7 ? 1 : 0;
    },
  };
}

// 모드 진입 시 퀴즈 시작 헬퍼
export function startQuiz(mode) {
  state.activeModeId = mode.id;
  state.quiz = createQuiz({ generate: mode.generate, total: state.total });
}
