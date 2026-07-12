// src/main.js — 부트스트랩: 해시 라우터 + 오디오 오토플레이 대응.

import { state, bindView } from './game.js';
import { MODES } from './modes.js';
import { renderMenu, renderResult, renderSettings, renderMode } from './ui.js';
import { unlock } from './audio.js';

const routes = {
  menu: () => renderMenu(state),
  result: () => renderResult(state),
  settings: () => renderSettings(state),
  mode: (id) => renderMode(state, MODES.find((m) => m.id === id)),
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
