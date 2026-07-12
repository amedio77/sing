// data/clefs.js — 음자리표별 오선 배치 & 좌표 앵커. 표준 사실 자료 1:1 반영.
// 줄(line) 1→5, 칸(space) 1→4 = 아래→위 (표준: 1번 줄이 맨 아래)

export const CLEFS = {
  treble: {
    id: 'treble',
    nameKo: '높은음자리표',
    nameEn: 'Treble clef',
    glyph: '𝄞', // 𝄞 (U+1D11E)
    lines: [['E', 4], ['G', 4], ['B', 4], ['D', 5], ['F', 5]], // 아래→위
    spaces: [['F', 4], ['A', 4], ['C', 5], ['E', 5]],
    refNote: ['G', 4], // 기준음: 둘째 줄 = G4 (G clef)
    refLineIndex: 1, // lines[1] (0-based)
    dvRef: 30, // 맨 아래 줄1 E4 의 diatonic = 4*7+2 = 30 (y=88 앵커)
    mnemonicLinesEn: 'Every Good Boy Does Fine', // EGBDF
    mnemonicSpacesEn: 'F-A-C-E',
    mnemonicLinesKo: '미 솔 시 레 파',
    mnemonicSpacesKo: '파 라 도 미',
  },
  bass: {
    id: 'bass',
    nameKo: '낮은음자리표',
    nameEn: 'Bass clef',
    glyph: '𝄢', // 𝄢 (U+1D122)
    lines: [['G', 2], ['B', 2], ['D', 3], ['F', 3], ['A', 3]],
    spaces: [['A', 2], ['C', 3], ['E', 3], ['G', 3]],
    refNote: ['F', 3], // 기준음: 넷째 줄 = F3 (F clef)
    refLineIndex: 3,
    dvRef: 18, // 맨 아래 줄1 G2 의 diatonic = 2*7+4 = 18 (y=88 앵커)
    mnemonicLinesEn: 'Good Boys Do Fine Always', // GBDFA
    mnemonicSpacesEn: 'All Cows Eat Grass', // ACEG
    mnemonicLinesKo: '솔 시 레 파 라',
    mnemonicSpacesKo: '라 도 미 솔',
  },
};

// 두 음자리표 공유음: 가온다 C4 (treble 아래 첫 덧줄 = bass 위 첫 덧줄)
export const MIDDLE_C = ['C', 4];
