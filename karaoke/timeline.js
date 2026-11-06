// karaoke/timeline.js — 추정 타임라인 생성 + 조회 (순수 로직, DOM 모름)
// 설계 문서 docs/11-karaoke-design.md §3.2 · §4

// ── 전개 (§3.2) ───────────────────────────────────────
// 가사지는 후렴 반복을 `*` 로 생략한다. sequence 가 그 반복을 가사 복제 없이 펼친다.
// 반환: [{ text, blockIndex, lineIndex, kind, label, blockStart }]
export function expand(song) {
  const order = song.sequence ?? song.blocks.map((_, i) => i);
  const out = [];
  for (const bi of order) {
    const block = song.blocks[bi];
    if (!block) throw new Error(`${song.id}: sequence 가 없는 블록 ${bi} 를 가리킴`);
    block.lines.forEach((text, lineIndex) => {
      out.push({
        text,
        blockIndex: bi,
        lineIndex,
        kind: block.kind,
        label: block.label,
        blockStart: lineIndex === 0, // 블록 첫 줄 → 간격 투입 지점
      });
    });
  }
  return out;
}

export function countHangul(s) {
  const m = s.match(/[가-힣]/g);
  return m ? m.length : 0;
}

// 블록 경계에 투입하는 간격(초). 후렴 진입은 통상 반주가 한 마디 더 있다.
const GAP = { default: 1.2, chorus: 2.0, bridge: 2.4, outro: 1.6 };
const gapFor = (kind) => GAP[kind] ?? GAP.default;

// ── 추정 (§4.1) ───────────────────────────────────────
// 음절 수를 가중치로 가창 구간을 배분한다. 한국어 가요는 1음절 ≈ 1박.
export function estimate(song) {
  const lines = expand(song);
  if (!lines.length) throw new Error(`${song.id}: 가사가 비어 있음`);

  const w = lines.map((l) => Math.max(4, countHangul(l.text))); // 짧은 추임새 줄 방어
  const wTotal = w.reduce((a, b) => a + b, 0);

  const gaps = lines.map((l, i) => (i > 0 && l.blockStart ? gapFor(l.kind) : 0));
  const gapTotal = gaps.reduce((a, b) => a + b, 0);

  const sing = song.duration - song.intro - song.outro - gapTotal;
  // Fail Fast — intro/outro/duration 설정이 모순이면 조용히 이상한 값을 내놓지 않는다.
  if (sing <= 0) {
    throw new Error(
      `${song.id}: 가창 구간이 0 이하 (duration=${song.duration}, intro=${song.intro}, ` +
        `outro=${song.outro}, gaps=${gapTotal.toFixed(1)}) — 메타 설정을 확인하라`
    );
  }

  const out = [];
  let t = song.intro;
  for (let i = 0; i < lines.length; i++) {
    t += gaps[i];
    out.push(round2(t));
    t += (sing * w[i]) / wTotal;
  }
  return out;
}

// 추정 타임라인을 §3.4 형태로 감싼다.
export function estimateTimeline(song) {
  return {
    source: 'estimated',
    offset: 0,
    duration: song.duration,
    lines: estimate(song),
    updatedAt: new Date().toISOString(),
  };
}

// ── 재스케일 (§4.2) ───────────────────────────────────
// YouTube 가 보고한 실제 길이가 2% 이상 다르면 비율로 늘이거나 당긴다.
// 실측(tapped) 타임라인은 추측으로 훼손하지 않는다 — 호출자가 안내만 한다.
export function needsRescale(timeline, actualDuration) {
  if (!actualDuration || !timeline?.duration) return false;
  return Math.abs(actualDuration - timeline.duration) / timeline.duration > 0.02;
}

export function rescale(timeline, actualDuration) {
  if (!needsRescale(timeline, actualDuration)) return timeline;
  if (timeline.source === 'tapped') return timeline; // 실측값 보존
  const k = actualDuration / timeline.duration;
  return {
    ...timeline,
    duration: actualDuration,
    lines: timeline.lines.map((t) => round2(t * k)),
    updatedAt: new Date().toISOString(),
  };
}

// ── 조회 (§4.3) ───────────────────────────────────────
// t 시각의 줄 인덱스. 매 프레임 호출되므로 이진 탐색.
// t 가 첫 줄보다 이르면 -1 (인트로 중) → 카운트인 UI 트리거.
export function indexAt(lines, t) {
  if (!lines?.length || t < lines[0]) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lines[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// 현재 줄의 진행률 0~1 (카운트인·진행 바용)
export function progressAt(lines, t, endTime) {
  const i = indexAt(lines, t);
  const start = i < 0 ? 0 : lines[i];
  const next = i < 0 ? lines[0] : i + 1 < lines.length ? lines[i + 1] : endTime;
  if (!(next > start)) return 0;
  return clamp01((t - start) / (next - start));
}

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const round2 = (x) => Math.round(x * 100) / 100;

export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
