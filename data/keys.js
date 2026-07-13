// data/keys.js — 조표 순서 + 조표 개수별 장조. 표준 사실 자료 1:1 반영.

// 샤프 순서와 플랫 순서는 서로 정확히 역순
export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
export const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export const SHARP_MNEMONIC_EN = 'Father Charles Goes Down And Ends Battle';
export const FLAT_MNEMONIC_EN = "Battle Ends And Down Goes Charles' Father";
export const SHARP_MNEMONIC_KO = '파 도 솔 레 라 미 시';
export const FLAT_MNEMONIC_KO = '시 미 라 레 솔 도 파';

// 계이름 매핑 (칩 한/영 병기용)
export const SOLFEGE = { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' };

// 조표 개수(0~7) → 장조. index = 조표 수
export const SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
export const FLAT_KEYS = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

// 설명 데이터(로직 아님). 조 판별 규칙 — 학습 페이지 해설용 (clefs.js 니모닉처럼 한/영 쌍)
export const KEY_RULES = [
  { ko: '마지막 샤프의 반음 위가 으뜸음', en: 'A half step above the last sharp is the tonic' },
  { ko: '끝에서 두 번째 플랫이 으뜸음 (단, ♭ 1개는 F장조)', en: 'The second-to-last flat names the key (1 flat = F major)' },
  { ko: '인접 조표는 완전5도 간격 (샤프는 위로, 플랫은 아래로)', en: 'Adjacent key signatures are a perfect fifth apart (sharps up, flats down)' },
];
