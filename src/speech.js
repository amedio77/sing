// src/speech.js — 계이름 읽어주기 (Web Speech API). 미지원·정책 예외 시 조용히 no-op.
// 사용 여부 게이트(speakNames·audioEnabled)는 호출부가 state로 판단한다 — 이 모듈은 발화만 담당.

let timer = null;

export function speechSupported() {
  return 'speechSynthesis' in window;
}

// 연타 대응: 이전 예약(setTimeout)과 진행 중 발화를 모두 취소하고 최신 것만 말한다.
// delayMs — 피아노 음이 먼저 들리고 이어서 이름이 나오도록 지연.
export function speakNote(text, delayMs = 0) {
  if (!speechSupported()) return;
  clearTimeout(timer);
  window.speechSynthesis.cancel();
  timer = setTimeout(() => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = /[가-힣]/.test(text) ? 'ko-KR' : 'en-US'; // 내용 기준 보이스 선택
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch {
      /* 일부 브라우저 정책 예외 → 무음 폴백 */
    }
  }, delayMs);
}
