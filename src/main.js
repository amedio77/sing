// src/main.js — 부트스트랩: 저장 설정 복원 + 해시 라우터 + 오디오 오토플레이 대응.

import { state, bindView } from './game.js';
import { MODES } from './modes.js';
import { renderMenu, renderResult, renderSettings, renderMode } from './ui.js';
import { renderLearn } from './learn.js';
import { unlock, setVolume, setMuted } from './audio.js';
import { loadSettings, loadProgress } from './storage.js';

// 저장된 설정·진행 복원 (state = 단일 진실 소스) → audio 모듈에 1회 주입
Object.assign(state, loadSettings());
state.learnSeen = loadProgress().learnSeen;
setVolume(state.volume);
setMuted(!state.audioEnabled);

const routes = {
  menu: () => renderMenu(state),
  result: () => renderResult(state),
  settings: () => renderSettings(state),
  mode: (id) => renderMode(state, MODES.find((m) => m.id === id)),
  learn: (id) => renderLearn(state, MODES.find((m) => m.id === id)),
};

function handle() {
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

handle(); // 초기 진입
