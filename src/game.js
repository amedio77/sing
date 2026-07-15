// src/game.js — 단일 상태 객체 + 공통 퀴즈 엔진. 프레임워크·pub/sub 없음.

import { saveSettings, PERSIST_KEYS } from './storage.js';

export const state = {
  lang: 'ko', // UI 언어: 'ko' | 'en'
  notation: 'both', // 계이름 표기: 'solfege' | 'english' | 'both'
  route: '', // 현재 해시 라우트
  audioEnabled: true, // 소리 On/Off (음소거 토글)
  mascotEnabled: true, // 마스코트 '싱가' 표시 — OFF여도 색·기호 피드백은 유지(docs/05 §5)
  timbre: 'piano', // 음색: 'simple' | 'piano' (WebAudio 합성)
  speakNames: true, // 계이름 읽어주기(TTS) — 학습 페이지 한정, audioEnabled와 AND 게이트
  volume: 0.3,
  total: 10, // 한 스테이지 문항 수 (5 | 10)
  difficulty: 'easy', // 'easy' | 'normal'
  clef: 'treble', // 모드 A 음자리표: 'treble' | 'bass' | 'both' (모드 A 카드에서 선택)
  activeModeId: null, // 현재 진행 중인 모드 id
  quiz: null, // 활성 퀴즈 세션 (createQuiz 결과)
  settingsReturn: '', // 설정(⚙) 진입 전 라우트 — 명시적 복귀용 (비영속)
  learnSeen: {}, // 학습 페이지 방문 기록 { modeId: true } — sing-progress-v1에 영속
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
  if (PERSIST_KEYS.some((k) => k in patch)) saveSettings(state); // 설정 키 변경 시 영속화
  rerender(state); // 상태 갱신 후 현재 뷰 1회 재렌더
}

// 모든 모드가 공유하는 퀴즈 엔진. 모드는 문제 생성 함수(generate)만 제공.
// question 규약: { key:str(문제 정체성), prompt():str, render(el), choices:[key], answer:key,
//                  labelFor(key):str, playAudio(), hint:str, review?:obj }
export function createQuiz({ generate, total = 10 }) {
  // 세션 내 무중복 출제(확률적 회피): key 기준 used-set 재시도 →
  // 풀 < 문항 수로 고갈되면 직전 문항과의 연속 중복만 회피 → 최종 수용(무한루프 차단).
  // key 없는 question은 dedup을 건너뛴다. generate는 순수 객체 생성이라 재시도 비용 미미.
  const MAX_RETRY = 20;
  const used = new Set();
  const questions = [];
  for (let i = 0; i < total; i++) {
    let q = generate();
    for (let r = 0; r < MAX_RETRY && q.key && used.has(q.key); r++) q = generate();
    if (q.key && used.has(q.key)) {
      const prevKey = questions[i - 1] && questions[i - 1].key;
      for (let r = 0; r < MAX_RETRY && q.key === prevKey; r++) q = generate();
    }
    if (q.key) used.add(q.key);
    questions.push(q);
  }
  return {
    total,
    index: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    firstTryCorrect: 0, // 정확도 산출용
    wrongLog: [], // 오답 리뷰용
    questions,
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
