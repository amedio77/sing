# 설계 문서: 노래 가사 학습 + 프롬프터 (Karaoke Lyrics Trainer & Prompter)

| 항목 | 내용 |
|---|---|
| 프로젝트명 | 노래방 가사 암기 & 프롬프터 |
| 문서 종류 | 설계 문서 (Design) |
| 작성일 | 2026-11-07 |
| 버전 | v0.1 |
| 대상 독자 | 프론트엔드 구현 담당 / 리뷰어 |
| 선행 문서 | [docs/10-karaoke-analysis.md](10-karaoke-analysis.md) |
| 스택 | 무빌드 바닐라 JS (ES Modules) · YouTube IFrame API · localStorage · 정적 배포 |

---

## 1. 설계 원칙

| 원칙 | 적용 |
|---|---|
| **KISS / 무빌드** | 기존 리포와 동일. 번들러·프레임워크 없음. `<script type="module">` + import/export |
| **Loose Coupling** | 기존 게임(`src/`)과 JS 의존 0. 결합은 하이퍼링크뿐 |
| **단일 데이터 출처 (DRY)** | 가사·메타는 `karaoke/songs.js` 한 곳. 3개 화면이 모두 여기서 읽음 |
| **의존성 역전 (프롬프터 핵심)** | 가사 렌더는 "시간"만 알면 된다. 시간 공급자(YouTube/타이머)를 **동일 인터페이스로 추상화** → 폴백이 분기문 없이 성립 |
| **Fail Fast** | YouTube 에러·localStorage 실패는 삼키지 않고 화면에 사유 표시 + 폴백 |
| **YAGNI** | 곡 편집 UI·반복 블록 참조 구조·상태관리 라이브러리 없음 |

---

## 2. 파일 구조

```
d:\work\code\
├── index.html                 (기존) 악보 게임 — 홈에 메뉴 카드 1개 추가
├── src/ui.js                  (기존) renderMenu 에 링크 카드 추가 ← 유일한 기존 파일 수정
├── styles.css                 (기존) 링크 카드 스타일 소량 추가
└── karaoke/                   ← 신규 (완전 분리)
    ├── study.html             암기용 학습 뷰 (탭별 가사)
    ├── prompter.html          가사 프롬프터
    ├── sync.html              탭싱크 보정 도구
    ├── karaoke.css            3개 화면 공용 스타일
    ├── songs.js               가사 + 곡 메타 (단일 데이터 출처)
    ├── timeline.js            추정 타임라인 생성 + 타임라인 조회(이진 탐색)
    ├── clock.js               시간 소스 추상화 (YouTubeClock / TimerClock)
    ├── store.js               localStorage 영속 (체크·타임라인·URL·설정)
    ├── study.js               study.html 로직
    ├── prompter.js            prompter.html 로직
    └── sync.js                sync.html 로직
```

**파일 12개 · 폴더 1개.** 기존 리포의 플랫 구조 철학을 그대로 따른다.

### 2.1 모듈 의존 방향 (단방향)

```
songs.js ──┐
           ├──> timeline.js ──┐
store.js ──┘                  ├──> study.js      (clock 불필요)
                              ├──> prompter.js ──┬──> clock.js
                              └──> sync.js ──────┘
```

`songs.js` / `store.js` / `timeline.js` / `clock.js` 는 DOM을 모른다(순수 로직). 화면 3개만 DOM을 만진다. → 타임라인 계산을 콘솔에서 단독 검증 가능.

---

## 3. 데이터 설계

### 3.1 `songs.js` 스키마

```js
export const SONGS = [
  {
    id: 'tim-sarang',              // localStorage 키·URL 해시에 쓰이는 안정 식별자
    title: '사랑합니다',
    artist: '팀 (TIM)',
    released: '2003',              // 원곡 기준 (4곡 전부 원곡으로 확정 → originalArtist 필드 불필요)
    duration: 228,                 // 초. 기준 음원 길이 (3:48)
    intro: 15,                     // 추정용: 첫 줄 시작까지 (초)
    outro: 8,                      // 추정용: 마지막 줄 종료 후 (초)
    youtubeId: null,               // 하드코딩 안 함 (R-2). 사용자 입력값이 store 에 저장됨
    searchQuery: '팀 사랑합니다',    // URL 미입력 시 YouTube 검색 버튼용
    blocks: [
      { kind: 'verse',  label: '1절',    lines: ['…', '…'] },
      { kind: 'chorus', label: '후렴',    lines: ['…'] },
      { kind: 'bridge', label: '브릿지',  lines: ['…'] },
    ],
    sequence: null,                // 부르는 순서 (§3.2). null = 적힌 순서대로
  },
  // … 4곡
];
```

`kind` 는 `verse | chorus | bridge | outro` 4종. 색/라벨 구분과 블록 간격 추정에 쓴다.

### 3.2 `sequence` — 후렴 반복 전개 (필수)

가사지는 후렴 반복을 `*` 기호로 생략하는 관행이 있다. 「잊기」가 그런 경우로, **적힌 줄은 14줄인데 곡 길이는 3:56**이다. 그대로 배분하면 줄당 15.1초가 되어 프롬프터가 전혀 맞지 않는다(다른 3곡은 7.3~9.8초/줄).

가사를 복제해서 늘리면 DRY가 깨지고 학습 뷰에 같은 블록이 두 번 보인다. 대신 **블록 인덱스를 부르는 순서대로 적는 배열**을 둔다.

```js
sequence: [0, 1, 2, 1, 3]   // 1절 → 후렴 → 2절 → 후렴(반복) → 엔딩
```

| 용도 | 쓰는 데이터 |
|---|---|
| 학습 뷰 (`study.js`) | `blocks` 원본 — 적힌 대로 23블록. 같은 블록을 두 번 외울 필요 없음 |
| 프롬프터·싱크 (`prompter.js`, `sync.js`) | `expand(song)` 으로 전개한 줄 배열 — 실제 부르는 순서 |

```js
// timeline.js
export function expand(song) {
  const order = song.sequence ?? song.blocks.map((_, i) => i);
  return order.flatMap(bi =>
    song.blocks[bi].lines.map((text, li) => ({ text, blockIndex: bi, lineIndex: li }))
  );
}
```

`timeline.lines` 의 길이는 **전개된 줄 수**와 같다. `sequence`를 바꾸면 기존 타임라인의 길이가 어긋나므로, `store.js`는 로드 시 길이를 비교해 다르면 추정값으로 재생성하고 "반복 구조가 바뀌어 타임라인을 다시 계산했다"고 알린다 (Fail Fast).

「암연」·「내생에 봄날은」은 가사지에 반복 후렴이 **이미 전부 적혀 있으므로** `sequence: null` 로 둔다(분석 문서 D5). 반복 전개가 필요한 곡은 현재 「잊기」 하나다.

### 3.3 곡별 초기 메타 (조회 결과 반영)

기준 음원은 **전부 원곡**으로 확정한다 (사용자 결정).

| id | 곡 | artist | 기준 음원 | duration | intro | outro | 블록 분류 | sequence |
|---|---|---|---|---:|---:|---:|---|---|
| `tim-sarang` | 사랑합니다 | 팀 (TIM) | **2003 원곡** (윤상 작곡) | 228 (3:48) | 15 | 8 | verse·verse·**chorus**·verse·**chorus**·outro | null |
| `gohw-amyeon` | 암연 | **고한우** | **1997 원곡** | 274 (4:34) | 18 | 10 | verse·verse·**chorus**·verse·**chorus**·**chorus** | null |
| `can-bomnal` | 내생에 봄날은 | 캔 (Can) | 2001 『Can With Piano』 | 242 (4:02) | 14 | 10 | verse·**chorus**·verse·**chorus**·**chorus**·bridge·outro | null |
| `eve-itgi` | 잊기 | 이브 (Eve) | 3집 『너에게로 날자』 | 236 (3:56) | 16 | 8 | verse·**chorus**·verse·outro | **`[0,1,2,1,3]`** |

**변경 이력**
- 「사랑합니다」: 2005 리메이크(3:49) → **2003 원곡(3:48)**. 길이 차이는 1초로 미미하나 `released`·`searchQuery`가 원곡을 가리키게 한다.
- 「암연」: 임영웅 커버 → **고한우 원곡**. `id`를 `limyw-amyeon` → `gohw-amyeon`으로, `artist`를 고한우로 바꾸고 `originalArtist` 필드는 제거한다(커버가 아니므로). 길이 4:34는 원곡 기준이라 그대로 유효하다. 분석 문서의 D4(커버 표기 분리)는 **불필요해져 폐기**한다.
- 「잊기」: `sequence` 적용으로 전개 후 **18줄**(14 + 후렴 4줄 반복). 줄당 평균 15.1초 → **11.8초**로 정상 범위에 들어온다.

> `intro`/`outro`는 해당 장르(90~2000년대 발라드)의 통상적인 길이로 잡은 **추정 초기값**이다. 탭싱크 1회로 무의미해지는 값이므로 정밀화에 공을 들이지 않는다.
> 「잊기」의 `sequence`도 가사지의 `*` 표기에서 추론한 값이다. 후렴이 2회인지 3회인지는 음원을 들어야 확정되므로, **싱크 보정 시 실제와 다르면 `sequence`를 먼저 고친다**(§8 M8).

### 3.4 타임라인 데이터 (`store.js` 관리)

가사(코드)와 타임라인(사용자 데이터)을 **분리**한다. 가사를 수정해도 타임라인이 날아가지 않고, 반대도 성립한다.

```js
// localStorage: "karaoke.timeline.tim-sarang"
{
  source: 'tapped',        // 'estimated' | 'tapped'  → UI 배지
  offset: -0.3,            // 전역 오프셋 (초). 모든 줄에 더해짐
  duration: 231,           // 이 타임라인을 찍은 음원의 실제 길이 (재스케일 기준)
  lines: [15.0, 18.4, …],  // 줄 인덱스 → 시작 시각(초). 길이 = 곡의 전체 줄 수
  updatedAt: '2026-11-07T…'
}
```

`lines`는 **블록을 평탄화한 전체 줄 인덱스** 기준이다(블록 중첩 배열 아님). 이유: 프롬프터의 현재 줄 탐색이 단순 배열 이진 탐색으로 끝나고, 블록 경계는 렌더 시점에만 필요하다.

### 3.5 localStorage 키 맵

| 키 | 값 | 쓰는 화면 |
|---|---|---|
| `karaoke.timeline.{songId}` | §3.4 객체 | prompter, sync |
| `karaoke.yt.{songId}` | YouTube 영상 ID (11자) | prompter, sync |
| `karaoke.memo.{songId}` | `{ checkedBlocks: [0,2,3] }` 암기 완료 체크 | study |
| `karaoke.prefs` | `{ fontScale, maskMode, lastSongId, lineWindow }` | 전역 |

모두 `karaoke.` 접두 → 기존 게임의 localStorage와 충돌 없음 (NF-6).
`store.js`는 모든 읽기/쓰기를 try/catch로 감싸고, 실패 시 메모리 폴백 + 콘솔 경고 1회(사생활 보호 모드 대응).

---

## 4. 추정 타임라인 알고리즘 (`timeline.js`)

### 4.1 `estimate(song) → number[]`

**입력은 `expand(song)`의 전개된 줄**이다(§3.2). 적힌 줄이 아니라 실제 부르는 줄에 시간을 배분해야 하므로, `estimate`는 가장 먼저 `expand`를 호출한다. 반복되는 후렴은 같은 가사라도 **매번 독립된 타임스탬프**를 갖는다.

```js
// 0) 실제 부르는 순서로 전개
const lines = expand(song).map(x => x.text);

// 1) 줄별 가중치 = 한글 음절 수 (최소 4로 클램프 — 짧은 추임새 줄 방어)
const w = lines.map(l => Math.max(4, countHangul(l)));

// 2) 블록 간 간격: 블록 경계마다 고정 간격 투입
//    verse→chorus 진입은 통상 반주가 한 마디 더 있으므로 길게 잡는다
const GAP = { default: 1.2, toChorus: 2.0, toBridge: 2.4 };

// 3) 순수 가창 구간
const gapTotal = Σ(블록 경계별 gap);
const sing = song.duration - song.intro - song.outro - gapTotal;

// 4) 누적 배분
let t = song.intro;
for (각 줄 i) {
  if (i가 블록 첫 줄 && i > 0) t += gap(이전 블록 → 현재 블록);
  out[i] = t;
  t += sing * w[i] / Σw;
}
```

**검증 조건** (구현 시 콘솔에서 확인):
- `out`은 단조 증가
- `out[마지막] + 마지막 줄 길이 ≈ duration - outro` (오차 1초 이내)
- `sing > 0` — 아니면 intro/outro 설정 오류이므로 **즉시 throw** (Fail Fast)

### 4.2 `rescale(timeline, actualDuration) → timeline`

YouTube가 보고한 실제 길이가 `timeline.duration`과 2% 이상 다르면 비율로 전체를 당기거나 늘린다. 단, `source === 'tapped'`인 타임라인은 **재스케일하지 않고 사용자에게 안내만 한다** (실측값을 추측으로 훼손하지 않음).

### 4.3 `indexAt(lines, t) → number`

`t` 시각에 해당하는 줄 인덱스. 정렬된 배열이므로 **이진 탐색**(O(log n), 98줄이면 7회 비교). 매 프레임 호출되므로 선형 탐색을 쓰지 않는다. `t < lines[0]` 이면 `-1`(인트로 중) 반환 → 카운트인 UI 트리거.

---

## 5. 시간 소스 추상화 (`clock.js`) — 프롬프터의 핵심

### 5.1 인터페이스

프롬프터는 "지금 몇 초인가"만 알면 되므로, 두 구현이 같은 모양을 갖는다.

```js
// 공통 인터페이스
{
  now(): number,              // 현재 재생 위치 (초)
  duration(): number,         // 전체 길이 (초, 모르면 0)
  play(): void,
  pause(): void,
  seek(sec): void,
  isPlaying(): boolean,
  destroy(): void,
  onError(cb): void,          // 폴백 트리거
  onReady(cb): void,
}
```

### 5.2 `createTimerClock({ duration, rate })`

`performance.now()` 기반. `play()` 시점의 기준점을 저장하고 `now()`에서 경과분을 계산. 일시정지는 누적 경과 시간을 보존. `rate`로 0.8~1.2배속 (FB-10).
setInterval로 시간을 "누적"하지 않는다 — 탭 백그라운드 시 타이머가 느려져 드리프트가 생기기 때문. 기준점 차이 계산 방식은 백그라운드 복귀 후에도 정확하다.

### 5.3 `createYouTubeClock({ videoId, mount })`

- IFrame API 스크립트를 **한 번만** 동적 삽입 (`https://www.youtube.com/iframe_api`), `window.onYouTubeIframeAPIReady` 를 Promise로 감싼다.
- `now()` = `player.getCurrentTime()`.
- `playerVars`: `{ controls: 1, rel: 0, playsinline: 1, modestbranding: 1 }` — `playsinline`은 iOS에서 전체화면 강제 전환을 막아 가사와 동시 표시에 필수.
- **에러 처리**: `onError` 이벤트 코드 `2`(잘못된 ID) / `5`(HTML5 오류) / `100`(없는 영상) / `101`·`150`(임베드 차단) → 각각 사람이 읽을 수 있는 메시지로 변환해 `onError` 콜백 호출.
- **자동재생 정책**: 생성만 해두고 재생은 사용자 클릭에서만 호출.

### 5.4 폴백 흐름 (FB-8)

```
prompter.js 진입
  → store 에 YouTube ID 있나?
      없음 → TimerClock (안내: "음원 없이 타이머로 진행합니다")
      있음 → YouTubeClock 시도
               onReady  → 그대로 사용. duration 비교 후 필요 시 rescale
               onError  → 사유 배너 표시 + TimerClock 으로 교체 (화면 상태 유지)
```

Clock 교체 시 가사 렌더 코드는 건드리지 않는다. `clock` 변수만 갈아끼우고 rAF 루프는 계속 돈다 — 이것이 §1의 의존성 역전을 둔 이유다.

### 5.5 렌더 루프 (NF-2)

```js
let lastIndex = -2;                       // 초기값을 -1 과 다르게 둬 첫 렌더 보장
function frame() {
  const t = clock.now() + timeline.offset;
  const i = indexAt(timeline.lines, t);
  if (i !== lastIndex) { paintLine(i); lastIndex = i; }   // DOM 쓰기는 줄 전환 시에만
  paintProgress(t, i);                                     // CSS 변수 1개만 갱신
  raf = requestAnimationFrame(frame);
}
```

- 줄 전환이 아닌 프레임에서는 DOM 트리를 만지지 않는다. 진행 바는 `style.setProperty('--p', …)` 하나로 처리해 레이아웃 재계산을 피한다.
- `pause()` 시 `cancelAnimationFrame` — 백그라운드에서 CPU를 돌리지 않는다.

---

## 6. 화면 설계

대상: **휴대폰 세로(360~430px)** + **태블릿/노트북(768~1440px)** (R3). 분기점은 `768px` 하나만 둔다.

### 6.1 A. 학습 뷰 (`study.html`)

```
┌──────────────────────────────────────────────┐
│ ← 메인      가사 암기                  A- A+  │  앱바
├──────────────────────────────────────────────┤
│ [사랑합니다] 암연  내생에 봄날은  잊기        │  곡 탭 (가로 스크롤)
├──────────────────────────────────────────────┤
│ 팀 (TIM) · 2005 · 3:49      ▶ 프롬프터로     │  곡 메타 + 이동
│ 가리기:  [전체공개] 블록가림  첫글자          │  연습 모드 세그먼트
│ 암기 진행   ███████░░░  4/6 블록             │
├──────────────────────────────────────────────┤
│ ┌─ 1절 ───────────────────────────── ☑ ─┐   │  블록 카드
│ │ 나빠요 참 그대란 사람                   │   │
│ │ 허락도 없이 왜 내 맘 가져요             │   │
│ │ 그대 때문에 난 힘겹게 살고만 있는데     │   │
│ │ 그댄 모르잖아요                         │   │
│ └─────────────────────────────────────────┘   │
│ ┌─ 후렴 ──────────────────────────── ☐ ─┐   │  후렴은 좌측 색 바 + 배경 틴트
│ │ 비█ 사██ 아███                         │   │  ← 첫글자 모드
│ └─────────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

- **가리기 3모드** (FA-3, FA-4): `reveal`(전체 공개) / `block`(블록 전체 가림 → 탭하면 해당 블록만 공개) / `initial`(각 줄 첫 글자만 남김).
  - `block` 모드는 CSS `filter: blur(8px)` + `color: transparent`가 아니라 **`visibility`로 각 줄을 숨긴다** — blur는 모바일에서 글자 윤곽이 읽혀 암기 효과가 떨어짐.
  - `initial` 모드는 JS로 첫 글자만 남기고 나머지를 `█`로 치환해 렌더(원본은 `dataset.line`에 보존, 탭 시 복원).
- **후렴 식별**: `kind === 'chorus'` 블록은 좌측 4px 액센트 바 + 배경 틴트 + 라벨. 반복 블록이 많은 곡(암연·봄날은)에서 구조 파악이 쉬워진다.
- 반응형: 폰 세로는 1열, 태블릿/노트북(≥768px)은 **2열 그리드**로 블록 카드 배치 → 곡 전체 구조가 한 화면에 들어온다.

### 6.2 B. 프롬프터 (`prompter.html`)

```
┌──────────────────────────────────────────────┐
│ ← 암기  사랑합니다 ▾   [추정값·보정권장]  ⛶  │  앱바 + 타임라인 상태 배지
├──────────────────────────────────────────────┤
│ ░░░░ (YouTube 플레이어 · 접기 가능) ░░░░     │  16:9, 토글로 숨김 가능
├──────────────────────────────────────────────┤
│                                              │
│   허락도 없이 왜 내 맘 가져요                │  이전 줄 (opacity .35)
│                                              │
│ ▸ 그대 때문에 난 힘겹게 살고만 있는데        │  ★ 현재 줄 (최대 크기·강조)
│   ▔▔▔▔▔▔▔▔▔▔▔▔░░░░░░░░                      │  줄 진행 바 (--p)
│                                              │
│   그댄 모르잖아요                            │  다음 줄 (opacity .6)
│   ─── 후렴 ───                               │  다음 블록 라벨 미리 알림
│                                              │
├──────────────────────────────────────────────┤
│ 2:14 / 3:49  ◀줄 ▶❙❙ 줄▶   오프셋 −0.3s ±   │  컨트롤 바
└──────────────────────────────────────────────┘
```

- **표시 줄 수 (앞뒤 비대칭)**: 폰 세로 = 이전1·현재1·**다음2**, 태블릿/노트북 = 이전2·현재1·**다음3**. 부를 때 필요한 건 다음 줄이지 지나간 줄이 아니므로 앞쪽을 넓게 둔다. `prefs.lineWindow`는 `{before, after}` (옛 숫자값도 호환).
- **다음 줄 강조**: 현재 줄 다음으로 눈에 띄게 만들어 미리 읽고 준비하게 한다. 4단계 위계 — `active`(최대·흰색) → `next`(굵게·브랜드색 밑줄) → `soon`(흐림) → `past`(가장 흐림). 실측(노트북): 51px/1.0 → 32px/0.95 → 24px/0.55 → 24px/0.28.
- **현재 줄 크기**: `clamp(1.6rem, 7vw, 3.2rem)`. 주변 줄은 `0.62em` 비율. 글자 크기 슬라이더는 `--font-scale` CSS 변수를 곱해 전체 스케일.
- **자동 스크롤**: 현재 줄을 뷰포트 중앙에 고정 — 컨테이너를 `transform: translateY()`로 이동(스크롤 이벤트·레이아웃 재계산 없음), `transition: transform .35s ease`.
- **카운트인** (FB-6): 현재 줄 아래 진행 바가 다음 줄까지 남은 비율을 표시. 인트로 구간(`i === -1`)에서는 "첫 소절까지 N초" 큰 숫자 카운트다운.
- **오프셋** (FB-5): `−0.5 / −0.1 / 값 / +0.1 / +0.5` 버튼. 키보드 `←`/`→`로 ±0.1s. 변경 즉시 store 저장.
- **배지**: `source === 'estimated'` 면 노란 "추정값 · 보정 권장" + 탭해서 `sync.html`로 이동. `tapped`면 초록 "보정 완료".
- **전체화면**(FB-9): `requestFullscreen()` + `navigator.wakeLock.request('screen')` (지원 시, 실패는 무시하고 안내만).

### 6.3 C. 싱크 도구 (`sync.html`)

```
┌──────────────────────────────────────────────┐
│ ← 프롬프터   타임라인 보정 · 사랑합니다       │
├──────────────────────────────────────────────┤
│ YouTube URL [ https://youtu.be/…      ] 저장 │  FB-7 (없으면 "검색" 버튼)
│ ░░░░ (플레이어) ░░░░      또는 [타이머로]     │
├──────────────────────────────────────────────┤
│ 진행  12 / 25 줄            ⟲ 되돌리기  초기화│
│                                              │
│  ✓ 11  0:52.4  그대 때문에 난 힘겹게…  (+1.2)│  (추정값과의 차이)
│  ▸ 12  ──────  그댄 모르잖아요               │  ← 지금 탭할 줄
│    13          비록 사랑은 아니라도           │
│                                              │
├──────────────────────────────────────────────┤
│   [ 스페이스 = 이 줄 시작 ]   JSON 내보내기   │  큰 탭 버튼
└──────────────────────────────────────────────┘
```

- **조작**: `Space`(또는 큰 버튼) = 현재 줄 시작 기록 후 다음 줄로. `Backspace` = Undo(FC-2). 클릭으로 특정 줄로 점프해 그 지점부터 다시 기록.
- **기록 중 저장**: 매 탭마다 localStorage 저장 → 중간에 창이 닫혀도 진행분 보존.
- **미기록 줄 처리**: 전부 안 찍고 중단한 경우, 기록된 구간은 실측값을, 나머지는 추정값을 쓴다. `source`는 전부 찍었을 때만 `tapped`.
- **JSON 내보내기** (FC-3): `songs.js`에 영구 반영하거나 다른 기기로 옮길 수 있게 `{songId, lines, duration}` 다운로드. 가져오기는 붙여넣기 textarea.

### 6.4 키보드 맵

| 키 | study | prompter | sync |
|---|---|---|---|
| `Space` | — | 재생/일시정지 | **줄 기록** |
| `←` `→` | 곡 탭 이동 | 오프셋 ∓0.1s | — |
| `↑` `↓` | — | 줄 이동 | 줄 선택 이동 |
| `Backspace` | — | — | Undo |
| `F` | — | 전체화면 | — |
| `1`~`4` | 곡 선택 | 곡 선택 | — |

### 6.5 스타일 (`karaoke.css`)

- 기존 `styles.css`를 **import하지 않는다** (분리 원칙). 단, 색 토큰 이름과 `prefers-color-scheme` 대응 방식은 동일하게 맞춰 두 앱의 톤이 어긋나지 않게 한다.
- 토큰: `--bg --surface --text --text-dim --accent --chorus-accent --font-scale`. `:root`에 라이트, `@media (prefers-color-scheme: dark)`에 다크.
- 프롬프터는 다크를 **기본값으로 강제**한다(어두운 조명·무대/노래방 환경, 눈부심 방지). 학습 뷰는 시스템 설정을 따른다.
- 폰트: 시스템 폰트 스택(웹폰트 로딩 지연이 프롬프터에서 치명적). 가사는 `word-break: keep-all` + `text-wrap: balance`로 한국어 줄바꿈 품질 확보.

---

## 7. 기존 앱과의 연결 (R5)

### 7.1 메인 홈에 메뉴 카드 추가

[src/ui.js:99](src/ui.js#L99) `renderMenu`의 `cards` 뒤에 **링크 카드 섹션**을 추가한다. MODES 배열에는 넣지 않는다 — MODES는 퀴즈 출제 로직(`startQuiz`)에 묶여 있어 성격이 다르다.

```js
// renderMenu 안, cards 생성 이후
const apps = h('div', { class: 'app-links' },
  h('h2', { class: 'app-links-title' }, '노래 연습'),
  h('a', { class: 'mode-card link-card', href: 'karaoke/study.html' },
    h('div', { class: 'mode-icon' }, '📖'),
    h('h3', { class: 'mode-name' }, '가사 암기'),
    h('p',  { class: 'mode-desc' }, '곡별 탭으로 정리된 가사 · 가리기 연습')),
  h('a', { class: 'mode-card link-card', href: 'karaoke/prompter.html' },
    h('div', { class: 'mode-icon' }, '🎤'),
    h('h3', { class: 'mode-name' }, '가사 프롬프터'),
    h('p',  { class: 'mode-desc' }, '실제 곡 시간에 맞춰 흐르는 가사'))
);
```

- `<a href>` 이므로 해시 라우터와 간섭하지 않는다(페이지 전체 전환).
- 역방향: karaoke 화면들의 앱바 좌측에 `← 메인` (`../index.html`).
- i18n: 기존 `t()` 체계에 키를 추가할 수도 있으나, 가사가 한국어 전용이므로 **한국어 하드코딩**으로 둔다(YAGNI). 영어 모드에서도 같은 라벨이 보이는 점은 의도된 타협.
- 기존 파일 수정 범위: `src/ui.js` 1곳(약 15줄 추가) + `styles.css`에 `.app-links`, `.link-card` 규칙. **게임 로직은 한 줄도 손대지 않는다** (R-7).

---

## 8. 구현 순서 (WBS)

| # | 작업 | 산출물 | DoD |
|---|---|---|---|
| M1 | `prd.md` → `songs.js` 변환 (D1·D2 정제, 블록 kind 분류, `sequence` 지정) | `songs.js` | 4곡 23블록 94줄 로드 · 각주·`*` 제거 · `expand()` 결과 98줄 |
| M2 | 타임라인 추정 + 조회 | `timeline.js` | §4.1 검증 조건 3개 통과 (콘솔) |
| M3 | 영속 계층 | `store.js` | 저장·복구·실패 폴백 동작, 키 접두 확인 |
| M4 | 학습 뷰 | `study.html`, `study.js`, `karaoke.css` | 탭 전환·가리기 3모드·체크 유지·폰/태블릿 레이아웃 |
| M5 | 시간 소스 | `clock.js` | TimerClock 정확도(60초 기준 오차 <0.1s), YouTubeClock 재생/탐색 |
| M6 | 프롬프터 (타이머 모드 먼저) | `prompter.html`, `prompter.js` | 저장된 타임라인대로 줄 전환, rAF 루프 DOM 쓰기 최소화 확인 |
| M7 | 프롬프터 YouTube 모드 + 폴백 | 위 파일 | 정상 영상 동기화 / 임베드 차단 영상에서 타이머 폴백 |
| M8 | 싱크 도구 | `sync.html`, `sync.js` | 4곡 중 1곡 실제 보정 완료 → 프롬프터 체감 검증. **「잊기」 보정 시 `sequence` 추론값 검증(Q5)** — 줄이 남거나 모자라면 `sequence` 수정 후 재보정 |
| M9 | 메인 메뉴 연결 | `src/ui.js`, `styles.css` | 홈에서 양방향 이동, 기존 게임 회귀 없음 |
| M10 | 마감 | 전체 | 폰 세로/노트북 실측, 오프라인(타이머) 동작, 콘솔 에러 0 |

**M6까지가 MVP** — 음원 없이도 암기와 프롬프팅이 모두 된다. M7~M8이 "실제 시간 일치"를 완성한다.

---

## 9. 테스트 체크리스트

| 구분 | 항목 |
|---|---|
| 데이터 | 4곡 블록/줄 수가 분석 문서 §2.1 통계와 일치 · 각주·`*` 제거 · `expand()` 전개 98줄 · 「잊기」만 `sequence` 비어있지 않음 |
| 타임라인 | 단조 증가 · 마지막 줄이 `duration − outro` 이내 · `sing ≤ 0`일 때 throw |
| Clock | 타이머 60초 오차 <0.1s · 백그라운드 탭 30초 후 복귀 시 드리프트 없음 · YouTube seek 후 줄 즉시 보정 |
| 폴백 | 잘못된 ID(코드 2) · 임베드 차단(101/150) · 오프라인 → 모두 타이머 모드로 전환되고 사유 표시 |
| 성능 | 줄 전환 없는 프레임에서 DOM 변경 0 (DevTools Performance) · pause 시 rAF 정지 |
| 영속 | 새로고침 후 체크·타임라인·URL·오프셋 유지 · localStorage 차단 환경에서 크래시 없음 |
| 반응형 | 360px 세로(3줄 표시) · 768px 이상(5줄, 학습 뷰 2열) · 가로 스크롤 발생 없음 |
| 회귀 | 기존 악보 게임 4개 모드 정상 · 홈 레이아웃 깨짐 없음 |

---

## 10. 미해결 / 확인 필요

### 10.1 해결됨

| # | 항목 | 결론 |
|---|---|---|
| ~~Q1~~ | 이브 - 잊기 가사 누락 여부 (D3) | **누락 아님.** 출판 가사지와 블록 구조가 일치(4블록·4·4·2·4줄, `*`는 2번째 블록). 짧아 보였던 3번째 블록은 원래 2줄, 마지막 `우-`는 페이드아웃 보컬. 실제 문제는 `*` 반복 미전개였고 §3.2 `sequence`로 해결 |
| ~~Q2~~ | 「암연」 기준 음원 | **고한우 원곡(1997, 4:34)** 으로 확정 |
| ~~Q4~~ | 「사랑합니다」 기준 음원 | **2003 원곡(3:48)** 으로 확정 |

### 10.2 남은 항목

| # | 항목 | 비고 |
|---|---|---|
| Q3 | 4곡의 YouTube 영상 ID | 설계상 하드코딩하지 않음 — 첫 실행 시 URL 입력으로 해결 (R-2) |
| Q5 | 「잊기」 후렴 반복 횟수 (`sequence`가 `[0,1,2,1,3]`인지) | 가사지 `*` 표기에서 추론. 음원을 들어야 확정 → M8 싱크 보정에서 확인 |
| Q6 | 나머지 3곡도 `sequence` 보정이 필요한지 | 가사지에 반복이 전부 적혀 있어 `null`로 두었으나, M8에서 줄이 남거나 모자라면 재검토 |
