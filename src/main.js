// src/main.js — 부트스트랩: 저장 설정 복원 + 해시 라우터 + 오디오 오토플레이 대응.

import { state, bindView } from './game.js';
import { MODES } from './modes.js';
import { renderMenu, renderResult, renderSettings, renderMode } from './ui.js';
import { renderLearn } from './learn.js';
import { unlock, setVolume, setMuted, setTimbre, stopAll } from './audio.js';
import { loadSettings, loadProgress } from './storage.js';

// 저장된 설정·진행 복원 (state = 단일 진실 소스) → audio 모듈에 1회 주입
Object.assign(state, loadSettings());
state.learnSeen = loadProgress().learnSeen;
document.documentElement.lang = state.lang; // TTS·스크린리더 보이스 선택 (이후는 setState가 갱신)
setVolume(state.volume);
setMuted(!state.audioEnabled);
setTimbre(state.timbre);

const routes = {
  menu: () => renderMenu(state),
  result: () => renderResult(state),
  settings: () => renderSettings(state),
  mode: (id) => renderMode(state, MODES.find((m) => m.id === id)),
  learn: (id) => renderLearn(state, MODES.find((m) => m.id === id)),
};

function handle() {
  // 라우트 전환 시 잔여 컨페티 정리 — 다음 화면 위로 계속 떨어지는 것 방지
  const confetti = document.querySelector('.confetti');
  if (confetti) confetti.remove();
  stopAll(); // 예약된 미래 재생 취소 — 이미 울리는 음은 자연 감쇠(각인음 절단 방지)
  // '#/mode/clef-position' → ['#','mode','clef-position']
  const parts = (location.hash || '#/menu').split('/');
  const seg = parts[1] || 'menu';
  const param = parts[2];
  const view = routes[seg] || routes.menu;
  state.route = location.hash;
  bindView(() => view(param)); // setState → 이 뷰만 1회 재렌더
  view(param);
}

window.addEventListener('hashchange', handle);

// 오토플레이 정책: 첫 사용자 제스처에 AudioContext resume
function armAudio() {
  unlock();
  window.removeEventListener('pointerdown', armAudio);
  window.removeEventListener('keydown', armAudio);
}
window.addEventListener('pointerdown', armAudio);
window.addEventListener('keydown', armAudio);

// 탭 전환·화면 잠금 시 예약분 취소 — 복귀했을 때 옛 소리가 뒤늦게 울리는 것 방지(특히 iOS)
document.addEventListener('visibilitychange', () => document.hidden && stopAll());

// PWA: 서비스워커 등록 (sw.js — 네트워크 우선이라 온라인이면 항상 최신 코드)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

handle(); // 초기 진입
