# 설계 문서: 음악 이론 학습 게임 (Music Theory Trainer)

| 항목 | 내용 |
|---|---|
| 프로젝트명 | 악보 배우기 (Music Theory Trainer) |
| 문서 종류 | 설계 문서 (Design) |
| 작성일 | YYYY-MM-DD |
| 버전 | v0.2 |
| 대상 독자 | 프론트엔드 구현 담당 / 리뷰어 |
| 스택 | 무빌드 바닐라 JS (ES Modules) · SVG 직접 렌더 · Web Audio · Vercel 정적 배포 |

---

## 1. 개요 & 설계 원칙

### 1.1 목표
음악 입문자(초등~성인 초보)가 **오선 위 음 위치**, **계이름↔영어 음이름 대응**, **조표 붙는 순서**를 "짧게, 자주, 소리와 함께" 익히도록 하는 캐주얼 학습 게임. 1문제 = 5초 미니 사이클, 1스테이지 = 10~15문제, 2~3분 내 완료.

### 1.2 설계 원칙
- **무빌드 · 플랫 구조 (KISS)**: 번들러·트랜스파일러·프레임워크 없음. `<script type="module">` + import/export. 계층 아키텍처·구독 상태관리·플러그인 레지스트리 같은 간접 계층을 두지 않는다.
- **단일 진실 소스(SSOT)**: 모든 음악 이론 상수는 `data/`에 로직 없는 순수 상수로 두고, 표준 사실 자료 값을 1:1 반영한다.
- **DRY**: 3개 모드가 하나의 퀴즈 엔진을 공유하고, 모드는 문제 생성·렌더·채점 함수만 제공한다.
- **YAGNI**: 로그인·랭킹 서버·캐릭터 육성·통계 대시보드 배제. 진행 저장·별 해금은 MVP 제외(→ §10 백로그).
- **Fail-fast**: 잘못된 음 표기 파싱은 즉시 예외.
- **접근성 우선**: 색 단독 의존 금지(색 + 아이콘 + 모양 + 소리 4중 채널), 키보드 전 조작, 48×48px 터치 타깃.

### 1.3 배포 / 실행
- **Vercel 정적 배포(무빌드)**: Framework Preset = "Other", Build Command 없음, Output Directory = 루트. `vercel.json` 불필요.
- 배포 트리거: GitHub 연결 → push 자동 배포 (또는 `vercel --prod`).
- Vercel은 HTTPS로 서빙하므로 ES Modules가 정상 동작한다.
- 로컬 개발: `npx serve` 또는 `vercel dev` (정적 서버 한 줄, 별도 빌드 없음).

---

## 2. 시스템 아키텍처

### 2.1 파일 트리 (플랫, ~12파일 / 2폴더)
```
/
├── index.html       # 단일 진입점: #app 컨테이너 + main.js 모듈 로드
├── styles.css       # 전역 스타일 (컬러 토큰·오선·버튼·레이아웃)
│
├── data/            # 단일 진실 소스 (순수 상수, 로직 없음)
│   ├── notes.js     # 음 테이블 (계이름/영어/MIDI), 주파수 공식
│   ├── clefs.js     # 음자리표별 오선 배치 (줄/칸 → 음), 좌표 앵커
│   └── keys.js      # 조표 순서 배열, 조표 개수별 장조 테이블
│
└── src/
    ├── audio.js     # Web Audio 합성 (noteToFreq, playNote…)
    ├── staff.js     # SVG 오선/음표 렌더러 (noteToY, drawStaff…)
    ├── i18n.js      # 한/영 딕셔너리 + t(), noteLabel()
    ├── game.js      # 단일 state 객체 + 퀴즈 엔진 (문제 큐·채점·점수·콤보)
    ├── modes.js     # 3개 모드 배열 [{id,name,generate,render,check}]
    ├── ui.js        # 홈·결과·공통 조각(앱바·버튼·진행바·언어토글)
    └── main.js      # 부트스트랩: 해시 라우터, 오디오/상태 초기화
```
> `storage.js`(localStorage 진행 저장)는 **후순위/선택** — MVP 제외(§10).

### 2.2 상태·렌더 흐름 (프레임워크·pub/sub 없음)
- 단일 `state` 객체(`game.js`)를 `main.js`의 **해시 라우터**가 읽어 현재 뷰의 `render(state)`를 **직접 호출**한다.
- `setState(patch)`는 상태를 갱신한 뒤 **현재 뷰를 1회 재렌더**한다. 구독자 Set·subscribe·unsubscribe 없음.
```
hashchange → 라우터가 현재 뷰 render(state) 호출
   → 사용자 답 클릭/키 입력 → quiz.submit()
   → setState({quiz}) → 현재 뷰 1회 재렌더 (+ audio.playNote 정답음)
   → 마지막 문제 → location.hash = '#/result'
```

---

## 3. 데이터 모델

> 모든 값은 표준 사실 자료를 그대로 반영한다. 로직 없는 순수 상수로 export.

### 3.1 `data/notes.js` — 음 테이블 (계이름 / 영어 / MIDI)
```js
// 고정도(fixed do). 옥타브 경계는 C→B (B 다음이 다음 옥타브 C)
export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// 계이름 ↔ 영어 (고정도). 한/영 토글 학습에 사용
export const SOLFEGE = { C:'도', D:'레', E:'미', F:'파', G:'솔', A:'라', B:'시' };

// letter → 옥타브 내 diatonic step 인덱스 (음→y 좌표 계산의 핵심)
export const LETTER_STEP = { C:0, D:1, E:2, F:3, G:4, A:5, B:6 };

// MIDI 계산용 반음 오프셋 (C 기준)
export const SEMITONE = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };

// 음 하나를 표현하는 표준 객체 팩토리
// accidental: -1 flat, 0 natural, +1 sharp
export function makeNote(letter, octave, accidental = 0) {
  const midi = (octave + 1) * 12 + SEMITONE[letter] + accidental; // C4=60
  return {
    letter, octave, accidental, midi,
    solfege: SOLFEGE[letter],                    // '솔'
    english: letter,                             // 'G'
    diatonic: octave * 7 + LETTER_STEP[letter],  // 오선 위치 계산용 절대 step (dv)
  };
}

// A4 = 440Hz 기준 12평균율. 오디오·표시 모두 이 하나만 신뢰
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
// 검증: midiToFreq(60)≈261.63, midiToFreq(69)===440, midiToFreq(72)≈523.25
```

**표준 주파수 표 (MIDI 60~72, 검증용 상수)**

| MIDI | 음이름 | 계이름 | Hz |
|---|---|---|---|
| 60 | C4 | 도(가온다) | 261.63 |
| 62 | D4 | 레 | 293.66 |
| 64 | E4 | 미 | 329.63 |
| 65 | F4 | 파 | 349.23 |
| 67 | G4 | 솔 | 392.00 |
| 69 | A4 | 라 | 440.00 (기준) |
| 71 | B4 | 시 | 493.88 |
| 72 | C5 | 도(높은) | 523.25 |

### 3.2 `data/clefs.js` — 음자리표별 오선 배치 & 좌표 앵커
```js
// 줄(line) 1→5, 칸(space) 1→4 = 아래→위 (표준: 1번 줄이 맨 아래)
export const CLEFS = {
  treble: {
    id: 'treble',
    nameKo: '높은음자리표', nameEn: 'Treble clef',
    lines:  [['E',4],['G',4],['B',4],['D',5],['F',5]],   // 아래→위
    spaces: [['F',4],['A',4],['C',5],['E',5]],
    refNote: ['G', 4],   // 기준음: 둘째 줄 = G4 (G clef)
    refLineIndex: 1,     // lines[1] (0-based)
    dvRef: 30,           // 맨 아래 줄1 E4 의 diatonic = 4*7+2 = 30 (y=88 앵커)
    mnemonicLinesEn: 'Every Good Boy Does Fine',   // EGBDF
    mnemonicSpacesEn: 'F-A-C-E',
    mnemonicLinesKo: '미 솔 시 레 파',
    mnemonicSpacesKo: '파 라 도 미',
  },
  bass: {
    id: 'bass',
    nameKo: '낮은음자리표', nameEn: 'Bass clef',
    lines:  [['G',2],['B',2],['D',3],['F',3],['A',3]],
    spaces: [['A',2],['C',3],['E',3],['G',3]],
    refNote: ['F', 3],   // 기준음: 넷째 줄 = F3 (F clef)
    refLineIndex: 3,
    dvRef: 18,           // 맨 아래 줄1 G2 의 diatonic = 2*7+4 = 18 (y=88 앵커)
    mnemonicLinesEn: 'Good Boys Do Fine Always',   // GBDFA
    mnemonicSpacesEn: 'All Cows Eat Grass',        // ACEG
    mnemonicLinesKo: '솔 시 레 파 라',
    mnemonicSpacesKo: '라 도 미 솔',
  },
};

// 두 음자리표 공유음: 가온다 C4 (treble 아래 첫 덧줄 = bass 위 첫 덧줄)
export const MIDDLE_C = ['C', 4];
```

### 3.3 `data/keys.js` — 조표 순서 + 조표별 키
```js
// 샤프 순서와 플랫 순서는 서로 정확히 역순
export const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
export const FLAT_ORDER  = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export const SHARP_MNEMONIC_EN = 'Father Charles Goes Down And Ends Battle';
export const FLAT_MNEMONIC_EN  = "Battle Ends And Down Goes Charles' Father";
export const SHARP_MNEMONIC_KO = '파 도 솔 레 라 미 시';
export const FLAT_MNEMONIC_KO  = '시 미 라 레 솔 도 파';

// 조표 개수(0~7) → 장조. index = 조표 수
export const SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
export const FLAT_KEYS  = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

// 설명 데이터(로직 아님). 모드 C 힌트/해설용
export const KEY_RULES = {
  sharp: '마지막 샤프의 반음 위가 으뜸음',
  flat:  '끝에서 두 번째 플랫이 으뜸음 (단, ♭ 1개는 F장조)',
  interval: '인접 조표는 완전5도 간격 (샤프는 위로, 플랫은 아래로)',
};
```

---

## 4. 상태 & 퀴즈 엔진 — `src/game.js`

### 4.1 단일 상태 객체 (구독 없음)
```js
// 프레임워크·pub/sub 없음. main.js 라우터가 이 state를 읽어 뷰 render(state) 직접 호출.
export const state = {
  lang: 'ko',                 // UI 언어: 'ko' | 'en'
  notation: 'both',           // 계이름 표기: 'solfege' | 'english' | 'both'
  route: '',                  // 현재 해시 라우트
  audioEnabled: true,
  volume: 0.3,
  quiz: null,                 // 활성 퀴즈 세션 (§4.2가 채움)
};

let rerender = () => {};                     // main.js가 현재 뷰 render를 등록
export function bindView(fn) { rerender = fn; }
export function getState() { return state; }

export function setState(patch) {
  Object.assign(state, patch);
  rerender(state);                           // 상태 갱신 후 현재 뷰 1회 재렌더
}
```

### 4.2 공통 퀴즈 엔진
```js
// 모든 모드가 공유. 모드는 문제 생성 함수만 제공.
export function createQuiz({ generate, total = 10 }) {
  return {
    total, index: 0, score: 0, combo: 0, maxCombo: 0,
    firstTryCorrect: 0,                                  // 정확도 산출용
    wrongLog: [],                                        // 오답 리뷰용
    questions: Array.from({ length: total }, generate),  // {prompt, choices, answer, ...}
    current() { return this.questions[this.index]; },
    submit(choice) {
      const q = this.current();
      const ok = choice === q.answer;
      if (ok) {
        this.score += 100;
        this.combo++;
        this.score += Math.min(this.combo, 5) * 20;      // 콤보 보너스
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        if (!q.retried) this.firstTryCorrect++;            // MVP: 재출제 없음 → retried는 항상 false
      } else {
        this.combo = 0;                                  // 감점 없음, 콤보만 리셋
        this.wrongLog.push(q);                            // 표시용 기록(F-20 결과 화면 리뷰). 재출제는 백로그
      }
      this.index++;
      return { ok, done: this.index >= this.total, correct: q.answer };
    },
    accuracy() { return this.firstTryCorrect / this.total; },
    stars() {                                            // 정확도 → 별 1~3 (세션 표시용)
      const a = this.accuracy();
      return a === 1 ? 3 : a >= 0.85 ? 2 : a >= 0.70 ? 1 : 0;
    },
  };
}
```

### 4.3 해시 라우터 — `src/main.js`
```js
// 라우트 예: #/menu, #/mode/clef-position, #/result
import { state, bindView } from './game.js';
import { MODES } from './modes.js';
import { renderMenu, renderResult, renderSettings, renderMode } from './ui.js';

const routes = {
  menu:     () => renderMenu(state),
  result:   () => renderResult(state),
  settings: () => renderSettings(state),
  mode:     (id) => renderMode(state, MODES.find(m => m.id === id)),
};

function handle() {
  const [, seg, param] = (location.hash || '#/menu').split('/');  // ['#','mode','clef-position']
  const view = routes[seg] || routes.menu;
  state.route = location.hash;
  bindView(() => view(param));    // setState → 이 뷰만 1회 재렌더
  view(param);
}
window.addEventListener('hashchange', handle);
handle();  // 초기 진입
```

---

## 5. SVG 오선/음표 렌더링 설계

### 5.1 좌표계 (KISS)
```
viewBox = "0 0 320 200"     // 세로 200 고정, 폭만 반응형 스케일
STAFF_LEFT   = 70           // 음자리표 자리 확보
STAFF_RIGHT  = 300          // 오선 오른쪽 끝
SPACE = 12                  // 인접 줄 간격(px)
HALF  = 6                   // 반 칸 = 한 diatonic step = SPACE/2
NOTE_X = 185                // 문제당 음표 1개, 가로 중앙 고정
```

**핵심 규칙**: 한 diatonic step 올라갈 때마다 y는 정확히 `HALF(6)`만큼 위로(감소). 줄→칸→줄→칸이 자동 표현된다.

### 5.2 5줄 y 좌표 (아래→위)
```
      ┌─────────────────────────────┐
줄5   │ ───────────────────── y=40   │  F5(t) / A3(b)
칸4   │            (space)     y=46   │
줄4   │ ───────────────────── y=52   │  D5(t) / F3(b) ← F clef 기준음
칸3   │            (space)     y=58   │
줄3   │ ─────────────●─────── y=64   │  B4(t) / D3(b)  가운데 줄
칸2   │            (space)     y=70   │
줄2   │ ───────────────────── y=76   │  G4(t) ← G clef 기준음 / B2(b)
칸1   │            (space)     y=82   │
줄1   │ ───────────────────── y=88   │  E4(t) / G2(b)  맨 아래
      └─────────────────────────────┘
       덧줄 위: 28,16…   덧줄 아래: 100,112…
```
5줄 그리기: `y ∈ {40,52,64,76,88}`, `<line x1=70 x2=300 stroke=var(--ink) stroke-width=1.4>`.

### 5.3 음 → y 좌표 공식 (음자리표 통합)
```js
// src/staff.js
import { LETTER_STEP } from '../data/notes.js';

const SPACE = 12, HALF = 6;
const BASE_Y = 88;              // 맨 아래 줄(line 1)의 y

// dv = octave*7 + LETTER_STEP[letter]  (C=0 … B=6)
// y = BASE_Y - (dv - clef.dvRef) * HALF
export function noteToY(note, clef) {
  return BASE_Y - (note.diatonic - clef.dvRef) * HALF;
}
```

| 음자리표 | 기준(줄1) | dvRef |
|---|---|---|
| 높은음자리표 (treble/G) | E4 → 4·7+2 = 30 | **30** |
| 낮은음자리표 (bass/F) | G2 → 2·7+4 = 18 | **18** |

**검증 (표준 사실 100% 일치)**
- Treble: E4→y88(줄1), G4→y76(줄2, G clef 기준음✓), B4→y64(줄3), D5→y52(줄4), F5→y40(줄5). 칸 F4→82, A4→70, C5→58, E5→46 (FACE✓). 가온다 C4(dv28)→ 88-(28-30)·6 = **y100** = 오선 아래 첫 덧줄✓.
- Bass: G2→y88(줄1), B2→76, D3→64, F3→52(줄4, F clef 기준음✓), A3→40(줄5). 칸 A2→82, C3→70, E3→58, G3→46✓. 가온다 C4(dv28)→ 88-(28-18)·6 = **y28** = 오선 위 첫 덧줄✓.

> `dvRef` 하나만 바꾸면 두 음자리표·덧줄·옥타브 전부 처리. C4가 양쪽 공유 앵커(MIDDLE_C)라 덧줄이 일관 처리된다.

### 5.4 함수 시그니처
```js
// SVG는 문자열보다 createElementNS 사용(재렌더·이벤트 바인딩 용이)
const SVG = 'http://www.w3.org/2000/svg';

export function drawStaff(clef): SVGGElement;
//   → line5..line1(y 40·52·64·76·88) + clef 심볼 배치 반환

export function noteToY(note, clef): number;          // §5.3

export function drawNote(note, clef): SVGGElement;
//   → notehead(ellipse) + 필요 시 ledgerLines() + 접근성 <title>

export function ledgerYs(yNote): number[];            // §5.6

export function hitZones(clef): SVGRect[];            // §5.7 (B형 클릭 판정)
```

### 5.5 음자리표 기호 (clef) 표기
**결론: 인라인 SVG `<path>`를 1순위.** 이유:
- 유니코드 𝄞(U+1D11E)/𝄢(U+1D122)는 Musical Symbols 블록으로 시스템 폰트 지원이 불안정(Windows 기본·일부 모바일 미표시/크기 제어 불가).
- SMuFL/Bravura 폰트 임베드는 무빌드에 과함(로드·라이선스) → YAGNI.
- 채택: 두 음자리표 path 문자열을 JS 상수로 보관, `<path d="…" fill=var(--ink)>`. 폴백으로 유니코드 `<text>` 하나.

**배치(기준음 정렬 필수)**
- Treble: G clef 나선 중심을 **줄2(y=76, G4)** 에 정렬. 가로 `x=12`, 폭 ≈40.
- Bass: F clef 두 점을 **줄4(y=52, F3)** 위아래(y46/y58)로 정렬.
- scale S = 오선 span(4·SPACE=48)에 맞춰 원본 clef 높이 정규화.

### 5.6 음표 머리(notehead) & 덧줄
```js
// 살짝 기울인 타원 (4분/온음표 느낌). 음높이 판별이 목적 → stem 생략 가능(KISS)
export function drawNote(note, clef) {
  const y = noteToY(note, clef);
  // <ellipse cx=185 cy={y} rx=8 ry=6 transform="rotate(-20 185 {y})" fill=var(--ink)>
  // y가 오선 범위(40~88) 밖이면 ledgerYs(y)로 덧줄 전부 그림
}

// 덧줄 y 후보: 위 = 40-12k, 아래 = 88+12k  (k=1,2,3…)
export function ledgerYs(yNote) {
  const ys = [];
  for (let y = 28;  y >= yNote - 1; y -= 12) ys.push(y);  // 위쪽 28,16…
  for (let y = 100; y <= yNote + 1; y += 12) ys.push(y);  // 아래쪽 100,112…
  return ys;
}
// 각 덧줄: <line x1=172 x2=198> (음표중심 ±13), stroke-width 1.4
// 가온다 첫 덧줄은 입문 필수 → 정답 시 --brand 로 잠깐 강조
```

### 5.7 B형(위치 클릭) 히트 영역
- 각 줄·칸에 투명 `<rect>` 히트존, 실제 높이 12(한 step) 단위로 촘촘히. 손가락 오차는 가장 가까운 `dv`로 스냅.
- `data-dv` 속성에 diatonic 값 저장 → 클릭 시 `dv` 비교로 판정.
- hover/focus 시 `--brand-050` 로 옅게 표시(클릭 가능 영역 시각화).

### 5.8 반응형
```css
svg.staff { width:100%; height:auto; max-width:420px; }
```
`preserveAspectRatio="xMidYMid meet"`. 가로 스크롤 금지.

---

## 6. 게임 모드 (`src/modes.js`)

### 6.0 공통 상태 머신 (3모드 공유)
```
idle → present → awaitInput → judge
                                 ├─ correct → feedback(+음,+점수,+콤보) → next
                                 └─ wrong   → feedback(정답표시+음+니모닉, 콤보리셋) → next
next → (남은 문제? present : stageEnd)
stageEnd → result
```
모드별 차이는 `awaitInput`·`judge` 내용뿐. **MVP는 재출제하지 않는다** — 오답은 `wrongLog`에 기록해 결과 화면 리뷰(§7.7)에만 쓴다. 오답 문제의 **스테이지 끝 1회 재출제**는 후순위(§10.5·계획 §9).

### 6.1 모드 배열
```js
// modes.js — 3개 모드 = 평범한 배열. 새 모드 = 객체 1개 추가(레지스트리·전략패턴 없음).
// 모드 인터페이스: { id, name, generate() → {choices,answer,render,playAudio,hint}, render(el,q), check(input,q) → bool }
import { CLEFS } from '../data/clefs.js';
import { drawNote } from './staff.js';
import { playNote } from './audio.js';
import { getState } from './game.js';

const clefPosition = {
  id: 'clef-position', name: '음자리표 위치',
  generate() {
    const clef = pickRandom([CLEFS.treble, CLEFS.bass]);
    const note = pickRandomNoteOn(clef);
    return {
      render: (svgEl) => drawNote(note, clef),
      choices: shuffledSolfegeChoices(note),
      answer:  getState().lang === 'ko' ? note.solfege : note.english,
      playAudio: () => playNote(note.midi),
      hint: `${clef.mnemonicLinesKo} / ${clef.mnemonicLinesEn}`,
    };
  },
};

export const MODES = [clefPosition, noteMatching, keyOrder];
```

### 6.2 모드 A — 음자리표 음 위치 (Note Reading)
**목표**: 오선 위치 ↔ 계이름/영문 양방향 + 음자리표 전환.

| 유형 | 제시 | 입력 | 판정 |
|---|---|---|---|
| A-읽기 (MVP) | 오선에 음표 1개 SVG | 보기 4지선다 | 선택 == 정답 이름? |
| A-쓰기 (확장·백로그, F-04) | "레(D)를 놓으세요" 텍스트+음버튼 | 오선 줄/칸 클릭(가장 가까운 dv 스냅) | 클릭 dv == 정답 dv? |

**난이도 레버**
| Lv | 음자리표 | 음역 | 비고 |
|---|---|---|---|
| 1 | 높은음자리표 | 오선 안 자연음 | 타이머 없음 |
| 2 | 높은음자리표 | 오선 + 위/아래 한 칸 | |
| 3 | 낮은음자리표 | 오선 안 | 자리표 전환 강조 |
| 4 | 혼합(랜덤) | 오선 안 | 자리표 아이콘 항상 표시 |
| 5(선택) | 혼합 | 덧줄(가온다) 1개 | 청음 모드 토글 |

**오답 피드백 예**: 셋째 줄을 '솔'로 고르면 → *"땡! 이건 시(B)예요. 높은음자리표 줄은 아래부터 미·솔·시·레·파."* + B음 재생 + 정답 줄 반짝.

### 6.3 모드 B — 계이름 ↔ 영어 매칭
**목표**: 도레미파솔라시 ↔ C D E F G A B(고정도) 자동화.

**MVP 형태**: B-즉답 — 계이름/영문 1개 제시 → 반대편 보기 4지선다(타이머 없음).

| Lv | 형태 | 범위 |
|---|---|---|
| 1 | 즉답 | 7음 |
| 2 | 즉답 | 7음, 방향 랜덤(한→영/영→한) |

> **확장(백로그, §10.5)**: 제한시간 바·타임어택(Lv3~4), B-카드 매칭(메모리) 모드는 MVP 제외.

**오답 피드백**: '파'에 G → *"파는 F예요. 솔(G) 아님!"* + F음 재생. 소리로 각인이 핵심.

### 6.4 모드 C — 조표 순서 (Key Signature Order)
**목표**: 샤프 순서(F C G D A E B = 파도솔레라미시), 플랫 순서(B E A D G C F = 시미라레솔도파 = 역순).

| 유형 (MVP) | 설명 |
|---|---|
| C-다음 하나 | 놓인 조표 → "다음은?" 4지선다 |
| C-순서 퀴즈 | "샤프 3번째는?" 단답(선택형) |

| Lv | 유형 | 대상 | 개수 |
|---|---|---|---|
| 1 | 다음 하나 | 샤프 | 1~3 순차 |
| 2 | 다음 하나 | 플랫 | "역순" 강조 |
| 3 | 순서 퀴즈 혼합 | 샤프/플랫 랜덤 | N번째 양방향 |

> **확장(백로그, §10.5)**: C-전체 배치(빈 슬롯에 칩을 순차 탭으로 배치)는 MVP 제외.

**핵심 교수 포인트**: *"플랫은 샤프의 거꾸로! 파도솔레라미시 → 시미라레솔도파."* 이 사실 하나면 절반이 끝난다.
모드 C는 SVG 대신 텍스트/칩·슬롯 배열이 주 표현이라 `render`만 다르게 구현하고 엔진은 동일 재사용(DRY). 오디오 비중은 A·B보다 낮게(오답 시 `playWrong` 버저만 유지).

---

## 7. UI/UX & 와이어프레임

### 7.1 컬러 토큰 (CSS custom property)
```css
:root{
  --bg:#F7F8FA; --surface:#FFFFFF; --ink:#1E2430; --ink-soft:#5B6472; --line:#C7CDD6;
  --brand:#2F6BFF; --brand-050:#E9F0FF;
  --ok:#12855A;  --ok-050:#E3F5EC;      /* 정답(진초록) */
  --bad:#C43B2E; --bad-050:#FBEAE7;     /* 오답(진주황빨강) */
  --hint:#B26A00;                        /* 니모닉(앰버) */
}
@media (prefers-color-scheme: dark){
  :root{ --bg:#12151C; --surface:#1A1F29; --ink:#EDEFF3; --ink-soft:#A2AAB8;
         --line:#39414F; --brand:#5B8CFF; --brand-050:#1E2A44;
         --ok:#3FBE86; --ok-050:#12352A; --bad:#F0796B; --bad-050:#3A1F1C; --hint:#E0A64A; }
}
```
- 타이포: `system-ui, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif` (웹폰트 없음). 라운드 12px 카드, 그림자 `0 1px 3px rgba(0,0,0,.06)`.
- **색약 대비 원칙**: 정답/오답을 색만으로 구분하지 않는다. 정답=✓+초록+pop, 오답=✗+빨강+shake, +소리 = **4중 채널**.

### 7.2 화면 흐름 (SPA)
```
[홈] ──▶ [모드A: 음자리표 위치] ──▶ [결과]
  ├────▶ [모드B: 계이름↔영어]   ──▶ [결과]
  ├────▶ [모드C: 조표 순서]      ──▶ [결과]
  └────▶ [설정 ⚙]
```
홈은 3모드 모두 **잠금 없이** 노출한다(별 해금 게이팅은 후순위 — §10).

### 7.3 공통 앱바 (게임/결과 상단)
```
┌───────────────────────────────────────────────┐
│ ← 홈    ●●●○○ 3/5    🔊  [ 한 / EN ]   ⚙        │
└───────────────────────────────────────────────┘
   뒤로   진행도(구슬)  소리토글  언어토글   설정
```
진행도는 점 + "3/5" 텍스트 병기(스크린리더/색약 대비). 언어·소리 토글은 모든 화면에서 접근 가능.

### 7.4 홈
```
┌───────────────────────────────────────────────┐
│                                    🔊  한/EN ⚙ │
│            🎵  악보 배우기                      │
│         음악 이론 첫걸음 학습 게임               │
│   ┌─────────────┐  ┌─────────────┐            │
│   │  𝄞 𝄢         │  │  도 = C      │            │
│   │ 음자리표     │  │ 계이름 매칭  │            │
│   │ 음 위치 찾기 │  │ 도레미↔ABC   │            │
│   │  [ 시작 ]    │  │  [ 시작 ]    │            │
│   └─────────────┘  └─────────────┘            │
│   ┌─────────────┐   난이도: [쉬움|보통]        │
│   │  ♯ F C G…    │   문항수:  [5 |10]           │
│   │ 조표 순서    │                              │
│   │  [ 시작 ]    │                              │
│   └─────────────┘                              │
└───────────────────────────────────────────────┘
```

### 7.5 모드 A (핵심 SVG 화면)
```
┌───────────────────────────────────────────────┐
│ ← 홈   ●●○○○ 2/5   🔊  한/EN  ⚙                 │
│   높은음자리표 · 이 음의 이름은?                 │
│    ┌─────────── 오선 SVG ───────────┐          │
│    │  𝄞  ─────────────────────────  │          │
│    │     ─────────────────────────  │ ← 클릭영역 │
│    │     ─────────────●───────────  │  (칸/줄)  │
│    │     ─────────────────────────  │          │
│    │  ─ ─ ─ ─ (덧줄) ─ ─ ─ ─ ─ ─    │          │
│    └─────────────────────────────────┘          │
│    ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│    │ 솔 G │ │ 라 A │ │ 시 B │ │ 도 C │  ← 4택   │
│    └──────┘ └──────┘ └──────┘ └──────┘         │
│   💡 힌트: EGBDF "Every Good Boy Does Fine"     │
└───────────────────────────────────────────────┘
```

### 7.6 설정 (⚙)
앱바 ⚙ → `#/settings`. 단순 세로 목록, 각 행 48px 이상.
```
┌───────────────────────────────────────────────┐
│ ← 뒤로            설정                          │
│                                                 │
│   언어            [ 한국어 | English ]          │
│   사운드          [ On  ●───  Off ]             │
│   볼륨(선택)      ──────●────────  30%          │
│                                                 │
│   (진행 저장·별 해금은 후속 버전)               │
└───────────────────────────────────────────────┘
```
- 한/영 토글·사운드 On/Off는 필수, 볼륨 슬라이더는 선택.
- 변경 즉시 `setState`로 반영 → 현재 뷰 재렌더. (설정 영속화는 §10 후순위.)

### 7.7 결과 / 피드백
```
┌───────────────────────────────────────────────┐
│              🎉  4 / 5 정답!   ★★☆               │
│              ▓▓▓▓▓▓▓▓░░  80%                    │
│    틀린 문제 다시 보기                           │
│    · "시(B)" 위치 — 셋째 줄이에요               │
│      𝄞 [미니 오선, 정답 위치 강조]              │
│    ┌──────────┐   ┌──────────┐                 │
│    │ 다시 하기 │   │  홈으로   │                 │
│    └──────────┘   └──────────┘                 │
└───────────────────────────────────────────────┘
```
학습 게임이므로 **오답 리뷰(정답 미니 오선/표시)가 핵심**. 결과 요약(정답 수/정답률, F-20)은 MVP 필수이며, 별·정확도는 세션 단위 표시(영속 저장 아님). 재출제는 하지 않고 이 화면의 리뷰로 오답 학습을 완결한다(§6.0).

### 7.8 인터랙션 & 피드백 (4중 채널)
| 화면 | 마우스/터치 | 키보드 |
|---|---|---|
| 4택 퀴즈 | 버튼 탭 | 1~4 선택, Enter 확정, H 힌트, N 다음 |
| B형 위치 | 오선 히트존 탭 | ↑/↓ 이동, Enter 확정 |
| 매칭형 | 좌 탭→우 탭 | Tab 이동, Enter 연결 |
| 조표 나열 | 칩 탭→슬롯 자동 | Tab+Enter |

```css
@keyframes pop  { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
@keyframes shake{ 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
@media (prefers-reduced-motion: reduce){ .pop,.shake{ animation:none } }  /* 색·아이콘만 */
```
- 정답: `--ok-050` + ✓ + pop + 해당 음 재생 + 니모닉 글자 하이라이트.
- 오답: `--bad-050` + ✗ + shake + `playWrong` 버저, 그 후 정답 자동 점등 + 미니 설명.
- 니모닉 힌트: 기본 접힘(💡), 탭 시 펼침, **오답 시 자동 펼침**(항상 표시, 설정 옵션 없음 — 설정은 최소로 유지).

---

## 8. 다국어(한/영) & i18n

### 8.1 두 개의 독립 축
1. **UI 언어**(한국어 ↔ English): 버튼 라벨·안내문 → `DICT`.
2. **계이름 표기**(도레미 ↔ CDE ↔ 둘 다): 음이름 표시 → 데이터(`solfege`/`english`).

이 분리가 "계이름 한/영 전환 학습" 요구를 자연스럽게 만족한다.

### 8.2 `src/i18n.js`
```js
import { getState } from './game.js';

const DICT = {
  ko: { menu:'메뉴', start:'시작', score:'점수', clefPosition:'음자리표 위치',
        noteMatching:'계이름 맞추기', keyOrder:'조표 순서', correct:'정답!', wrong:'오답' },
  en: { menu:'Menu', start:'Start', score:'Score', clefPosition:'Clef Position',
        noteMatching:'Note Matching', keyOrder:'Key Signature Order',
        correct:'Correct!', wrong:'Wrong' },
};
export function t(key) { return DICT[getState().lang][key] ?? key; }

// 음이름 표기: UI 언어와 별개로 notation 축을 따른다
export function noteLabel(note) {
  switch (getState().notation) {
    case 'solfege': return note.solfege;          // "도"
    case 'english': return note.english;          // "C"
    default:        return `${note.solfege} · ${note.english}`; // "도 · C"
  }
}
```
- **권장 기본값**: UI=한국어, notation='both'(병기가 가장 교육적).
- 옥타브 번호는 입문 단계 숨김(C4 대신 "C"), 설정 '고급'에서만 노출(YAGNI).
- 조표는 언어 무관 기호 공통(예: "F♯ / 파♯"). 니모닉도 한/영 함께 노출.
- **토글 시 즉시 리렌더**(진행 중 문제 유지, 정답 리셋 안 함) → "아, 파가 F구나" 체험 유도.

---

## 9. Web Audio 오디오 설계

### 9.1 아키텍처
```
AudioContext (싱글턴, lazy init)
  └─ masterGain (볼륨/음소거 단일 제어점) → destination
        └─ [재생 시마다] Osc → envGain → masterGain   (일회성, onended 자동 폐기)
```
- AudioContext는 **딱 1개** 싱글턴(브라우저당 개수 제한). Oscillator는 **일회용**(start→stop 후 재사용 불가, 매번 새로 생성·GC). masterGain은 영구.

### 9.2 주파수 매핑 & 파싱
```js
const SEMITONE = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const SOLFEGE  = { '도':'C','레':'D','미':'E','파':'F','솔':'G','라':'A','시':'B' };

// "C4" | "F#4" | "Gb3" | "솔4" | 주파수(number) 지원
export function noteToFreq(note) {
  if (typeof note === 'number') return note;
  let m = String(note).match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!m) {
    const km = String(note).match(/^([도레미파솔라시])(-?\d+)$/);
    if (!km) throw new Error('bad note: ' + note);     // fail-fast
    m = [null, SOLFEGE[km[1]], '', km[2]];
  }
  const [, letter, acc, octStr] = m;
  const semis = SEMITONE[letter.toUpperCase()] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
  const midi = (parseInt(octStr,10) + 1) * 12 + semis;  // C4=60 ✓
  return 440 * Math.pow(2, (midi - 69) / 12);           // A4=440 ✓
}
// 검증: noteToFreq('C4')≈261.63, noteToFreq('A4')=440, noteToFreq('C5')≈523.25
```

### 9.3 엔벨로프 (클릭음 방지)
```js
const ATTACK = 0.01, RELEASE = 0.06;   // 지수 램프는 0 불가 → 0.0001 사용
function applyEnvelope(g, t0, dur, peak) {
  const end = t0 + dur;
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(peak, t0 + ATTACK);
  g.setValueAtTime(peak, Math.max(t0 + ATTACK, end - RELEASE));
  g.exponentialRampToValueAtTime(0.0001, end);
  return end + 0.02;
}
```

### 9.4 엔진 & 공개 API
`src/audio.js`는 객체·전략 패턴 없이 **모듈 스코프 상태 + 평범한 export 함수**로 구성한다(플랫·단순 원칙, §1.2). 사용처는 항상 `import { playNote, playCorrect, playWrong } from './audio.js'`처럼 필요한 함수만 가져온다.
```js
// src/audio.js
let ctx = null, master = null, volume = 0.3, muted = false;

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function unlock() { ensure(); if (ctx.state === 'suspended') ctx.resume(); }

export function playNote(note, durationMs = 500, { type='sine', peak=1 } = {}) {
  ensure(); if (ctx.state === 'suspended') ctx.resume();
  const t0 = ctx.currentTime, dur = durationMs/1000;
  const osc = ctx.createOscillator(), env = ctx.createGain();
  osc.type = type; osc.frequency.value = noteToFreq(note);
  osc.connect(env).connect(master);
  osc.start(t0); osc.stop(applyEnvelope(env.gain, t0, dur, peak));
  osc.onended = () => { osc.disconnect(); env.disconnect(); };
}

export function playSequence(notes, gapMs=350, durMs=300) {
  ensure(); let when = 0;
  notes.forEach(n => { setTimeout(() => playNote(n, durMs), when); when += gapMs; });
}

export function playChord(notes, durationMs=600) {
  notes.forEach(n => playNote(n, durationMs, { peak: 0.7 }));  // 클리핑 방지
}

export function playCorrect() { playNote('E5',120); setTimeout(()=>playNote('A5',200),110); }

export function playWrong() {
  playNote(220,140,{type:'square',peak:0.5});
  setTimeout(()=>playNote(155,220,{type:'square',peak:0.5}),120);
}

export function setVolume(v) {
  volume = Math.max(0,Math.min(1,v));
  if (master && !muted) master.gain.setTargetAtTime(volume,ctx.currentTime,0.02);
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted?0:volume,ctx.currentTime,0.02);
  return muted;
}
```

| 함수 | 시그니처 | 용도 |
|---|---|---|
| `unlock()` | `()` | 첫 제스처에서 AudioContext resume |
| `playNote(note,durMs,opts?)` | note=Hz\|"C4"\|"솔4" | 단일 음 (`opts={type,peak}`) |
| `playSequence(notes,gap,dur)` | 배열 | 음계 순차(청음) |
| `playChord(notes,dur)` | 배열 | 화음(매칭 보상) |
| `playCorrect()` / `playWrong()` | `()` | 효과음(정답 알림음 / 오답 버저) |
| `setVolume(0~1)` / `toggleMute()` | | 볼륨/음소거 |

### 9.5 오토플레이 정책 대응
```js
import { unlock } from './audio.js';

function armAudio() {
  unlock();
  window.removeEventListener('pointerdown', armAudio);
  window.removeEventListener('keydown', armAudio);
}
window.addEventListener('pointerdown', armAudio);
window.addEventListener('keydown', armAudio);
```
각 `playNote`도 `suspended`면 `resume()` 재시도 → 탭 복귀 엣지 케이스 흡수.

### 9.6 학습 연계
- 음자리표 위치: 정답 시 **그 음 재생** → 시각(위치)+청각 연결.
- 계이름 매칭: 정답 시 해당 음 + "도=C" 각인. 전체 음계 `playSequence(['도4',…,'도5'])`.
- 조표 순서: 오디오 비중 낮게. 오답은 `playWrong` 버저만.
- "정답 들어보기"는 **채점과 분리**(들어도 감점 없음, KISS).

---

## 10. 접근성 / 반응형 / 저장(후순위)

### 10.1 접근성
- **색 단독 의존 금지**: 정답 ✓+초록+pop / 오답 ✗+빨강+shake + 소리(§7.8).
- **명암비**: 본문 `--ink` on `--surface` ≥ 7:1(AAA), 버튼 ≥ 4.5:1(AA). `--ok #12855A` / `--bad #C43B2E`는 명도차 큰 값.
- **키보드 전 조작**(§7.8), `:focus-visible` 2px `--brand` 외곽선, 논리적 포커스 순서.
- **스크린리더**: SVG 음표 `role="img"` + `<title>`("높은음자리표 셋째 줄, 시 B"). 진행도·정답결과 `aria-live="polite"`.
- **소리 대체 시각 표시**: 소리 OFF/청각 제약 시, 음 재생 대신 음표 주변 ripple + "♪ 도(C4) 261Hz" 뱃지를 잠깐 표시.
- **모션 축소**: `prefers-reduced-motion` 존중.

### 10.2 반응형 / 모바일
- **터치 타깃 최소 48×48px**(보기·칩·슬롯·히트존·토글 전부 통일).
- **세로(portrait)**: 상하 1열 흐름 — 오선/문제 → 보기 2×2 그리드 → 힌트. 주요 버튼은 엄지 도달 영역.
- **가로(landscape)**: 좌우 2단 — 왼쪽 오선/문제, 오른쪽 보기·힌트. `@media (orientation:landscape)`로 전환.
- **소형 화면(320~360px)**: 조표 모드 7칩을 가로 스크롤 대신 **2행 wrap 또는 칩 크기 반응형 축소**(터치 하한 48px 유지). "한눈에 순서 보기" 학습 목표 보존.
```css
.chip-row{ display:flex; flex-wrap:wrap; gap:8px; }          /* 2행 wrap */
.chip{ flex:1 1 auto; min-width:48px; min-height:48px; }     /* 반응형 축소, 48px 하한 */
```
- 오선 히트존은 시각 줄/칸보다 넉넉히(12px step), 오차 시 가장 가까운 dv 스냅.
- `touch-action: manipulation`(더블탭 확대 지연 제거), 드래그 대신 탭-투-탭 채택.
- SVG `width:100%; max-width:420px`, 가로 스크롤 금지.
- Web Audio는 홈 "시작" 탭 시점에 `unlock()`(iOS 자동재생 정책).

### 10.3 성공지표 (MVP = 세션 단위 측정)
- MVP는 **세션 단위만** 측정: 세션 정답률, 세션 내 최고 streak(콤보), 세션 문제 수. 모두 `state.quiz`에서 즉시 산출(영속 저장 불필요).
- 세션 간 영속 저장이 필요한 지표(누적 학습량·재방문율 등)는 **후순위**.

### 10.4 저장 / 해금 (후순위 · 선택)
> 아래는 MVP 제외 백로그. 도입 시 `src/storage.js`를 추가하되 코어 흐름은 무영향.
```js
const KEY = 'music-game-progress-v1';   // 스키마 버전 접미사
export function loadProgress() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; }
  catch { return {}; }                    // fail-safe: 손상 시 초기화
}
export function saveProgress(stageId, { bestStars, bestScore, accuracy }) {
  const p = loadProgress();
  const prev = p[stageId] ?? { bestStars:0, bestScore:0, accuracy:0 };
  p[stageId] = {
    bestStars: Math.max(bestStars, prev.bestStars),
    bestScore: Math.max(bestScore, prev.bestScore),
    accuracy:  Math.max(accuracy,  prev.accuracy),
  };
  localStorage.setItem(KEY, JSON.stringify(p));
}
```
- 설정(lang/notation/audio/volume) 영속화도 이 시점에 별도 키로 함께 도입.
- "이전 스테이지 별 → 다음 해금" 게이팅도 후순위. **MVP 홈은 3모드 모두 잠금 없이 노출**.

### 10.5 확장 게임플레이 (후순위 · 백로그)
> MVP는 3주제 각각 **선택형 퀴즈 1종**(§6)만 포함한다. 아래는 MVP 제외 백로그 — 도입해도 퀴즈 엔진(§4.2)은 그대로 재사용한다.
- **오답 1회 재출제**: 스테이지 끝에 `wrongLog`를 다시 출제. MVP는 결과 화면 리뷰(§7.7)로 대체.
- **모드 B 타임어택**: 문제당/스테이지 제한시간 바.
- **모드 B 카드 매칭(메모리)**: 뒤집힌 카드 그리드로 짝 맞추기.
- **모드 C 전체 배치**: 칩을 슬롯에 순차 배치하는 조작형 인터랙션.

---

## 부록 A: 핵심 설계 결정 요약
1. **무빌드 ES Modules + Vercel 정적 배포** (Framework=Other, 빌드·`vercel.json` 없음).
2. **플랫 구조**(root 2 + `data/` 3 + `src/` 7 ≈ 12파일) — 계층·pub/sub·플러그인 레지스트리 없음.
3. **`data/`를 SSOT로 고정** — 표준 사실 자료 값을 상수로 1:1, 로직 배제.
4. **음→y는 diatonic step 하나로 계산** `y = 88 - (dv - dvRef)*6` (treble 30 / bass 18), C4 공유 앵커로 덧줄 일관 처리.
5. **모드 = 평범한 배열**, 퀴즈 엔진 1개 공유(DRY). 상태는 단일 `state` + 라우터가 뷰 직접 렌더.
6. **오디오는 `noteToFreq` 공식 하나만 신뢰** `f = 440·2^((n-69)/12)`, 데이터 테이블과 일치 검증.

## 부록 B: 표준 사실 체크리스트 (구현 시 일치 검증)
- 높은음자리표 줄(아래→위): **E4 G4 B4 D5 F5** / 칸: **F4 A4 C5 E5** (G clef 기준음 = 둘째 줄 G4)
- 낮은음자리표 줄(아래→위): **G2 B2 D3 F3 A3** / 칸: **A2 C3 E3 G3** (F clef 기준음 = 넷째 줄 F3)
- 가온다 = **C4**, 두 음자리표 공유 (treble 아래 첫 덧줄 = bass 위 첫 덧줄)
- 고정도: 도=C 레=D 미=E 파=F 솔=G 라=A 시=B
- 샤프 순서 **F C G D A E B** / 플랫 순서 **B E A D G C F** (서로 정확히 역순, 인접 완전5도)
- 주파수 `f = 440·2^((n-69)/12)`, A4=440Hz, C4≈261.63Hz, C5≈523.25Hz

*(문서 끝 — v0.2, 작성일: YYYY-MM-DD)*
