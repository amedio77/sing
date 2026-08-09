// src/audio.js — Web Audio 음정 합성. 오디오 파일 없이 OscillatorNode로 합성.
// 객체·전략 패턴 없이 모듈 스코프 상태 + 평범한 export 함수 (플랫·단순 원칙).

import { RHY_PITCH } from '../data/rhythm.js';

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SOLFEGE = { 도: 'C', 레: 'D', 미: 'E', 파: 'F', 솔: 'G', 라: 'A', 시: 'B' };

// "C4" | "F#4" | "Gb3" | "F##5"(겹임시표) | "솔4" | 주파수(number) 지원
const ACC_SEMI = { '': 0, '#': 1, '##': 2, b: -1, bb: -2 };
export function noteToFreq(note) {
  if (typeof note === 'number') return note;
  let m = String(note).match(/^([A-Ga-g])([#b]{0,2})(-?\d+)$/);
  if (!m) {
    const km = String(note).match(/^([도레미파솔라시])(-?\d+)$/);
    if (!km) throw new Error('bad note: ' + note); // fail-fast
    m = [null, SOLFEGE[km[1]], '', km[2]];
  }
  const [, letter, acc, octStr] = m;
  const semis = SEMITONE[letter.toUpperCase()] + (ACC_SEMI[acc] ?? 0);
  const midi = (parseInt(octStr, 10) + 1) * 12 + semis; // C4=60
  return 440 * Math.pow(2, (midi - 69) / 12); // A4=440
}
// 검증: noteToFreq('C4')≈261.63, noteToFreq('A4')=440, noteToFreq('C5')≈523.25

// ── 엔진 상태 (모듈 스코프) ──────────────────────────────
let ctx = null;
let master = null;
let volume = 0.3;
let muted = false;
let timbre = 'piano'; // 'simple' | 'piano' — 설정에서 변경, main.js가 저장값 주입

// 예약 재생용 — 리듬은 "클릭과 음의 정렬"이 곧 학습 내용이라 한 스냅샷에 통째로 예약한다.
const LOOKAHEAD = 0.06; // 60ms — JS 실행 + 렌더 쿼텀 여유. 0이면 엔벨로프가 과거 시각에 클램프되어 팝이 난다
const live = []; // { osc, startAt } — stopAll이 '미래 예약분만' 취소하는 데 사용
const timers = []; // setTimeout id — playSequence/playCorrect/playWrong은 취소 핸들이 없다

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null; // Web Audio 미지원 → 무음 폴백
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    // iOS 무음 스위치에서도 재생 시도 (Safari 16.4+). 미지원이면 무해한 no-op.
    // ⚠️ 사용자가 듣던 음악이 멈출 수 있다 — 실기기 검증 항목.
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      /* 미지원·정책 예외 → 무시 */
    }
  }
  return ctx;
}

// 오래된 기록 지연 정리 — onended 로 지우면 pianoVoice의 기존 disconnect 핸들러와 충돌한다
function track(osc, startAt) {
  const cutoff = ctx.currentTime - 3;
  for (let i = live.length - 1; i >= 0; i--) if (live[i].startAt < cutoff) live.splice(i, 1);
  live.push({ osc, startAt });
}

// 취소 가능한 setTimeout
function after(fn, ms) {
  const id = setTimeout(() => {
    const i = timers.indexOf(id);
    if (i >= 0) timers.splice(i, 1);
    fn();
  }, ms);
  timers.push(id);
  return id;
}

// 엔벨로프 (클릭음 방지). 지수 램프는 0 불가 → 0.0001 사용
const ATTACK = 0.01;
const RELEASE = 0.06;
function applyEnvelope(g, t0, dur, peak) {
  const end = t0 + dur;
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(peak, t0 + ATTACK);
  g.setValueAtTime(peak, Math.max(t0 + ATTACK, end - RELEASE));
  g.exponentialRampToValueAtTime(0.0001, end);
  return end + 0.02;
}

// 첫 사용자 제스처에서 AudioContext resume (오토플레이 정책)
export function unlock() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
}

// 피아노풍 합성: 배음 4개(합≈1로 정규화) + 타건 어택/지수 감쇠 + 로우패스.
// 샘플 파일 없이 '전자피아노' 근사 — 무빌드·오프라인 제약 유지(docs/05 §6).
const PIANO_PARTIALS = [
  [1, 0.62],
  [2, 0.22],
  [3, 0.1],
  [4.02, 0.05], // 살짝 비조화 4배음 — 현 울림 느낌
];
function pianoVoice(freq, t0, dur, peak) {
  const out = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(freq * 8, 6000), t0);
  lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 2, 800), t0 + Math.min(dur, 0.5)); // 타건 밝기 감쇠
  out.connect(lp);
  lp.connect(master);
  const g = out.gain;
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(peak, t0 + 0.006); // 빠른 어택(타건감)
  g.exponentialRampToValueAtTime(peak * 0.3, t0 + Math.min(0.28, dur * 0.7));
  g.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.22); // 잔향 꼬리
  const stopAt = t0 + dur + 0.25;
  const nodes = [out, lp];
  PIANO_PARTIALS.forEach(([mult, amp], i) => {
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.frequency.value = freq * mult;
    og.gain.value = amp;
    osc.connect(og);
    og.connect(out);
    osc.start(t0);
    osc.stop(stopAt);
    nodes.push(osc, og);
    track(osc, t0);
    if (i === 0) osc.onended = () => nodes.forEach((n) => n.disconnect()); // 일괄 정리
  });
}

// at: 재생 시각(ctx.currentTime 기준). null이면 '지금'.
// ⚠️ at = 0 은 유효한 시각이며 센티널이 아니다 — 부팅 첫 제스처에서 실제로 0에 가까운 값이 나온다.
export function playNote(note, durationMs = 500, { type = 'sine', peak = 1, at = null } = {}) {
  if (!ensure() || muted) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = at == null ? ctx.currentTime : Math.max(at, ctx.currentTime + 0.005);
  const dur = durationMs / 1000;
  // 음정 재생(sine)만 음색 적용 — 효과음(square 버저 등 명시 type)은 그대로
  if (timbre === 'piano' && type === 'sine') {
    pianoVoice(noteToFreq(note), t0, dur, peak);
    return;
  }
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = noteToFreq(note);
  osc.connect(env).connect(master);
  osc.start(t0);
  osc.stop(applyEnvelope(env.gain, t0, dur, peak));
  track(osc, t0);
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
}

export function playSequence(notes, gapMs = 350, durMs = 300) {
  if (!ensure()) return;
  let when = 0;
  notes.forEach((n) => {
    after(() => playNote(n, durMs), when);
    when += gapMs;
  });
}

export function playChord(notes, durationMs = 600) {
  notes.forEach((n) => playNote(n, durationMs, { peak: 0.7 })); // 클리핑 방지
}

export function playCorrect() {
  playNote('E5', 120);
  after(() => playNote('A5', 200), 110);
}

export function playWrong() {
  playNote(220, 140, { type: 'square', peak: 0.5 });
  after(() => playNote(155, 220, { type: 'square', peak: 0.5 }), 120);
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (master && !muted) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
}

export function getVolume() {
  return volume;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
  return muted;
}

export function setMuted(v) {
  muted = !!v;
  if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
}

export function setTimbre(v) {
  timbre = v === 'simple' ? 'simple' : 'piano';
}

export function getTimbre() {
  return timbre;
}

// ════════════════════════════════════════════════════════════════
// 리듬 재생 — 예약 스케줄. 연속 기준 박(메트로놈 lookahead 루프)은 넣지 않는다:
// 이번 학습 시나리오가 전부 유한 패턴이라 한 번의 스냅샷 예약으로 충분하다.
// 예약 후 JS가 개입하지 않으므로 플램 0 · 백그라운드 스로틀 무관.
// ════════════════════════════════════════════════════════════════

// 클럭 3종의 역할 구분:
//  now()       원시 오디오 시각. ctx가 없으면 null (ctx를 만들지 않는다)
//  schedTime() 예약 기준 시각(= now + LOOKAHEAD). 필요하면 ctx를 만든다
//  audioClock() 시각 동기화용 — Web Audio 미지원 시 performance.now 폴백까지 포함
export function now() {
  return ctx ? ctx.currentTime : null;
}
export function schedTime() {
  return ensure() ? ctx.currentTime + LOOKAHEAD : null;
}
export const audioClock = () => (ctx ? ctx.currentTime : performance.now() / 1000);

// 메트로놈 클릭. playNote를 경유하지 않는 전용 구현 —
// (a) 2ms 어택이 필요하다(공용 ATTACK 10ms는 45ms 클릭의 22%)
// (b) pianoVoice를 확실히 우회한다  (c) master 직결이라 볼륨·음소거가 자동 적용된다
const CLICK_HZ = [1100, 1350, 1600]; // 약 · 중강 · 강
const CLICK_PEAK = [0.32, 0.42, 0.5];
export function playClick(at, accent = 0) {
  if (!ensure() || muted) return;
  if (ctx.state !== 'running') ctx.resume();
  const t = Math.max(at, ctx.currentTime + 0.005); // 과거 시각 보정 — 엔벨로프 클램프 방지
  const i = accent === 2 ? 2 : accent === 1 ? 1 : 0;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = CLICK_HZ[i];
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(CLICK_PEAK[i], t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.06);
  track(osc, t);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

// 예약분 취소. ⚠️ '미래 예약분만' 이 핵심이다 —
// 전면 중단하면 마지막 문항의 정답 각인음(ui.js가 300ms에 재생, 잔향까지 ~1.0초)이
// 850ms 라우팅에 매번 잘리고 파형 중간 절단으로 팝 노이즈가 난다.
export function stopAll() {
  while (timers.length) clearTimeout(timers.pop());
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const rec of live.slice()) {
    if (rec.startAt > t + 0.02) {
      try {
        rec.osc.stop(t); // stopTime <= startTime → 소리가 나지 않는다
      } catch {
        /* 이미 정지된 노드 → 무시 */
      }
    }
  }
}

// ── 리듬 큐 조립 ──────────────────────────────────────
export const QUIZ_BPM = 100; // ♩ = 100. 16분음표가 150ms로 남아 변별 가능하고, 온음표 오답 대기가 3.1초 안에 든다
export const beatSec = (bpm = QUIZ_BPM) => 60 / bpm;
// 분모가 4가 아닌 박자표 환산 (6/8 → 0.3s · 2/2 → 1.2s)
export const unitSec = (ts, bpm = QUIZ_BPM) => (60 / bpm) * (4 / ts.bottom);

// 기호 1개를 "박 위의 클릭"과 함께 재생한다.
// ★ 클릭은 반드시 박 위에만 찍는다. 시작·끝 2회만 울리면 4박을 셀 수 없고,
//   비정수 박에서는 끝 클릭이 어떤 박도 아닌 곳에 떨어져 "클릭 = 음표가 끝나는 지점"을 오학습시킨다.
//   클릭은 도구가 아니라 박의 자(ruler)다.
export function rhythmCue(sym, bpm = QUIZ_BPM) {
  ensure(); // 음소거여도 ctx를 만든다 — 시각 동기화 클럭이 필요하다
  const b = beatSec(bpm);
  const t0 = audioClock() + LOOKAHEAD;
  const nBeats = Math.max(1, Math.ceil(sym.beats));
  for (let i = 0; i <= nBeats; i++) playClick(t0 + i * b, i === 0 ? 2 : 0); // 마지막 = 종료 경계
  // ⚠️ type:'triangle' 명시 필수 — 피아노 음색은 모든 음에 0.22초 잔향을 붙여
  //    ¼박(150ms)↔½박(300ms)의 2배 차이를 1.4배로 압축한다(길이 학습이 무력화된다).
  //    type을 명시하면 timbre==='piano' && type==='sine' 조건이 거짓이 되어 일반 엔벨로프 경로를 탄다.
  if (!sym.rest) playNote(RHY_PITCH, sym.beats * b * 1000, { type: 'triangle', peak: 0.9, at: t0 });
  return { t0, beatSec: b, nBeats };
}

// 재생 길이(ms) — 오답 대기 하한 산출용
export const cueMs = (sym, bpm = QUIZ_BPM) => Math.max(1, Math.ceil(sym.beats)) * (60000 / bpm) + LOOKAHEAD * 1000 + 120;
