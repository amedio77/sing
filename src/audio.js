// src/audio.js — Web Audio 음정 합성. 오디오 파일 없이 OscillatorNode로 합성.
// 객체·전략 패턴 없이 모듈 스코프 상태 + 평범한 export 함수 (플랫·단순 원칙).

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SOLFEGE = { 도: 'C', 레: 'D', 미: 'E', 파: 'F', 솔: 'G', 라: 'A', 시: 'B' };

// "C4" | "F#4" | "Gb3" | "솔4" | 주파수(number) 지원
export function noteToFreq(note) {
  if (typeof note === 'number') return note;
  let m = String(note).match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!m) {
    const km = String(note).match(/^([도레미파솔라시])(-?\d+)$/);
    if (!km) throw new Error('bad note: ' + note); // fail-fast
    m = [null, SOLFEGE[km[1]], '', km[2]];
  }
  const [, letter, acc, octStr] = m;
  const semis = SEMITONE[letter.toUpperCase()] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
  const midi = (parseInt(octStr, 10) + 1) * 12 + semis; // C4=60
  return 440 * Math.pow(2, (midi - 69) / 12); // A4=440
}
// 검증: noteToFreq('C4')≈261.63, noteToFreq('A4')=440, noteToFreq('C5')≈523.25

// ── 엔진 상태 (모듈 스코프) ──────────────────────────────
let ctx = null;
let master = null;
let volume = 0.3;
let muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null; // Web Audio 미지원 → 무음 폴백
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
  }
  return ctx;
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

export function playNote(note, durationMs = 500, { type = 'sine', peak = 1 } = {}) {
  if (!ensure() || muted) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = ctx.currentTime;
  const dur = durationMs / 1000;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = noteToFreq(note);
  osc.connect(env).connect(master);
  osc.start(t0);
  osc.stop(applyEnvelope(env.gain, t0, dur, peak));
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
}

export function playSequence(notes, gapMs = 350, durMs = 300) {
  if (!ensure()) return;
  let when = 0;
  notes.forEach((n) => {
    setTimeout(() => playNote(n, durMs), when);
    when += gapMs;
  });
}

export function playChord(notes, durationMs = 600) {
  notes.forEach((n) => playNote(n, durationMs, { peak: 0.7 })); // 클리핑 방지
}

export function playCorrect() {
  playNote('E5', 120);
  setTimeout(() => playNote('A5', 200), 110);
}

export function playWrong() {
  playNote(220, 140, { type: 'square', peak: 0.5 });
  setTimeout(() => playNote(155, 220, { type: 'square', peak: 0.5 }), 120);
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
