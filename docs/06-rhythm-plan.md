# 박자(음표 길이·쉼표) 학습 모드 + 메트로놈 — 분석·설계·계획

| 항목 | 내용 |
|---|---|
| 프로젝트명 | 음악 기본 이론 학습 웹 게임 (악보 배우기) |
| 문서 유형 | 분석 + 설계 + 계획 (구현 코드 없음 · 알고리즘·시그니처 스케치 포함) |
| 작성일 | 2026-08-09 |
| 버전 | v1.0 |
| 대상 코드 | v0.9+ (커밋 05c3913) — 전 파일 실판독 + 열거·산술 실행 검증 |
| 검증 | 5개 영역 독립 조사 → 통합 설계 → **4렌즈 적대적 검증**(이론정확성 · 코드정합성 · 제품YAGNI · 호환접근성) 지적 62건 → 최종 확정 (**수용 50 · 부분수용 11 · 기각 1**) |
| 제약 조건 | 무빌드 · 바닐라 ES modules · 외부 의존성 0 · 플랫 아키텍처 · YAGNI (03-plan §2 원칙 유지) |
| 선행 조건 | **T-0** — `docs/00-music-theory-reference.md`에 §5 박자 챕터 신설 (본 문서 §5가 그대로 초안) |
| 표기 | **[확인]** 코드/실행으로 검증 · **[추정]** 미검증 추론 · **[표준]** 음악 이론 통설 |

---

## 0. 검증 판정표

렌즈 항목 ID: **T**=이론정확성 · **C**=코드정합성 · **P**=제품YAGNI · **A**=호환·접근성. 통합 이슈 ID = **V**.

| V | 렌즈 항목 | 심각도 | 지적 요지 | 판정 | 반영 내용 / 기각 근거 |
|---|---|---|---|---|---|
| V1 | T1·C1·P11 | blocker | `beats2glyph`가 정답 2개인 문항을 구조적으로 생성 + 프롬프트 i18n 키 부재 | **수용** | §4.5: 계열 한정 프롬프트 `askBeatsNote`/`askBeatsRest` 신설, distractor를 **같은 계열 내부**로 제한, `glyph2beats`는 오답을 `units` 값 집합에서 중복 제거 후 추출 |
| V2 | T2 | major | 온쉼표를 '4박'으로 고정 교육 (표준: 한 마디 전체 쉼) | **수용** | §5 §5-2-3 원자 사실 신설, 카피 전량 '4/4에서 4박'으로 한정, i18n `wholeRestMeasure` 추가 |
| V3 | T3 | major | 음자리표는 그리는데 소리는 C5 고정 → 화면 B4·스피커 C5 | **수용** | **[확인]** staff.js:21 + clefs.js:14 → y=64 ⇒ dv=34 ⇒ **B4** / bass는 dv=22 ⇒ **D3**. 재생 음높이를 `RHY_PITCH='B4'`로, 리듬 보표는 `CLEFS.treble` 고정. 신규 export 2개에 `clef` 인자 명시 |
| V4 | T4·P3 | major | `playRhythmCue`가 클릭 2회만 → 기준 박이 '자'가 아니고 비정수 박에서 클릭이 박 아닌 위치 | **부분수용** | 클릭을 **박 위에만** 예약하도록 재설계. 단 개수 공식은 T4의 `max(4, ceil)`(16분음표에서 2.4초 대기)도 P3의 `ceil`(점음표가 박을 가로지르는 소리가 안 남)도 아닌 **`ceil(beats)+1`**(마지막 = 종료 경계) 채택 — §4.4 |
| V5 | T5 | major | readTS/playBar 클릭 간격이 분모 무관 600ms 고정 → 6/8 2배, 2/2 절반 | **수용** | `unitSec(ts) = 60/bpm × (4/ts.bottom)` 도입. `TIME_SIGS`에 `bottom`·`accents` 필드 명시 → §5-2/§6-2 강세 서술 불일치도 **데이터 1곳**으로 구조적 해소 |
| V6 | T6 | major | '몇 박?'을 박자 문맥 없이 질문 | **부분수용** | 프롬프트 한정('4분음표를 1박으로 할 때') · review cap · hint 한정은 **수용**. 자극 SVG에 4/4 박자표 상시 렌더는 **기각** — 320px 가로 예산을 먹고, 모드 F fillBar와 시각적으로 혼동되며, 문맥은 문장 한 줄로 충분 |
| V7 | T7·C4·P8·A11 | major | `barCompositions` normal 2399 재현 불가 + fillBar 구성 기호 미명세 | **수용(강화)** | **[확인: 열거 실행]** easy 32/17/5=**54** 정확 재현 / normal 같은 규칙 614/315/84=**1013**. 2399·"7,133 노드·2ms"는 [확인] 철회. **추가 발견**: 쉼표를 넣으면 잔여 4units에 4분음표·4분쉼표가 **둘 다 정답**이 되는 채점 결함 → '음표 전용'은 용어 문제가 아니라 **불변식** |
| V8 | T8 | minor | 4·8·16분쉼표 오선 위치 명세 부재 | **수용** | §5 §5-2-2에 5종 y 범위표 신설(◇ 관례 마커), `REST_PATHS` 주석 규약화 |
| V9 | T9 | minor | '한 칸 내려갈 때마다' — '칸'은 이미 오선 space 전용어 | **수용** | **[확인]** i18n.js:81-82 · clefs.js:2. '단계'로 교체 |
| V10 | T10 | minor | docs/00 §5를 이미 존재하는 듯 인용 + BPM 100 근거 순환 | **수용** | **[확인]** docs/00은 §1~§4 + 부록으로 끝. §5 목차를 §6 T-0 행에 선확정하고 인용에 (T-0 신설) 표기. BPM 100 근거를 실측 사실로 교체 |
| V11 | T11 | minor | 기존 `drawNote`의 '기둥 없는 채운 머리'는 표준에 없는 조합인데 고지 없음 | **수용** | details에 1문장 + i18n `stemNote` 1키. §4.3의 '기존 drawNote 무수정' 결정은 유지 |
| V12 | T12 | nit | BPM 기준 음표(♩) 미명시 | **수용** | `beatSec` 주석 + 학습 칩 라벨을 '♩ = 60 / 100'로 |
| V13 | T13 | nit | 온음표 머리를 2분음표와 동일 도형으로 렌더 | **수용** | `noteHead(cx, cy, hollow, wide)` 인자 1개 추가 (온음표 rx 11 · rotate 0) |
| V14 | T14 | nit | 니모닉이 '4박' 재강화 + '떨어진다'↔'매달린다' 불일치 | **수용** | 카피 통일 |
| V15 | C2 | blocker | fillBar·readTS의 `playAudio`가 듣기 버튼·L키로 정답 누설 | **부분수용** | `playAudio(revealed)` 인자 도입은 **수용**. 단 적용 대상은 **fillBar·readTS 한정**. `glyph2beats`/`pair`의 '듣고 길이 세기'는 누설이 아니라 **삼중 일치(모양=이름=지속시간)의 소리 축이자 비시각 1급 경로** — 이를 막으면 스크린리더 사용자에게 모드 E가 통째로 닫힌다(A6과 정면 충돌). §4.5에 '의도된 다중 감각 경로'로 명문화 |
| V16 | C3·P1 | major | `.stage-rhythm .choice`가 절대 매칭되지 않음 — ui.js:249 '변경 불필요'는 오판 | **수용** | **[확인]** ui.js:219는 `.stage-visual` div, ui.js:249는 `<main>`. `.stage-chords .choice`(styles.css:363)가 동작하는 근거가 후자. ui.js:249에 rhythm 분기 1줄 추가 |
| V17 | C5·A5(부) | major | `stopAll()`의 `osc.stop(0)`이 기존 4모드 각인음을 매번 절단 + 팝 노이즈 | **수용** | `stopAll`을 **미래 예약분만 취소**로 축소(`startAt > now+0.02`). 진행 중 노드는 자연 릴리즈. D10이 노린 잔음은 막고 회귀 0 |
| V18 | C6 | minor | `.rhy-item` / `.is-on`이 CSS 변경 목록 누락 | **수용** | §4.8 CSS 목록에 편입 |
| V19 | C7·P10 | major | `.review-item{width:150px}`(styles.css:561) 안에서 마디 SVG 판독 불가 | **수용(v1.2 조건부)** | `.review-item.wide{width:100%;max-width:340px}` 추가 + rhythm review 분기에서 클래스 부여 |
| V20 | C8 | minor | `review.cap` 소비처 없음 + "ui.js:352 앞 else if"는 문법적으로 불가 | **수용** | 선택 필드 **4개**로 갱신(`review.cap` 정식 편입), 변경 문구를 "ui.js:351 forEach 본문 최상단 `if` 추가, 기존 staff 분기를 `else if`로" 로 정정 |
| V21 | C9 | minor | i18n 키 누락 + §8-1이 금지한 하드코딩을 §5-1이 스스로 지시 | **수용** | hint를 `data/rhythm.js`의 `HINT_KO`/`HINT_EN` 상수 참조로(modes.js:222와 동일 패턴). 누락 키 전량 보강 |
| V22 | C10·A6 | major | 자극 SVG가 aria-hidden이면 SR 사용자에게 문제 자체가 소실 | **부분수용** | 자극에 **비누설 일반 label**(`symbolImageLabel`) + `role="img"`, aria-hidden 금지 — **수용**. A6의 '형태 서술 label'(꼬리 1개 등)은 **기각**: 형태 서술이 기호 이름과 1:1이라 실질 누설이며 ko/en 20문자열 부채를 만든다. 대신 듣기 버튼을 SR 1급 경로로 명문화(V15와 짝) |
| V23 | C11·P13·A8 | minor | sw.js QA '캐시 22항목 육안 확인'이 판정 근거가 못 됨 + R1 과대평가 | **수용** | **[확인]** sw.js:45는 **네트워크 우선**이고 :48이 모든 GET을 런타임 캐시에 put → 항목 수로 install 성공/실패 구별 불가. R1 등급 🔴→중, 실패 창을 "activate가 구캐시 삭제 직후 온라인 방문 0회 + 오프라인 진입"으로 정확화. QA를 결과 검증으로 교체 |
| V24 | C12·P12 | minor | '≤360px 1열이라 모바일 무영향'은 주류 폰(390~430px)에서 거짓 | **수용** | **[확인]** styles.css:214 `.mode-grid{1fr 1fr}` / :1017 미디어쿼리는 ≤360px. 근거 문장 정정. 단 V31로 홈이 **5카드에서 끝나** 비대칭 자체가 소멸 |
| V25 | C13 | nit | 인용 오차 4건 | **부분수용** | ① t()는 **i18n.js:204** [확인] 수용 ② playNote 호출부 **14개** 수용 ③ staff.js:46/86은 `stroke` 수용 ④ **기각** — game.js:47-49는 초기 `generate()` 1회 + 루프 20회 = **21회 추첨**이므로 `(9/24)^21 = 1.13e-9`가 맞다 [확인: 실행] |
| V26 | P2 | major | 음소거 시 `audioMs` 대기가 무음 3초 정지 | **부분수용** | 문제는 실재. 단 별도 `audioEnabled` 분기는 **불필요** — V37(시각 등가물)로 음소거에서도 화면이 재생되고, V28로 정답 경로 대기가 850ms 고정이 되어 원인이 이중으로 소멸. 리스크 표에만 기록 |
| V27 | P4 | major | 듣기 버튼·L키 연타에 가드 없음 → 예약 시퀀스 중첩 | **수용** | 리듬 `playAudio` 첫 줄 `stopAll()` + ui.js:253 `if (e.repeat) return;` |
| V28 | P5 | major | R5가 대기시간을 절반으로 과소평가(쉼표도 재생 → easy의 50%) | **수용** | **정답 시 리듬 재생 생략**(ui.js:299를 `if (!q.audioMs)`로 가드) + 대기 `res.ok ? 850 : Math.max(1700, audioMs+550)`. → 850ms를 **아예 건드리지 않으므로** docs/05:227 충돌 논쟁(원안 C11) 자체가 소멸, 각주도 불필요 |
| V29 | P6 | major | 학습 페이지 3섹션은 기존 밀도의 3배 — 상한을 목표치로 오독 | **수용** | **[확인]** learn.js:109/222/287/371 — 기존 4페이지 전부 `.learn-sec` 1개. v1.1 학습 페이지를 **1섹션 + details 2개**로 재구성(쉼표 열·점 토글을 사다리에 흡수). T-6 규모 L→M |
| V30 | P7 | major | `barCompositions` 결정적 열거 + 캐시는 출제에 불필요한 인프라 | **부분수용** | **[확인: 실측]** normal 4/4 = 3,084 노드 / **0.077ms** → "40회 × 2ms = 80ms"는 성립 안 함. **캐시 '필수' 철회(선택)**, R8 등급 중→낮음. 단 열거 자체는 **유지** — 잔여 units→정답 기호가 유일하다는 불변식 검증과 균등 분포를 동시에 주고, 재귀 12줄로 거절 표집(10줄)과 비용이 같다. v1.1 범위에서는 아예 제외 |
| V31 | P9 | major | v1.2(모드 F)만 부활 게이트 없이 확정 — 자기 기준 불일치 | **부분수용** | v1.2를 **게이트 조건부**로 강등(§8 백로그 등재). 설계는 보존. 단 '박자표를 모드 E 3번째 유형으로 흡수'는 **기각** — readTS는 마디 개념 없이는 반쪽이고 모드 E의 유형이 4종이 되어 key 규약이 복잡해진다. 박자 문맥은 V6(프롬프트 한정)으로 v1.1에서 충족 |
| V32 | P15 | minor | T-5→T-6→T-7 순서가 사용자 가시적 중간 파손을 만듦 | **수용** | MODES 등록을 v1.1 **마지막**으로 이동 + "T-5 착수 커밋은 i18n 스텁·빈 learn builder 동반"을 완료 조건에 명문화 |
| V33 | P16 | minor | §7-3 '메트로놈 P0' 프레이밍 + lookahead 부활 게이트 과대 | **수용** | 제목을 '리듬 재생 P0(메트로놈 전용 코드 0줄)'로, 게이트를 '수십 초 이상 연속 재생이 필요한 학습이 생길 때'로 축소 |
| V34 | P17 | minor | BPM 칩 3개(60/80/100)에 학습 근거 없음 | **수용** | **[♩=60 | ♩=100] 2개**로 축소. 60 = 1박이 정확히 1초(초시계 산수), 100 = 퀴즈와 동일(전이 확인). 근거 명문화 |
| V35 | P18 | nit | `labelFor` DOM 반환 위험의 인용 위치 부정확 | **수용** | ui.js:**301**(템플릿 리터럴) · **367**(문자열 `+`)로 정정. ui.js:358은 h() kid라 문자열화되지 않음 [확인: ui.js:22-24] |
| V36 | P19 | nit | index.html:7 / manifest description이 주제 목록을 하드코딩 | **수용** | **[확인]** 둘 다 실재. T-9에 편입(manifest 변경 시 캐시 bump는 이미 T-8) |
| V37 | A1 | blocker | 박자 학습이 청각 단독 채널 100% 의존 → 음소거·iOS 무음·난청에서 학습 가치 0 | **수용** | **D11 신설: 청각 비의존 원칙.** 모든 리듬 재생은 시각 등가물(박 pip 행 + 현재 항목 하이라이트 + 박 카운터)을 동반. §4.4 참조 |
| V38 | A2 | major | `.is-on` 하이라이트가 §7-2와 모순 + 동기화 메커니즘 미정의 | **수용** | §7-2의 '시각 pip 불필요' 문장 **철회**. 동기화는 **rAF가 `ctx.currentTime`을 폴링**(setTimeout 금지) — V37과 **단일 메커니즘**으로 통합. A1이 제안한 CSS `animation-delay` 안은 오디오 t0(LOOKAHEAD 보정) 정렬이 추가로 필요해 부채가 늘어나므로 rAF 단일안 채택 |
| V39 | A3 | major | `at > 0` 센티널 결함 — `now()`가 0을 반환하는 결정적 경로 존재 | **수용** | **[확인]** main.js:47-48이 부팅 시 keydown에 armAudio 등록 → ui.js:253의 onkeydown보다 먼저 실행되어 같은 이벤트 안에서 ctx 생성 가능. 센티널을 `at = null`로 이동 |
| V40 | A4 | major | 룩어헤드 0 → 엔벨로프가 과거 시각에 클램프, 2ms 어택 클릭이 팝으로 | **수용** | `LOOKAHEAD = 0.06` + `schedTime()` + `playClick` 내부 `Math.max(at, currentTime+0.005)` 가드 |
| V41 | A5 | major | suspended/interrupted 미처리 + `visibilitychange` 부재 + `playClick` 가드 미기재 | **수용** | `playClick` 첫 줄 `ensure()`/`muted`/`resume()` 3중 가드, main.js에 `visibilitychange → stopAll()` 1줄, `stopAll`은 `if (!ctx) return`로 시작 |
| V42 | A7 | minor | `.is-on { stroke-width }`는 채운 머리에 stroke가 없어 무효 — '색 단독 의존 금지' 주석이 사실과 다름 | **수용** | `.rhy-item.is-on .nh { stroke: currentColor; stroke-width: 2.5; paint-order: stroke }` + reduced-motion에서 transform 제거 |
| V43 | A10 | minor | 320px **세로** 예산 미검증 — compact SVG가 `width:100%`면 보기 버튼 하나가 ~133px | **수용** | **[확인]** styles.css:303-311 `svg.staff{width:100%;max-width:420px;border;padding:6px}`. `.choice-label svg.staff.compact`에 **height 고정값**(84/72/64px) + border·padding·background 무효화. QA 항목을 '세로 예산 측정'으로 교체 |
| V44 | A12 | minor | 기존 `𝄞𝄢`(SMP)와 신규 `♩♪`(BMP)가 같은 홈 화면에서 렌더 품질이 갈릴 수 있음 | **부분수용** | T-10 QA에 '실기기 렌더 여부 기록' 추가는 **수용**. ui.js:115 아이콘 교체는 **백로그(T-20)** — 리듬과 무관한 기존 부채이고, Q7이 세운 '회귀 범위를 섞지 않는다' 원칙과 일관해야 한다 |
| V45 | A13 | minor | mascot.js가 이미 기둥·꼬리 path를 갖고 있는데 staff.js에 세 번째 기하를 신설 | **부분수용** | **꼬리(flag) 베지어를 mascot.js:60에서 스케일 유도**는 수용(수치 재작도 금지, 조형 일관). **머리 타원 비율 통일은 기각** — 마스코트(rx 13.5/ry 10.5)는 얼굴을 담는 캐릭터 확대형이고 오선 머리(rx 8/ry 6)는 줄 간격 12px에 맞춘 조판 치수다. docs/05 §10-4의 '기호 원형 보존'은 **마스코트에 부과된 제약**이지 오선 렌더를 역구속하지 않는다 |
| V46 | A14 | minor | Q3(iOS 무음 스위치)에 `navigator.audioSession` 폴백이 존재 | **수용** | `ensure()` 안에 feature-detect 3줄. **[추정]** 마커 유지 + 부작용(타 앱 오디오 중단) 명시 + T-3 실기기 검증 |
| V47 | A15 | nit | `type:'triangle'` 강제가 사용자의 음색 설정(state.timbre)을 조용히 무시 | **부분수용** | **(a) 현행 유지 + 문서화**를 명시 채택. `pianoVoice(tail)` 인자 추가안은 **기각** — 잔향(audio.js:81)만이 아니라 감쇠 곡선(:80 `t0+0.28`에서 peak×0.3)도 짧은 음의 길이 대비를 흐리므로 tail 하나로는 해결되지 않는다. 학습 페이지에 안내 1줄 + T-3 청음 검증에 두 음색 대조 포함 |
| V48 | A16 | nit | `<html lang="ko">` 고정 — 영어 화면을 한국어 보이스가 읽음 | **수용** | **[확인]** index.html:2. `setState`에 1줄 + main.js:11 직후 초기 1회. T-7에 편입(비용 0) |
| V49 | P14 | minor | §4-2 '전수' 표에 stopAll 지원용 기존 함수 수정 3곳 누락 | **수용** | audio.js:84-95(pianoVoice) · :108-118(단순 경로) · :121-128(playSequence) + :136/:141(playCorrect/Wrong 타이머) 편입. **T-3 규모 S→M** |
| V50 | A9 | minor | learn.js의 `aria-live` 패턴이 이미 무효(리전을 콘텐츠와 동시 삽입) | **수용(분할)** | 마디 조립기 a11y 사양은 **v1.2에 명문화**, 기존 learn.js:329/332 중복·무효 리전 정리는 **T-20(접근성 정리 릴리스)** |

**기각 총계 1건**: C13 ④ (`(9/24)^20` 정정 요구) — 실제 추첨 횟수는 21회이므로 원안 수치 1.1e-9가 정확.

---

## 1. Executive Summary

박자 학습은 **v1.1 모드 1개**(`note-value`)로 좁혀 넣고, 렌더는 **SVG 직접 작도 100%**, 오디오는 `playNote`에 `at` 예약 1개를 더한다. **메트로놈은 독립 기능으로 기각**하되 학습 페이지의 '기준 박' 재생 엔진으로 흡수한다. 검증이 가장 크게 바꾼 것은 셋이다.

1. **박자를 소리로만 가르치던 설계를 고쳤다.** 원안은 시각 pip 제거를 '이득'이라 썼는데, 그러면 사운드 Off·iOS 무음 스위치·난청 사용자에게 이 모드는 학습 가치가 0이 된다. `requestAnimationFrame`이 `ctx.currentTime`을 폴링하는 **단일 시각 동기화 메커니즘**을 도입해 청각 비의존 원칙(D11)을 세웠다.
2. **클릭이 '자(ruler)'가 아니었다.** 시작·끝 2회만 울리면 4박을 셀 수 없고, 비정수 박에서는 클릭이 박이 아닌 자리에 떨어져 "클릭 = 음표가 끝나는 지점"을 오학습시킨다. 클릭을 **박 위에만 `ceil(beats)+1`회** 예약하도록 재설계했다.
3. **[확인] 마커가 붙은 허위 수치를 걷어냈다.** `barCompositions` normal 2399는 재현되지 않는다(같은 규칙으로 **1013**). 검증 과정에서 더 중요한 사실이 나왔다 — fillBar에 쉼표를 넣으면 잔여 4units에 4분음표·4분쉼표가 **둘 다 정답**이 된다. '음표 전용'은 용어 일관성 문제가 아니라 채점 불변식이다.

### 결정 요약표

| # | 결정 | 채택안 | 한 줄 근거 |
|---|---|---|---|
| D1 | 모드 개수 | **v1.1 = `note-value` 1개** / `measure`는 게이트 조건부 | 사용자 요청 범위는 음표·쉼표. 마디 조립기는 v1.1과 맞먹는 규모 |
| D2 | 렌더 | **SVG 100%** (음표·쉼표 유니코드 글리프 0) | 자리표는 tofu여도 문제가 풀리지만(modes.js:62) 쉼표가 tofu면 문항이 소실 |
| D3 | 신규 파일 | **`data/rhythm.js` 1개** | 좌표계·`el()`·`drawStaff()` 전면 재사용 / sw.js ASSETS 표면 최소 |
| D4 | question 규약 | 선택 필드 **4개** + `playAudio(revealed)` | `review.cap` 정식 편입, 누설 분기 |
| D5 | 오디오 | `playNote({at=null})` · `now()` · `schedTime()` · `playClick()` · `stopAll()` | 정렬이 곧 학습 내용 → 한 스냅샷 예약 |
| D6 | 메트로놈 | **독립 기능 기각 / 학습 페이지 재생 엔진으로 흡수** | 연속 기준 박이 필요한 학습이 이번 범위에 0건 |
| D7 | BPM | 퀴즈 **♩=100 고정** / 학습 **♩=[60|100]** | 60은 1박=1초 산수, 100은 퀴즈 전이 확인 |
| D8 | storage | **변경 0** | BPM은 학습 페이지 로컬 상태 (learn.js:4) |
| D9 | 빔 | **백로그** | 개별 꼬리로 그려도 음가 동일 → 이론 오류 아님 |
| D10 | 간격 | **균등** | 비례 간격은 빈칸 폭 눈대중으로 박 합산을 우회시킴 |
| **D11** | **청각 비의존** | **모든 리듬 재생은 시각 등가물 동반** | 지속시간은 시간 위에서 경험되어야 하지만, 그 시간은 눈으로도 흘러야 한다 |
| **D12** | 리듬 보표 | **treble 고정 · 재생 `B4`** | y=64 = B4 [확인] — 위치=이름=소리 원칙 |
| **D13** | 클릭 배치 | **박 위에만, `ceil(beats)+1`회** | 클릭은 음표 경계가 아니라 박의 자다 |
| **D14** | 정답 시 재생 | **생략(850ms 고정)** / 오답만 `audioMs` | easy의 50%가 온·2분 계열 → 대기 폭증 방지, 850ms 미변경 |
| **D15** | fillBar 구성 | **음표 전용** | 쉼표 포함 시 정답 2개 (채점 결함) |

### 4관점 가치표

| 관점 | 문제 | 해법 | 기능·UX 효과 | 핵심 가치 |
|---|---|---|---|---|
| **학습자** | 음높이는 배웠는데 '얼마나 긴가'를 배울 곳이 없다 | 모양=이름=지속시간 삼중 일치를 한 제스처에 | 기호를 보고 길이를 말하고, 클릭 위에서 그 길이를 듣고 본다 | 악보의 두 축(높이·길이) 중 빠진 축이 채워진다 |
| **접근성** | 지속시간은 그려질 수 없다 → 소리 없으면 학습 불가 | 박 pip + 항목 하이라이트 + 박 카운터를 오디오 클럭에 동기 | 음소거·무음 스위치·난청에서도 박이 흐른다 | 학습 채널이 하나 끊겨도 앱이 죽지 않는다 |
| **개발자** | 리듬은 기존 4모드 전제를 여러 곳에서 깬다 | 선택 필드 4개 + ui.js 5줄 + 신규 파일 1개 | 기존 4모드 동작 회귀 0 (`Math.max` 하한이 정확히 현행값 산출) | 확장 비용이 국소화된다 |
| **제품** | '있으면 좋은 것'이 무한히 붙는 주제 | 릴리스 1개로 자르고 나머지는 게이트 달린 백로그 | 홈은 5카드에서 끝난다 | 다음 결정이 이번 결정에 저당 잡히지 않는다 |

---

## 2. 범위 결정

### 2-1. 이번 범위 (v1.1)

| 항목 | 근거 1줄 |
|---|---|
| 온·2분·4분·8분·16분 **음표** 5종 | 5종이면 길이 체계(항상 2배 관계)가 완결된다 |
| 온·2분·4분·8분·16분 **쉼표** 5종 | 음표와 1:1 대응 — 분리하면 각 풀이 5로 쪼개져 비둘기집 재발 |
| **점음표** 3종(점2분·점4분·점8분) | 규칙이 "×1.5" 하나뿐 → 독립 유형 없이 normal 풀에 흡수 |
| 모드 E `note-value` (3유형) | 길이 = 박자 학습의 기초 단위 |
| 학습 페이지 `#/learn/note-value` (**1섹션 + details 2**) | 기존 4페이지가 모두 1섹션 [확인: learn.js:109/222/287/371] |
| **시각 등가 재생**(박 pip · 항목 하이라이트 · 박 카운터) | D11 — 청각 비의존 |
| `docs/00` **§5 박자 챕터** | **T-0 선행** — 정확성 대조 기준(SSOT)이 없으면 QA가 성립하지 않는다 |

### 2-2. 백로그 (게이트 명시)

| 항목 | 밀어낸 이유 | 부활 게이트 |
|---|---|---|
| **모드 F `measure`(박자표·마디) + 학습 페이지** | v1.1과 맞먹는 규모(M+L+16키+CSS), 사용자 요청 범위 밖 | **v1.1 배포 후 `note-value`의 learnSeen·별점이 실제로 쌓이면 착수** |
| **빔(beam)** | 개별 꼬리로도 음가 동일 → 이론 오류 아님 | 학습 페이지 details 고지 후 사용자 혼동 보고 시 |
| **연속 기준 박(lookahead 스케줄러)** | 이번 범위 학습 시나리오가 전부 유한 패턴 | **연속 재생이 수십 초 이상 필요한 학습(예: 연습 모드)이 생길 때** |
| **청음 문항**("리듬 듣고 악보 고르기") | `labelNode`로 보기 SVG는 되지만 정확한 리듬 재생 인프라가 선행 | 위와 동일 인프라 |
| **빠르기말 6종 순서 정렬** | BPM 수치는 출처 편차 커서 순서만 출제 가능 | 모드 F 착수 시 3번째 유형으로 흡수 검토 |
| **6/8 fillBar** | 8분음표가 1박 → "4분음표=1박" 전제와 정면 충돌 | 겹박자 학습 페이지 선행 |
| **점쉼표 · 겹점 · 32분음표** | 교육과정 밖 + 렌더/청각 변별 모두 불리 | — |
| **붙임줄(tie) / 이음줄(slur)** | 오개념 교정 가치는 높으나 곡선 작도 + 2음 배치 필요 | 모드 E 4번째 유형 후보 |
| **fillBar 빈칸 임의 위치** | "남은 박" 직관이 깨져 난이도가 비선형 상승 | 플레이 데이터 확보 후 |
| **`playSequence` → `at` 예약 리팩터** | 기존 4모드·학습페이지 회귀 표면 | `stopAll()` 안정화 후 |
| **접근성 정리 4건** ⚠️ | 전부 **확인된 결함**이지만 리듬과 무관 — 회귀 범위를 섞으면 v1.1 QA가 흐려진다 | **T-20 접근성 정리 릴리스(날짜를 잡을 것)** ① `staff.js:118-119` `<title>` 정답 누설 ② `𝄞𝄢` SVG path 전환(docs/02:354-357 미이행) ③ ui.js:115 홈 아이콘 SMP 글리프 ④ learn.js:329/332 무효·중복 aria-live |
| **홈 카테고리 그룹핑** | 5카드까지는 균형 유지 | **모드 7장째 — 하드 게이트** |
| **`bpm` 설정 영속화** | 학습 페이지 로컬 상태로 충분 | 연속 기준 박 도입 시 (PICK+VALID 짝 필수) |
| **온음표 머리 형태 세부** | V13으로 이번에 반영 — 백로그 아님 | — |

### 2-3. 명시적 제외

| 항목 | 근거 1줄 |
|---|---|
| **홈 '메트로놈' 도구 카드** | 홈 의미가 "학습 모드 목록"→"모드+도구"로 희석 → 다음은 튜너·건반 |
| **앱바 전역 메트로놈 위젯** | `appBar()`는 전 화면 매 렌더 재생성(ui.js:107) + 퀴즈 정답음(ui.js:298)과 충돌 |
| **탭 템포** | 사용 맥락 부재 + 320px에 5번째 컨트롤 |
| **BPM 슬라이더** | 40~208 / 200px = 1.2px당 1BPM → 터치로 "정확히 120" 불가 |
| **리듬 탭 입력 채점** | `choices` 4지선다 고정 + 채점 훅 없음 + 키보드 1~9 점유(ui.js:254-256) |
| **마이크 박자 채점** | docs/01:45 비목표와 동일 사유 |
| **셋잇단음표** | `units` 정수 산술이 1/3에서 붕괴 |

---

## 3. 진단 — 현행 코드가 박자를 담을 수 없는 이유

| # | 벽 | 근거 (file:line) | 결과 |
|---|---|---|---|
| 1 | **음표에 기둥·꼬리·부점이 없다** | `staff.js:129` — `ellipse(rx8 ry6 rotate(-20))` 하나가 전부. 기둥·꼬리·빔·쉼표 글리프 없음 | 4분음표와 2분음표를 그릴 수단이 없다 |
| 2 | **쉼표를 그릴 수단이 없다** | staff.js 전체에 rest 관련 코드 0. 임시표만 유니코드 `<text>`(:53) | 쉼표 문항 자체가 불가능 |
| 3 | **박자표를 그릴 수단이 없다** | `drawKeySignature`(:170)는 조표 전용 | — |
| 4 | **오디오에 예약 시각이 없다** | `audio.js:101` `const t0 = ctx.currentTime;` — 항상 '지금' | 클릭과 음을 정렬할 수 없다 |
| 5 | **시퀀스가 `setTimeout` 기반이고 취소 핸들이 없다** | `audio.js:121-128` | 라우트 이탈 시 잔음(기존 버그 D10). `at` 전환 시 악화 확정 |
| 6 | **피아노 음색이 모든 음에 0.22초 잔향을 붙인다** | `audio.js:81` `t0 + dur + 0.22`, 진입 조건 `:104` | BPM 100에서 ¼박(150ms)↔½박(300ms)의 **2배 차이가 1.4배로 압축** → 길이 학습이 원리적으로 무력화 |
| 7 | **보기 버튼이 문자열만 받는다** | `ui.js:240` `q.labelFor(key)` | "보기가 그림"인 문항을 만들 수 없다 |
| 8 | **자동 진행 대기가 상수다** | `ui.js:314` `res.ok ? 850 : 1700` | 온음표(2.4초)가 다음 문항 위에서 계속 울린다 |
| 9 | **결과 화면 리뷰가 `kind==='staff'` 분기 하나뿐** | `ui.js:352` → `createStaffSVG(q.review.clef, …)` → `staff.js:100` `clef.id` | `kind`를 `'staff'`로 재사용하면 **TypeError**, 그것도 `app().replaceChildren`(ui.js:398) 이전이라 화면이 이전 문항에 멈춘다 |
| 10 | **학습 라우트에 가드가 없다** | `learn.js:82` `builders[mode.id](state, main)` — try/catch·기본값 없음 | 등록 누락 = 학습 화면 백지 |
| 11 | **`docs/00`에 박자 사실이 없다** | **[확인]** §1 오선/자리표 · §2 계이름 · §3 조표 · §4 주파수 + 부록으로 끝 | 정확성 대조 기준 부재 → QA 불성립 |
| 12 | **홈 아이콘 맵이 하드코딩 + 조용한 실패** | `ui.js:115` 객체 리터럴 / `ui.js:22-24`가 `undefined` kid를 skip | 아이콘 누락이 에러 없이 빈칸으로 통과 |

---

## 4. 설계

### 4.1 새 파일 · 변경 파일 전체 목록

**새 파일 1개**

| 파일 | 책임 | 규모 |
|---|---|---|
| `data/rhythm.js` | 음표·쉼표·박자표 상수 + `makeSymbol` 팩토리 + 힌트/라벨 상수. **랜덤 0 · DOM 0 · 오디오 0** | 약 100줄 |

**신설하지 않는 파일**: `src/rhythm.js`(렌더는 staff.js), `src/metronome.js`(§4.7).

**기존 파일 변경 지점 — 전수 (v1.1)**

| # | 파일:줄 | 변경 | 누락 시 |
|---|---|---|---|
| 1 | `staff.js` 말미 | 신규 export 3(`createSymbolSVG`/`createRhythmSVG`/`syncPlayback`) + 내부 헬퍼 9 (~210줄, 227→약 435줄) | — |
| 2 | `audio.js:98` | `playNote(..., { type, peak, **at = null** })` | 예약 재생 불가 |
| 3 | `audio.js:101` | `const t0 = at == null ? ctx.currentTime : Math.max(at, ctx.currentTime + 0.005);` | V39 센티널 충돌 |
| 4 | `audio.js:31-41` `ensure()` | `navigator.audioSession` feature-detect 3줄 | iOS 무음 스위치에서 전 기능 무음 [추정] |
| 5 | `audio.js` 신규 | `now()` / `schedTime()` / `playClick(at, accent)` / `stopAll()` | 정렬 실패·잔음 |
| 6 | `audio.js:84-95` | pianoVoice osc를 `live[]`에 등록(startAt 포함) | `stopAll` 무동작 |
| 7 | `audio.js:108-118` | 단순 경로 osc 등록 | 동상 |
| 8 | `audio.js:121-128` · `:136` · `:141` | `setTimeout` id를 `timers[]`에 등록 | 취소 불가(기존 버그 D10 존치) |
| 9 | `modes.js:228` | `MODES` 배열에 `noteValue` — **v1.1 최종 단계** | — |
| 10 | **`ui.js:115`** | 아이콘 맵 `'note-value': '♩ ♪'` | **조용한 빈 아이콘** |
| 11 | **`ui.js:240`** | `q.labelNode ? q.labelNode(key) : q.labelFor(key)` + `'aria-label': q.labelFor(key)` | 그림 재인 학습 소멸 |
| 12 | **`ui.js:245`** | `onclick: () => q.playAudio(false)` | (v1.2 누설 방어의 선행) |
| 13 | **`ui.js:249`** | `'stage' + (q.kind==='chord' ? ' stage-chords' : q.kind==='rhythm' ? ' stage-rhythm' : '')` | **`.stage-rhythm .choice`가 조용히 미적용** (V16) |
| 14 | **`ui.js:253`** | `if (e.repeat) return;` | 키 반복으로 예약 시퀀스 중첩 |
| 15 | **`ui.js:259-261`** | `q.playAudio(false)` | 동상 |
| 16 | **`ui.js:299`** | `if (!q.audioMs) setTimeout(() => stillHere() && q.playAudio(true), 300);` | 정답 대기 폭증 + 다음 문항 위 잔음 |
| 17 | **`ui.js:304`** | `q.playAudio(true)` | — |
| 18 | **`ui.js:314`** | `res.ok ? 850 : Math.max(1700, (q.audioMs\|\|0) + 550)` | 오답 리듬이 다음 문항 위에서 계속 울림. **850은 미변경** → docs/05:227 충돌 없음 |
| 19 | **`ui.js:351` forEach 본문 최상단** | `if (q.review && q.review.svg) { … } else if (q.kind === 'staff' …)` (기존 분기를 `else if`로 밀기) + `review.cap` 렌더 | 오답 복기에 모양이 안 보임 |
| 20 | **`learn.js:76-81`** | `builders` 맵에 `'note-value'` | **즉시 크래시** — `TypeError`, 가드 없음 |
| 21 | `learn.js` 신규 | 리듬 전용 재생 버튼 (기존 `seqButton`은 **모든 음 길이가 같다고 가정** — learn.js:54) | disabled 해제 타이밍 오류 |
| 22 | **`main.js:26-28`** | `stopAll();` 1줄 | 라우트 이탈 후 예약 음 잔존 |
| 23 | **`main.js` 신규** | `document.addEventListener('visibilitychange', () => document.hidden && stopAll());` | 앱 복귀 시 옛 소리 재생(iOS) |
| 24 | `game.js:31-35` `setState` | `if ('lang' in patch) document.documentElement.lang = state.lang;` + main.js:11 직후 초기 1회 | 영어 화면을 한국어 보이스가 낭독 |
| 25 | `i18n.js` DICT.ko **와** DICT.en | 24키 (§4.8) | **en 누락 = 조용히 한국어 노출** [확인: i18n.js:204] |
| 26 | `styles.css` | §4.8 목록 | 레이아웃 깨짐 · 하이라이트 무동작 |
| 27 | **`sw.js:23` 뒤** | ASSETS에 `'./data/rhythm.js'` 1줄 (21→**22개** [확인]) | 프리캐시 전멸 시 오프라인 첫 진입 부팅 실패 |
| 28 | `sw.js:3` | `'sing-v3'` → `'sing-v4'` | 구자산 잔존 |
| 29 | `modes.js:1` 헤더 주석 | "4개 학습 모드" → 5개 | — |
| 30 | `index.html:7` · `manifest.webmanifest` | description에 '박자' 추가 | 콘텐츠 부채 |
| 31 | `docs/01:45` · `docs/03:347` | "박자·리듬 = 범위 밖" 서술 갱신 | 근거 문서 ↔ 코드 불일치 |

**변경 불필요 [확인]**: `main.js:17-23` 라우터(`MODES.find` 동적 조회) · `storage.js` 전체 · `game.js`의 퀴즈 엔진 · `staff.js` 기존 export 9개.

### 4.2 데이터 모델 — `data/rhythm.js`

```js
// data/rhythm.js — 박자 표준 사실(음표 길이·쉼표·박자표). 랜덤 0 · DOM 0 · 오디오 0.
// 모든 길이 산술은 정수 units. beats는 표시·오디오용 파생값.

export const UNITS_PER_BEAT = 4;   // 1박(♩) = 16분음표 4개
// ⚠️ BPM은 이 파일 전체에서 항상 ♩(4분음표) 기준. 분모가 4가 아닌 박자표는 unitSec()로 환산.

export const RHY_CLEF  = 'treble'; // 리듬 보표는 높은음자리표 고정
export const RHY_PITCH = 'B4';     // 오선 3번째 줄(y=64) = B4  [확인: staff.js:21 + clefs.js:14]

// k = 분할 차수. 도출 공식 (docs/00 §5-1-2, T-0 신설 예정):
//   value = 1/2^k · filled = (k>=2) · stem = (k>=1) · flags = max(0, k-2)
export const NOTE_VALUES = [
  { id:'w', k:0, units:16, ko:'온음표',   en:'whole note',   restKo:'온쉼표',   restEn:'whole rest'   },
  { id:'h', k:1, units:8,  ko:'2분음표',  en:'half note',    restKo:'2분쉼표',  restEn:'half rest'    },
  { id:'q', k:2, units:4,  ko:'4분음표',  en:'quarter note', restKo:'4분쉼표',  restEn:'quarter rest' },
  { id:'e', k:3, units:2,  ko:'8분음표',  en:'eighth note',  restKo:'8분쉼표',  restEn:'eighth rest'  },
  { id:'s', k:4, units:1,  ko:'16분음표', en:'16th note',    restKo:'16분쉼표', restEn:'16th rest'    },
];

// 점음표는 units가 정수로 유지되는 조합만 허용: w(24)·h(12)·q(6)·e(3). s(1.5)는 금지.
export const DOTTABLE = ['h', 'q', 'e'];   // 교육과정 범위 = 점2분·점4분·점8분

export function makeSymbol(valueId, { rest = false, dotted = false } = {}) → {
  id,          // `q` | `q.` | `qr` | `h.`  ─ 점·쉼표 접미
  valueId, k, rest, dotted,
  units,       // 정수 ─ 비교·합산의 SSOT
  beats,       // units / UNITS_PER_BEAT
  filled, stem, flags,   // staff.js 렌더 스펙 (글리프 없음)
  wideHead,    // valueId === 'w'  (온음표 머리는 넓고 기울지 않는다 — V13)
  ko, en,
}

export const EASY_IDS   = ['w','h','q','e'];              // 박 값 {4,2,1,½}
export const NORMAL_IDS = ['w','h','q','e','s'];          // + {¼}
// normal 점음표 3종 추가 시 박 값 집합 = {¼,½,¾,1,1½,2,3,4}

export const VISUAL_PAIR = { wr:'hr', hr:'wr' };          // 온쉼표↔2분쉼표 강제 오답
export function beatsLabel(beats, lang)                   // ¼ ½ ¾ 1 1½ 2 3 4

// 박자표 — bottom·accents를 데이터로 두어 재생 산술과 강세 서술을 한 곳에 고정 (V5)
export const TIME_SIGS = [
  { id:'2/4', top:2, bottom:4, accents:[2,0]           },
  { id:'3/4', top:3, bottom:4, accents:[2,0,0]         },
  { id:'4/4', top:4, bottom:4, accents:[2,0,1,0]       },   // 강·약·중강·약
  { id:'6/8', top:6, bottom:8, accents:[2,0,0,1,0,0]   },   // 겹박자 — readTS 전용
  { id:'2/2', top:2, bottom:2, accents:[2,0]           },   // readTS 전용
];
export const BAR_TS = ['2/4','3/4','4/4'];  // fillBar 전용 — 분모 4 고정 (v1.2)

export const HINT_KO = '온 4 · 2분 2 · 4분 1 · 8분 ½ · 16분 ¼ (4분음표를 1박으로 할 때) — '
                     + '한 단계 내려갈 때마다 길이가 반. 점(·)은 앞 길이의 절반을 더해요.';
export const HINT_EN = 'Whole 4 · half 2 · quarter 1 · eighth ½ · 16th ¼ (with a quarter note = 1 beat) — '
                     + 'each step down halves the length. A dot adds half of the note\'s length.';

// v1.2 (게이트 조건부) — 마디 구성 결정적 열거. 캐시는 선택(실측 0.077ms, V30).
export function barCompositions(tsId, unitList, maxSlots = 5)
```

> **`units` 정수를 SSOT로 두는 이유**: `beats`(0.5/0.25/1.5)는 전부 2의 거듭제곱 분수라 IEEE754에서 정확하지만, 셋잇단음표(1/3)가 들어오면 마디 합산 오차가 생긴다. 정수 `units` 기준이면 도입 시 재정의가 **1곳**(16분→48분)으로 국소화된다.

> **점음표 정수 불변식**: 점16분(units 1.5)을 금지하는 것은 렌더 편의가 아니라 `units` 정수 계약의 유지 조건이다. T-1 자체검증 항목.

### 4.3 렌더링 — `staff.js` 확장

**기존 export 9개 전부 무수정** — `noteToY(20) ledgerYs(25) drawStaff(77) drawNote(113) drawChord(134) drawKeySignature(170) createStaffSVG(200) createChordSVG(213) createKeySigSVG(221)` [확인: 실판독, 파일 227줄]

```js
// ── 신규 상수 ───────────────────────────────────────
const RHY_Y    = 64;   // 리듬 음높이 = 3번째 줄 고정 (= B4, treble)  ← 음높이는 학습 변수가 아님
const STEM_LEN = 42;   // 3.5 × SPACE = 7 × HALF = 1옥타브 = 표준 기둥 길이
const SYM_X    = 185;  // (STAFF_LEFT 70 + STAFF_RIGHT 300) / 2
const TS_X     = 88;   // 박자표 x (조표 startX 78 인근 — staff.js:174)
const SLOT_X0  = 120, SLOT_X1 = 285, MAX_SLOTS = 5;   // 균등 간격 41.25px

// ── 신규 export 3개 ─────────────────────────────────

// 기호 1개. clef 필수(리듬 보표는 CLEFS.treble 고정 — 호출부가 명시).
// compact이면 viewBox를 "135 24 100 96"으로 크롭 — 오선 3·4번 줄 유지 필수
//   (온쉼표 '매달림' vs 2분쉼표 '얹힘' 변별이 보기 버튼에서도 성립해야 한다)
export function createSymbolSVG(sym, clef,
  { compact = false, label = null, highlight = false } = {}) → SVGSVGElement
  // label 없으면 aria-hidden="true"(보기 버튼용).
  // 문제 자극에는 반드시 비누설 label을 준다 — t('symbolImageLabel') (V22)

// 마디. items: [{ sym } | { blank:true }], ts 없으면 박자표 생략           (v1.2)
export function createRhythmSVG(items, clef,
  { ts = null, showBarline = true, label = null, highlightIndex = -1 } = {}) → SVGSVGElement

// 재생 시각 동기화 — setTimeout 미사용. rAF가 오디오 클럭을 폴링한다 (D11/V38)
export function syncPlayback(root, { t0, beatSec, nBeats, clock, counterEl = null })
  → stopFn
```

**`syncPlayback` 스케치** (약 25줄)

```js
export function syncPlayback(root, { t0, beatSec, nBeats, clock, counterEl = null }) {
  if (!root || t0 == null) return () => {};
  const pips  = [...root.querySelectorAll('.beat-pip')];
  const items = [...root.querySelectorAll('.rhy-item')];
  const end = t0 + nBeats * beatSec + 0.15;
  let raf = 0, last = -2;
  const clear = () => {
    cancelAnimationFrame(raf);
    pips.forEach((p) => p.classList.remove('is-on'));
    items.forEach((n) => n.classList.remove('is-on'));
  };
  const tick = () => {
    const t = clock();
    if (t == null || !root.isConnected || t > end) return clear();   // mascot.js:113 선례
    const i = Math.floor((t - t0) / beatSec);
    if (i !== last) {
      last = i;
      pips.forEach((p, k) => p.classList.toggle('is-on', k === i));
      if (counterEl && i >= 0) counterEl.textContent = `${Math.min(i + 1, nBeats)} / ${nBeats}`;
      // (v1.2) items: 누적 units로 현재 울리는 항목을 계산해 is-on
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return clear;
}
```

> **왜 rAF가 오디오 클럭을 폴링해야 하는가** — `setTimeout`으로 시각을 구동하면, C4가 "두 독립 setTimeout의 상대 오차 = 두 지터의 차"라며 배격한 문제가 **오디오-시각 사이에 그대로 재발**한다(오디오는 샘플 정확, 시각은 지터 상한 없음). BPM 100의 16분음표(150ms)에서는 눈에 띈다. rAF가 `ctx.currentTime`을 읽으면 드리프트가 원리적으로 0이고, 백그라운드에서 rAF가 멈춰도 복귀 시 자동 재동기된다.

> **Web Audio 미지원·음소거에서도 시각은 돈다** — `clock`은 `() => now() ?? performance.now()/1000`, `t0`은 `schedTime() ?? performance.now()/1000 + LOOKAHEAD`. `ensure()`는 muted여도 ctx를 만들므로(audio.js:99는 ensure 이후 return) **음소거 상태에서 `now()`는 정상 동작**한다 [확인]. 이것이 D11의 기술적 근거다.

**내부 헬퍼 (비export, 9개)**

```js
noteHead(cx, cy, hollow, wide)  // class="nh". hollow → fill:'none' + stroke
                                // wide(온음표) → rx 11, rotate(0)   ← V13
                                // 배경색 채우기 금지 — 오선 줄 위에서 배경이 어긋난다
stem(cx, cy, dir)               // dir = (y <= 64 ? +1 : -1) → 리듬은 항상 아래 기둥
flags(cx, cy, dir, n)           // ★ mascot.js:60의 flag 베지어를 스케일·평행이동해 유도 (V45)
                                //   위기둥 1벌 작도 + 아래기둥은 기둥 끝 축 상하반전(x 보존)
augDot(cx, y, offX)             // 줄 위 음표면 바로 위 칸(y - HALF = 58)
REST_PATHS = { quarter:'M…', eighth:'M…', sixteenth:'M…' }   // ★ 상수 분리 (폴백 L1)
restShape(id, cx)               // whole → rect(cx-9, 52, 18, 6)  = 4번 줄 아래 매달림
                                // half  → rect(cx-9, 58, 18, 6)  = 3번 줄 위에 얹힘
drawTimeSig(ts, x)              // 숫자 <text> 2개 (y=52 분자 / y=76 분모) — 폰트 리스크 0
drawSlot(x)                     // 빈칸: 점선 + brand색 '?' (createKeySigSVG showNext 선례)
drawRhythmItem(item, cx, i)     // <g class="rhy-item" data-i>
beatPips(n)                     // <div class="beat-pips">·n개 (SVG 밖, HTML) ← D11
```

**쉼표 y 범위 규약 (V8)** — LINE_YS = [40(5줄), 52(4줄), 64(3줄), 76(2줄), 88(1줄)]

| 기호 | y 범위 | 오선 기준 | 마커 |
|---|---|---|---|
| 온쉼표 | 52 → 58 | 4번 줄 **아래에 매달림**, 깊이 6 = 반 칸 | ◆ 표준 |
| 2분쉼표 | 58 → 64 | 3번 줄 **위에 얹힘**, 깊이 6 = 반 칸 | ◆ 표준 |
| 4분쉼표 | ≈50 → 80 | 4번 줄 부근에서 시작해 2번 줄 아래까지, 중앙(3번 줄) 관통 | ◇ 관례 |
| 8분쉼표 | 갈고리 중심 ≈57 / 몸통 하단 ≈76 | 갈고리 1개가 3번 칸, 몸통이 2번 줄까지 | ◇ 관례 |
| 16분쉼표 | 갈고리 중심 ≈57, ≈69 / 몸통 하단 ≈84 | 갈고리 2개, **아래로 한 칸 확장** | ◇ 관례 |

> ◇ 관례 항목은 폰트·판형별 편차가 있으므로 **판독 등가**를 합격선으로 삼는다. R6의 '3획 지그재그 후퇴'가 판정 가능해지는 근거가 이 표다.

**색 처리 — 신규 경로만 `currentColor`**

기존은 `fill="var(--ink)"`를 presentation attribute로 지정한다(staff.js:63/101/128/159 — 참고로 :46/:86은 `stroke`다 [확인]). 신규 리듬 도형은 전부 `currentColor`를 쓰고 CSS에서 색을 준다.

```css
.rhy-item { color: var(--ink); }
.rhy-item.is-on { color: var(--brand); }
.rhy-item.is-on .nh { stroke: currentColor; stroke-width: 2.5; paint-order: stroke; } /* 색 단독 의존 금지 — 실효 있는 형태 단서 */
```

이득 ① 다크모드는 토큰 1곳 ② 하이라이트가 **클래스 토글**(presentation attribute보다 저자 CSS 규칙이 우선) ③ 빈 머리가 `fill:none`+stroke라 덮어쓰기 사고 없음.

> ⚠️ **기존 `drawNote`에는 기둥을 붙이지 않는다** — 모드 A의 과제는 "머리 위치로 음높이 판독"인데 기둥이 y 판독을 방해하고 덧줄 로직(staff.js:123)과 겹친다. 대신 이 비표준 조합을 학습 페이지 details에서 **정직 고지**한다(V11, i18n `stemNote`).

### 4.4 오디오 · 스케줄러

```js
// ── audio.js 확장 (모듈 스코프에 live[] / timers[] 추가) ──────────────
const LOOKAHEAD = 0.06;      // 60ms — JS 실행 + 128샘플 렌더 쿼텀 여유
const live = [];             // { osc, gain, startAt }
const timers = [];           // setTimeout id

// ① 기존 시그니처 하위호환 — 기본값 인자라 14개 호출부 전부 무수정 [확인]
export function playNote(note, durationMs = 500, { type='sine', peak=1, at = null } = {}) {
  if (!ensure() || muted) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = at == null ? ctx.currentTime : Math.max(at, ctx.currentTime + 0.005);
  ...   // pianoVoice(69)·applyEnvelope(46)는 이미 t0를 인자로 받는다 → 내부 무변경
}       // ⚠️ at = 0 은 유효 시각이며 센티널이 아니다 (V39)

// ② 클럭 — ensure()를 호출하지 않는다(초기 진입에서 불필요한 ctx 조기 생성 방지)
export function now()       { return ctx ? ctx.currentTime : null; }
export function schedTime() { return ensure() ? ctx.currentTime + LOOKAHEAD : null; }

// ③ 메트로놈 클릭 — playNote를 경유하지 않는 전용 구현 (~14줄)
//    이유: (a) 2ms 어택 필요 — ATTACK 10ms는 45ms 클릭의 22% (b) pianoVoice 확실 우회
//          (c) master 직결 → setVolume/setMuted/앱바 토글 자동 적용
export function playClick(at, accent = 0) {        // 0 약 · 1 중강 · 2 강
  if (!ensure() || muted) return;                  // ← 가드 명시 (V41)
  if (ctx.state !== 'running') ctx.resume();
  const t = Math.max(at, ctx.currentTime + 0.005); // ← 과거 시각 보정 (V40)
  // square, 1600/1350/1100Hz, peak 0.5/0.42/0.32, 2ms 램프 어택 + 45ms 지수 감쇠
  ...
  track(osc, g, t);
}

// ④ 예약분 취소 — ⚠️ '미래 예약분만' 이 핵심 (V17)
export function stopAll() {
  while (timers.length) clearTimeout(timers.pop());
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const rec of live.slice()) {
    if (rec.startAt > t + 0.02) { try { rec.osc.stop(t); } catch {} }
    // 이미 울리고 있는 노드는 자연 릴리즈에 맡긴다 → 기존 4모드 각인음 절단·팝 노이즈 0
  }
}
```

> **왜 `osc.stop(0)` 전면 중단이면 안 되는가** [확인] — 정답 시 ui.js:311이 `location.hash='#/result'`로 hashchange를 일으키고, 이는 곧 main.js `handle()` → `stopAll()`이다. ui.js:299가 t=300ms에 재생한 음은 pianoVoice 잔향까지 t≈1020ms(모드 D는 1120ms)까지 울리는데, 라우팅은 t=850ms다. 즉 **모든 퀴즈의 마지막 문항에서 학습용 각인음이 매번 잘리고** 파형 중간 절단으로 팝 노이즈가 난다. '미래 예약분만'으로 좁히면 D10이 노린 잔음은 막고 회귀는 0이다.

> **`stopAll`이 pending `setTimeout`도 지워야 하는 이유** [확인] — `playSequence`(audio.js:121-128)·`playCorrect`(:136)·`playWrong`(:141)은 전부 setTimeout 기반이고 취소 핸들을 반환하지 않는다. osc만 멈추면 아직 발사되지 않은 타이머가 새 음을 시작한다.

**리듬 큐 조립 — `modes.js` / `learn.js` 공유 로컬 헬퍼 (setTimeout 미사용)**

```js
const QUIZ_BPM = 100;                                   // ♩ = 100
const beatSec = (bpm = QUIZ_BPM) => 60 / bpm;           // 0.6s
const unitSec = (ts, bpm = QUIZ_BPM) => (60 / bpm) * (4 / ts.bottom);  // 6/8→0.3 · 2/2→1.2 (V5)

// 기호 1개: 박 위 클릭 ceil(beats)+1 회 + 그 위에 얹은 음.  ★ 클릭은 박 위에만 (D13)
function rhythmCue(sym, bpm = QUIZ_BPM) {
  const t0 = schedTime() ?? performance.now() / 1000 + LOOKAHEAD;
  const b = beatSec(bpm);
  const nBeats = Math.ceil(sym.beats);                  // 마지막 클릭 = 종료 경계
  for (let i = 0; i <= nBeats; i++) playClick(t0 + i * b, i === 0 ? 2 : 0);
  if (!sym.rest) playNote(RHY_PITCH, sym.beats * b * 1000, { type:'triangle', peak:0.9, at:t0 });
  return { t0, beatSec: b, nBeats };                    // → syncPlayback 핸들 (D11)
}
export const cueMs = (sym, bpm = QUIZ_BPM) =>
  Math.ceil(sym.beats) * (60000 / bpm) + LOOKAHEAD * 1000 + 120;   // = q.audioMs
```

| 기호 | 클릭 | 음 | 들리는 것 |
|---|---|---|---|
| 온음표 4박 | 5회 (0·600·1200·1800·2400) | 0~2400 | 클릭 4개를 세는 동안 음이 한 번 이어진다 — §4.7 시나리오 1 그대로 |
| 4분음표 1박 | 2회 (0·600) | 0~600 | 클릭 사이를 꽉 채운다 |
| 점4분 1½박 | 3회 (0·600·1200) | 0~900 | **2번째 클릭을 넘어 3번째 직전까지** — 점음표가 박을 가로지른다는 학습 내용 |
| 16분 ¼박 | 2회 (0·600) | 0~150 | 박 클릭 사이에 짧게 들어갔다 나온다 |
| 4분쉼표 1박 | 2회 (0·600) | 없음 | 박은 흐르는데 소리가 없다 — 쉼표도 반드시 재생 |

> **원안의 '시작·끝 2회 클릭'이 왜 틀렸는가** — 온음표에서 클릭이 2번뿐이면 '4박'을 4개의 등간격 사건으로 경험할 수 없고, ¼박에서는 끝 클릭이 150ms 지점(어떤 박도 아닌 곳)에 떨어져 **"클릭 = 음표가 끝나는 지점"**을 오학습시킨다. 박(beat)과 음가(duration)를 분리하는 것이 이 모드의 목표인데 그 둘을 붙여버린다. 원안 §7-1이 클릭을 "도구가 아니라 단위 자(ruler)"라 규정한 것과도 자기모순이다.

> ⚠️ **`type:'triangle'` 명시가 필수다** [확인]. `pianoVoice`는 모든 음에 0.22초 잔향을 붙인다(audio.js:81). BPM 100에서 ¼박(150ms)과 ½박(300ms)이 **370ms vs 520ms**로 들려 실제 2배 차이가 1.4배로 압축된다 — 길이 학습이 원리적으로 무력화된다. `type`을 명시하면 `timbre==='piano' && type==='sine'` 조건(audio.js:104)이 거짓이 되어 `applyEnvelope`(RELEASE 60ms) 경로를 탄다. **audio.js 무수정으로 해결되며, T-3에서 청음 검증이 필수다.**
>
> 부작용(V47): 설정에서 '피아노'를 고른 사용자도 리듬 모드에서는 삼각파를 듣는다. **의도된 예외로 확정**하고 학습 페이지에 안내 1줄. `pianoVoice(tail)` 인자 추가안은 기각 — 잔향만이 아니라 감쇠 곡선(:80 `t0+0.28`에서 peak×0.3)도 짧은 음의 길이 대비를 흐린다.

**정확도 근거**: `osc.start(t)`는 샘플 정확(48kHz에서 ±0.02ms)이다. 한 스냅샷 `schedTime()`에서 클릭과 음을 통째 예약하면 **플램 0**, **백그라운드 스로틀 무관**(예약 후 JS 미개입). 5항목 누적 부동소수 오차는 ~1e-16초.

**모바일**: iOS AudioContext는 `armAudio`(main.js:42-48)가 첫 제스처에서 unlock하고 재생은 항상 버튼 클릭 안이라 자동 충족 [확인]. 무음 스위치는 `navigator.audioSession.type = 'playback'` 폴백 3줄을 `ensure()`에 넣되 **[추정]** 유지 + 실기기 검증(§9 Q3). 부작용: 사용자가 듣던 음악이 멈출 수 있다.

### 4.5 퀴즈 모드 확정 — 모드 E `note-value`

| 항목 | 확정 |
|---|---|
| **id / name / kind** | `note-value` / `noteValue` / **`'rhythm'`** |
| **학습 항목** | "이 기호의 길이(박)". 음높이는 학습 변수가 아님 → 오선 3번째 줄(y=64, **B4**) 고정 |
| **문항 유형 3종** | `glyph2beats`(기호→박) · `beats2glyph`(박→기호, **계열 한정**) · `pair`(음표↔쉼표 짝) |
| **key 규약** | `` `${type}:${answerSymbol.id}` `` — 평가 방향 + 평가 대상 기호 |
| **key에 type 포함 근거** | 모드 C의 `next`/`nth`는 *같은 자극에 문구만 다른* 변형이라 제외했지만(modes.js:132), `glyph2beats`↔`beats2glyph`는 **자극-응답이 반대**(재인 vs 재생)로 모드 B `dir`(modes.js:89)·모드 D `dir`(modes.js:186)과 같은 성격 |
| **풀 크기** | easy **24** (8기호 × 3유형) / normal **36** (13 + 13 + 10; pair는 점음표 제외) |
| **중복** | 24 ≥ 10, 36 ≥ 10 → 비둘기집 하한 0. 재시도 실패 확률 easy 최악 `(9/24)^21 ≈ 1.13e-9` **[확인: 실행]** (game.js:47-49는 초기 1회 + 루프 20회 = 21회 추첨) |
| **난이도 easy** | 음표 4 + 대응 쉼표 4 = 8. 박 값 {4, 2, 1, ½} |
| **난이도 normal** | +16분음표·쉼표, +점음표 3종 = 13. 박 값 +{¼, ¾, 1½, 3} |
| **점음표 처리** | **독립 유형 없음** — 인지 과제가 `glyph2beats`와 동일. normal 풀에 흡수하면 유형 추가 0으로 같은 학습 + 「점 무시」 오개념이 오답 규칙에서 자동 생성 |
| **playAudio** | `(revealed) => { stopAll(); const h = rhythmCue(sym); syncPlayback(...); }` (V27 연타 가드) |
| **audioMs** | `cueMs(sym)` = `ceil(beats)*600 + 180` (온음표 **2580ms**) — **오답 경로에서만 사용** (D14) |
| **hint** | `st.lang === 'ko' ? HINT_KO : HINT_EN` (data 참조 — modes.js:222와 동일 패턴, V21) |
| **review** | `{ svg: () => createSymbolSVG(ans, CLEFS.treble, { highlight:true, label:… }), cap: '4/4에서 4분음표 = 1박' }` |

**유형별 프롬프트 · 보기 · distractor 확정**

| 유형 | 프롬프트 (i18n) | 자극 | 보기 | distractor 규칙 |
|---|---|---|---|---|
| `glyph2beats` | `askBeats` = "**4분음표를 1박으로 할 때**, 이 기호는 몇 박?" / "If a quarter note is 1 beat, how many beats is this?" | 기호 SVG (`label: t('symbolImageLabel')`) | **박 값 텍스트** | `new Set(nearSymbols.map(s => s.units))`로 **중복 제거 후** 인접 3개 → '1박' 버튼 2개 방지 |
| `beats2glyph` | `askBeatsNote` = "1박짜리 **음표**는?" / `askBeatsRest` = "1박짜리 **쉼표**는?" | 박 값 텍스트 | **기호 SVG** (`labelNode`) | 보기 풀을 **정답과 같은 계열로 제한**(`SYMBOLS.filter(s => s.rest === wantRest)`) + `units`가 정답과 같은 기호 무조건 배제 |
| `pair` | `askPairRest` / `askPairNote` | 기호 SVG | **기호 SVG** (`labelNode`) | 정답이 쉼표면 오답도 전부 쉼표(계열 고정) + 인접 길이 |

> ⚠️ **`beats2glyph`가 왜 blocker였는가** — 풀은 음표와 쉼표가 **동일 박 값을 1:1로 공유**한다(w/wr, h/hr, q/qr…). 길이로 정렬하면 4분음표(1박)와 4분쉼표(1박)가 **거리 0으로 최인접**이라 '1박짜리는?'에 ♩와 𝄽가 함께 보기로 들어간다 → 정답이 2개다. `ui.js:285`는 `choice === q.answer` 단일 정답만 인정하므로, 학습자가 **음악적으로 옳은 답을 골라도 오답 처리**되고 다른 버튼에 `.correct`가 붙는다(ui.js:291-292). '정답인 지식을 오답으로 각인'시키는 최악의 형태다. 이 유형의 프롬프트 i18n 키가 원안 목록에 아예 없었다는 것이 미완성의 방증이었다.

**distractor — 인접 규칙이 자동 포착하는 오개념** (normal 정렬: `¼ · ½ · ¾ · 1 · 1½ · 2 · 3 · 4`)

| 정답 | 인접 오답 | 자동 포착 오개념 |
|---|---|---|
| 1박(♩) | 2박, ½박 | ① 머리 채움 혼동 ② 꼬리 개수 혼동 |
| 1½박(♩.) | **1박**, 2박 | ③ **점 무시** — 인접 하단이 정확히 "점을 안 센 값" |
| ¾박(♪.) | **½박**, 1박 | ③ 동일 |
| 3박(𝅗𝅥.) | **2박**, 4박 | ③ 동일 |
| ¼박(16분) | ½박, ¾박 | ② 꼬리 1개 vs 2개 |

**예외 1건**: 온쉼표(4박) ↔ 2분쉼표(2박)는 사각형이 줄 위에 앉느냐 아래에 매달리느냐만 다른 최악의 시각 혼동쌍인데, normal에서는 사이에 3박(점2분)이 끼어 인접에서 밀린다 → `VISUAL_PAIR` 1줄로 **강제 선삽입**(쉼표 계열 문항 한정). 이것이 **유일한 예외**이며 테이블을 더 늘리지 않는다.

**결정성 완화**: 순수 인접이면 같은 정답에 항상 같은 오답이 나온다 → 인접 **n+1개 중 셔플 후 n개** 채택.

**알려진 성질 (의도적 수용, Q4)**: easy의 `glyph2beats`는 박 값이 {4,2,1,½} 4종뿐이라 **보기 4개 = 전체 집합**이 되어 소거법이 통한다. easy의 우주가 4개라는 것 자체가 학습 프레임이고 normal(8종 중 4개)에서 해소된다. 모드 A도 7글자 중 4개로 동일 성격(modes.js:57).

**question 규약 확장 — 선택 필드 4개 + 인자 1개**

```js
// modes.js:2-6 규약 주석 갱신
// question: { key:str, prompt():str, render(el), choices:[key], answer:key,
//             labelFor(key):str,          ← ★ 반드시 String (ui.js:301 템플릿 / :367 문자열 +)
//             playAudio(revealed = false), ← 답변 전/후 구분. 기존 4모드는 인자를 무시 → 무영향
//             hint:str, kind, review,
//             labelNode?(key):Element,    ← 있으면 보기 버튼 내용이 이 노드 (ui.js:240)
//             audioMs?:number,            ← 재생 길이(ms). 오답 대기 하한 (ui.js:314)
//             review.svg?():Element,      ← 오답 복기용 그림 (ui.js:351 분기)
//             review.cap?:str }           ← 복기 캡션. 없으면 labelFor(answer) 폴백
```

| 필드 | ui.js 변경 | 기존 4모드 영향 |
|---|---|---|
| `labelNode` | :240 삼항 + `aria-label` | `undefined` → 기존 경로 **[확인]** |
| `audioMs` | :299 가드 1줄 + :314 인자 | `if(!q.audioMs)` = 항상 참 → 현행 / `Math.max(1700, 0+550)` = **1700 그대로** **[확인]** |
| `review.svg` / `review.cap` | :351 분기 추가 | 기존 staff 분기가 `else if`로 밀릴 뿐 동작 불변 **[확인]** |
| `playAudio(revealed)` | :245 / :259 / :299 / :304 | 인자를 받지 않는 기존 함수는 무시 **[확인]** |

> ⚠️ **절대 금지** — `kind`를 `'staff'`로 재사용하지 말 것. ui.js:352가 `q.review.clef`를 `createStaffSVG`에 넘겨 `drawStaff(undefined)` → `staff.js:100` `clef.id` **TypeError**. 이 throw는 `app().replaceChildren`(ui.js:398) **이전**이라 화면이 갱신되지 않고 이전 문항에 멈춘다 — 사용자에겐 "버튼이 안 먹는 앱"으로 보인다 **[확인]**.

**접근성 계약 (V15·V22)**

| 요소 | 정책 | 근거 |
|---|---|---|
| **문제 자극 SVG** | `role="img"` + **비누설 label** `t('symbolImageLabel')` (ko '악보 기호(그림)' / en 'music symbol (image)'). **aria-hidden 금지** | 자극이 aria-hidden이면 SR 사용자에게 문제 자체가 존재하지 않는다 |
| **듣기 버튼** | `glyph2beats`·`pair`의 **비시각 1급 경로**로 명문화. `aria-describedby`로 프롬프트 연결 | 클릭 위에서 길이를 세는 것은 우회가 아니라 삼중 일치의 소리 축이다 |
| **보기 버튼 SVG** | `labelNode` + `aria-label = labelFor(key)`(기호 이름) | 불가피. `pair`가 SR에서 이름 매칭 과제로 축약되는 한계는 R9에 기술 |
| **신규 SVG** | `<title>` 생성 금지 | staff.js:118-119의 정답 누설 확산 차단 — T-4 회귀 체크리스트 항목 |

**`generate()` 준수 사항 (createQuiz 정합)**

| 규칙 | 근거 |
|---|---|
| `generate()` 안에서 **SVG를 만들지 말 것** — 렌더는 `render(el)` 클로저 안에서만 | game.js:43. 풀 고갈 시 문항당 최대 41회 호출 |
| `labelFor(k)`는 **반드시 String** | ui.js:301 · :367 |
| `playAudio` 필수 | ui.js:245의 듣기 버튼이 **무조건 렌더**됨 → 없으면 TypeError |
| `q.retried`를 쓰지 말 것 | game.js:77 — `true`가 되는 경로가 없어 `accuracy()`가 사실상 `score/total`. 건드리면 **전 모드 별점 기준**(game.js:88-91)이 변한다 |

**모드 F `measure` (게이트 조건부, 설계 보존)**

| 항목 | 확정 |
|---|---|
| 문항 유형 | `fillBar` 70% / `readTS` 30% |
| **fillBar 불변식** ⚠️ | **구성 기호 = 음표 전용(쉼표 제외)** · 채워진 항목 ≥ 1 · 총 슬롯 ≤ 5 · 빈칸 **마지막 고정** · 박자표 **분모 4 고정** |
| **왜 음표 전용인가 (V7 강화)** | 쉼표를 넣으면 잔여 4units에 4분음표·4분쉼표가 **둘 다 정답**이 되어 채점이 붕괴한다. 부수적으로 `askFillBar`("빈칸에 들어갈 **음표**는?")의 용어도 정합해진다 |
| **풀 크기 [확인: 열거 실행]** | easy fillBar **54** (4/4=32, 3/4=17, 2/4=5) + readTS 6 = **60** / normal fillBar **1013** (4/4=614, 3/4=315, 2/4=84) + readTS 10 = **1023** |
| 열거 비용 [확인: 실측] | normal 4/4 = 3,084 탐색 노드 / **0.077ms**. 3 tsId 합계 ~0.12ms → **캐시는 선택** |
| playAudio | fillBar: `revealed ? barCue(ts, [...filled, ans]) : barCue(ts, filled)` (빈칸 구간은 클릭만) / readTS: `revealed ? ts.accents 패턴 : 4박 균일 그리드` |
| audioMs | `ts.top * unitSec(ts) * 1000 + 180` |
| review | fillBar: `{ svg, cap }` + `.review-item.wide` / readTS: `{ srcLabel: ts.id }` → ui.js:366-367 기존 텍스트 분기 재사용 |

> ⚠️ **fillBar 분모 4 고정이 이론 안전장치인 이유**: 6/8은 8분음표가 단위, 2/2는 2분음표가 단위다. fillBar에 넣으면 모드 E가 가르친 "4분음표 = 1박" 전제와 정면 충돌한다. 6/8·2/2는 **readTS(표면 규칙: 분자=개수, 분모=단위음표)에서만** 다룬다 — 표면 규칙 자체는 정확하므로 이론 오류가 아니며, "6/8은 실제로 2박으로 느낀다"는 겹박자 해석은 학습 페이지 details로 격리한다.

### 4.6 학습 페이지 — `#/learn/note-value`

원칙 준수(learn.js:2-4): ① 삼중 일치 ② 섹션 3개 **이하** + `details` 심화 + 하단 CTA ③ **로컬 상태 + 로컬 DOM 갱신**(전역 `setState` 금지).

> **삼중 일치의 박자 버전**: 기존 「**위치 = 이름 = 소리**」 → 박자에서는 「**모양 = 이름 = 지속시간**」. 박자에서 소리의 변수는 음높이가 아니라 **울리는 시간**이다. 음높이는 상수(B4)로 고정하고 duration만 기호를 따른다.

**구성 — 1섹션 + details 2개** (V29: 기존 4페이지가 전부 `.learn-sec` 1개 [확인: learn.js:109/222/287/371])

**섹션 「길이 사다리」** — 5행 세로 스택, 각 행 = `[음표 SVG] [이름] [beatsLabel] [길이 비례 막대] │ [쉼표 SVG]`

| 요소 | 동작 | 삼중 일치 |
|---|---|---|
| 행의 **음표** 클릭 | 확대 오선 + `rhythmCue` + `syncPlayback`(박 pip·카운터) | 모양 = 이름 = 지속시간 |
| 행의 **쉼표** 클릭 | 같은 박 pip이 도는데 **음만 없다** | 「같은 길이인데 하나는 울리고 하나는 침묵」 |
| **점(·) 토글** | 2분·4분·8분 행에만 활성. 켜면 분해식 `♩ 1박 + ♪ ½박 = ♩. 1½박` + 재생 | 점의 효과를 귀·눈으로 |
| **♩ = [60 | 100] 칩** | 로컬 `let bpm = 60`. `.chip` 재사용(styles.css:379, `min-width/height: var(--tap)`=48px) → **신규 CSS 0** | 60 = 1박이 정확히 1초 / 100 = 퀴즈와 동일(전이 확인) |
| **박 pip 행 + 카운터** | `.beat-pips` + `.beat-counter`("2 / 4박") | **D11 — 음소거에서도 박이 흐른다** |

**details 2개**

1. **「온쉼표 vs 2분쉼표」** — 두 rect 대비 그림 + "온쉼표는 줄에 **매달려** 아래로 늘어지고, 2분쉼표는 줄 **위에 앉아요**" + **"온쉼표는 사실 「이 마디 전체를 쉬어요」라는 뜻이에요. 그래서 3/4에서는 3박이 돼요."** (V2·V14)
2. **「실제 악보에서는」** — ① 빔 고지: "8·16분음표는 보통 **빔(묶음줄)**으로 묶어요 — 길이는 같아요" ② 기둥 고지: "다른 퀴즈의 오선에서는 음의 **위치**만 보면 되도록 기둥을 그리지 않아요. 실제 악보에서는 기둥이 꼭 붙어요." (V11)

**로컬 상태**: `let dotted = false`, `let bpm = 60`, `let stopSync = () => {}` — 섹션이 `sec.replaceChildren(...)`로 자기만 갱신(learn.js 전 builder 패턴).

**재생 버튼**: 기존 `seqButton`(learn.js:46-59) **사용 금지** — disabled 해제 공식 `(notes().length-1)*gapMs + durMs + 100`이 **모든 음의 길이가 같다고 가정**한다. 리듬 전용 버튼(`cueMs(sym)` 사용) 별도.

**a11y**: 박 카운터는 **시각 전용**(aria-live 아님 — 박마다 낭독 폭주). 재생 종료 후 "4분음표 = 1박" 요약 1회만 `aria-live="polite"`. learn.js의 기존 무효 라이브 리전 정리는 T-20.

### 4.7 메트로놈 최종 결정

**판정: 독립 기능 기각 / 학습 페이지 재생 엔진으로 흡수 (조건부 채택). 메트로놈 전용 코드 0줄.**

**"범위 이탈이냐 필수 보조냐"를 가르는 것은 무엇으로 불리고 어디에 놓이느냐다.** 홈에 「메트로놈」이라는 **도구**로 놓이는 순간 → 범위 이탈. 학습 페이지 안에서 **재생 엔진**으로만 존재하면 → 필수 보조. **UI에서 "메트로놈"이라 부르지 않는다** — "기준 박" / "박 맞춰 듣기". 이름이 정체성을 만들고, 정체성이 다음 요구(튜너·건반·녹음)를 부른다.

**필수 보조인 근거**: 음표 길이는 비율이지 절대량이 아니다. SVG는 **모양**을, 텍스트는 **이름**을 줄 수 있지만 학습 대상은 **지속시간**이다. 기준 박 없이 "4박"은 그냥 숫자다. 여기서 클릭은 도구가 아니라 **단위 자(ruler)** 다. — 단 이 논거가 성립하려면 클릭이 실제로 자여야 한다. D13(박 위에만, `ceil(beats)+1`회)이 그 조건이고, D11(시각 pip)이 그 자를 눈으로도 만든다.

**"따로 메트로놈 앱 쓰면 되잖아"**: 별도 앱은 '박'을 준다. 이 앱에 필요한 것은 '**박과 표기의 결합**'이고, 결합은 같은 프로세스 안에서만 가능하다 — 같은 AudioContext, 같은 시계, 같은 화면.

**연속 기준 박(lookahead)을 넣지 않는 결정적 근거** — 이번 범위 학습 시나리오 전수:

| 시나리오 | 필요한 것 | 유한/연속 |
|---|---|---|
| 1. 음표 길이 체감 (클릭 4개 vs 온음표 1개) | 클릭 5회 + 지속음 1개 | **유한** |
| 2. 음표↔쉼표 대비 | 클릭 2~5회 | **유한** |
| 3. 점음표가 박을 가로지름 | 클릭 3회 + 음 | **유한** |
| 4. (템포 용어 A/B 비교) | 8박 유한 버스트 ×2 | **유한** — `at` 예약으로 충분. 게다가 빠르기말은 백로그 |

**연속 기준 박이 필요한 학습이 0건이다.** `setInterval` 25ms 스케줄러·`visibilitychange` 재동기·`bpm` 영속화가 전부 불필요해진다.

**P0 범위 = 리듬 재생 (메트로놈 전용 코드 0줄)**

| # | 항목 | 규모 | 메트로놈 전용? |
|---|---|---|---|
| 1 | `playNote`에 `{ at }` (audio.js:98 · :101) | 2줄 | 아니오 — 리듬 큐에 필요 |
| 2 | `now()` / `schedTime()` | 4줄 | 아니오 |
| 3 | `playClick(at, accent)` | ~14줄 | 아니오 — 박의 자 |
| 4 | `stopAll()` + `live[]`/`timers[]` 등록 3곳 | ~30줄 | 아니오 — 기존 버그 D10 해소 포함 |
| 5 | `main.js` 라우트·가시성 킬스위치 | 2줄 | 아니오 |

**비보장 항목 (정직 고지)**

| 항목 | 상태 |
|---|---|
| iOS 무음 스위치에서 소리가 나는가 | **[추정] 미확인** — `navigator.audioSession` 폴백을 넣되 감지 API가 없어 확신 불가. **D11의 시각 채널이 이 위험의 안전판** |
| 데스크톱 백그라운드 탭 정확도 | 예약 후 JS 미개입이라 오디오는 유지. **시각(rAF)은 멈췄다가 복귀 시 재동기** |
| 페이지 전환 중 예약음 | `stopAll()`이 **미래 예약분만** 취소 — 이미 울리는 음은 자연 감쇠 |

**백로그로 넘긴 인프라 (부활 시 설계)**: `src/metronome.js` — `setInterval(25ms) × scheduleAheadTime(0.1s)` lookahead. 필수 가드 2개: ① `nextTime < ctx.currentTime` 재동기(없으면 백그라운드 복귀 시 과거 시각 수십 개를 한 번에 예약해 **클릭이 기관총처럼 터진다**) ② `ctx.state !== 'running'` 확인(iOS 인터럽션 후 무한 헛돎 방지). **배치는 학습 페이지 섹션 한정 — 앱바·홈 도구는 영구 제외.**

### 4.8 i18n · storage · sw.js · styles.css

**원칙**: 기호·박자표 **이름은 `data/rhythm.js`의 `ko`/`en` 필드**(clefs.js 니모닉·chords.js `nameEn` 패턴과 통일 — "음악 사실은 data/, 설명 카피는 i18n"). i18n에는 **UI 문구만**. hint도 `HINT_KO`/`HINT_EN` 데이터 참조(V21).

**v1.1 i18n — 24키 (ko/en 짝 필수). 기존 DICT와 충돌 0건 [확인]**

| 키 | ko | en |
|---|---|---|
| `noteValue` | 음표와 쉼표 | Note Values |
| `noteValueDesc` | 길이(박) 익히기 | How long is each note? |
| `askBeats` | 4분음표를 1박으로 할 때, 이 기호는 몇 박? | If a quarter note is 1 beat, how many beats is this? |
| `askBeatsNote` | {n}박짜리 **음표**는? | Which **note** is {n}? |
| `askBeatsRest` | {n}박짜리 **쉼표**는? | Which **rest** is {n}? |
| `askPairRest` | 이 음표와 길이가 같은 쉼표는? | Which rest matches this note? |
| `askPairNote` | 이 쉼표와 길이가 같은 음표는? | Which note matches this rest? |
| `noteWord` | 음표 | note |
| `restWord` | 쉼표 | rest |
| `beatWord` | 박 | beat |
| `symbolImageLabel` | 악보 기호 (그림) | music symbol (image) |
| `durationLadder` | 길이 사다리 | Duration ladder |
| `halfEachStep` | 한 **단계** 내려갈 때마다 길이가 반이 돼요 | Each step down halves the length |
| `noteRestPair` | 음표와 쉼표는 짝 | Notes and rests pair up |
| `silenceCounts` | 쉼표도 박을 세요 — 소리가 없는 박이에요 | Rests are counted too — silent beats |
| `dotRule` | 점의 규칙 | The dot rule |
| `dotRuleDesc` | 점은 앞 음표 길이의 절반을 더해요 | A dot adds half of the note's length |
| `wholeVsHalfRest` | 온쉼표 vs 2분쉼표 | Whole rest vs half rest |
| `wholeVsHalfRestDesc` | 온쉼표는 넷째 줄에 **매달려** 아래로 늘어지고, 2분쉼표는 셋째 줄 **위에 앉아요** | The whole rest **hangs** from the 4th line; the half rest **sits on** the 3rd line |
| `wholeRestMeasure` | 온쉼표는 사실 「이 마디 전체를 쉬어요」라는 뜻이에요 — 그래서 3/4에서는 3박이 돼요 | The whole rest actually means "rest for the whole measure" — so it is 3 beats in 3/4 |
| `beamNote` | 실제 악보에서는 | In real scores |
| `beamNoteDesc` | 8·16분음표는 보통 빔(묶음줄)으로 묶어요 — 길이는 같아요 | Eighths and 16ths are usually beamed — same length |
| `stemNote` | 다른 퀴즈의 오선에서는 음의 위치만 보면 되도록 기둥을 그리지 않아요. 실제 악보에서는 기둥이 꼭 붙어요 | Other quizzes draw noteheads without stems so you can focus on pitch — real scores always have stems |
| `tempoRef` / `tempoRefHint` | 기준 박 / 클릭에 맞춰 길이를 들어보세요 | Reference beat / Hear the length against the clicks |

**v1.2 i18n (게이트 조건부, 16키)**: `measure`, `measureDesc`, `askFillBar`, `askTsMeaning`, `askTsFromMeaning`, `timeSigWord`, `barWord`, `barBuilder`, `barFull`, `barOver`, `playBarLabel`, `clearBar`, `strongBeat`, **`strongBeatDesc`**, `compoundMeter`, **`compoundMeterDesc`** (V21: Desc 키 비대칭 해소).

> ⚠️ **`t()`는 `DICT[lang][key] ?? DICT.ko[key] ?? key`** [확인: **i18n.js:204**] — **en 누락 시 영어 화면에 한국어가, 양쪽 누락 시 `'noteValueDesc'` 원문이 노출**된다. 조용한 오작동이므로 ko/en을 반드시 짝으로. 또한 `modes.js:105/159`의 i18n 우회 하드코딩 선례를 따르지 말 것.
>
> **미사용 키 부채**: `askNextAccidental`(i18n.js:49/143), `askNthAccidental`(:50/144), `resultTitle`(:58/151), `ordinal`(:66/159)는 어느 JS도 참조하지 않는다 **[확인: grep]**. 위 목록은 전부 실제 참조처가 있는 키만 남겼다.

**storage 스키마 — 변경 0 ✅**

| 검토 항목 | 판정 | 근거 |
|---|---|---|
| `bpm` 추가 | **불필요** | 학습 페이지 로컬 변수. learn.js:4 원칙 준수 |
| `sing-rewards-v1` | **마이그레이션 불필요** | `best[modeId]`는 키 무관 가산 구조 (storage.js:67-76) |
| `learnSeen` / NEW 배지 | **자동 커버** | `state.learnSeen[mode.id]`(ui.js:162) 키 무관 |
| `SETTINGS_KEY` 버전 | **bump 불필요** | 항목 단위 화이트리스트(storage.js:45) |

> ⚠️ **향후 설정 추가 시 함정 재고지** — `PICK`(storage.js:11)에만 넣고 `VALID`(:14-25)를 빠뜨리면 `:45` `VALID[k](parsed[k])` → `TypeError`. 이 호출은 `main.js:11 Object.assign(state, loadSettings())` **모듈 최상위**에서 실행되고 try/catch가 없어 **앱 전체가 백지**가 된다 **[확인]**.

**sw.js**

```js
const CACHE = 'sing-v4';   // sw.js:3 — v4: 박자(음표길이·쉼표) 모드
const ASSETS = [ …, './data/rhythm.js' ];   // sw.js:23 뒤에 1줄 → 21개 → 22개 [확인]
```

⚠️ **실패 창을 정확히 기술한다 (V23 정정)**: sw.js는 **네트워크 우선**이고(:45) 성공한 모든 GET을 런타임 캐시에 put한다(:48). `data/rhythm.js`는 modes.js의 정적 import라 모든 로드에서 요청되므로, ASSETS에서 빠져도 **온라인 방문이 한 번이라도 있으면 오프라인 동작한다**. 진짜 사망 조건은 좁다 — **경로 오타로 `addAll`이 reject(원자적, :29) → 프리캐시 전멸 → activate가 구캐시 삭제(:37) → 온라인 방문 0회로 오프라인 진입**. 이때 캐시 미스가 `index.html`(HTML)을 JS 모듈 응답으로 반환해(:52) `Failed to load module script: MIME type 'text/html'`로 부팅 실패한다.

→ **T-8 완료 조건 (관측 가능한 형태로 교체)**: ① DevTools > Application > Service Workers에 **install 에러 없음** ② 콘솔에서 `caches.open('sing-v4').then(c=>c.match('./data/rhythm.js')).then(r=>!!r)` 가 **true** ③ Network Offline 체크 후 **하드 리로드하여 모드 E 진입까지 완주**. (항목 **개수** 확인은 런타임 캐시 때문에 무효 — 절대 관측되지 않는 수치다.)

**styles.css 변경 목록 (전수)**

```css
/* 리듬 도형 색·하이라이트 */
.rhy-item { color: var(--ink); }
.rhy-item.is-on { color: var(--brand); }
.rhy-item.is-on .nh { stroke: currentColor; stroke-width: 2.5; paint-order: stroke; }  /* V42 */

/* 시각 박 (D11) */
.beat-pips { display:flex; gap:8px; justify-content:center; }
.beat-pip { width:10px; height:10px; border-radius:50%; background:var(--line); }
.beat-pip.is-on { background:var(--brand); transform:scale(1.35); }
.beat-counter { text-align:center; color:var(--ink-soft); font-variant-numeric:tabular-nums; }

/* 보기 버튼 SVG — 세로 예산 확정 (V43). 명시도 0,3,1 > svg.staff 0,1,1 */
.stage-rhythm .choice { padding: 6px; }
.choice-label svg.staff.compact { height:84px; width:auto; max-width:100%;
                                  border:0; padding:0; background:none; }
@media (max-width: 360px) { .choice-label svg.staff.compact { height:72px; } }
@media (orientation: landscape) and (max-height: 560px)
                          { .choice-label svg.staff.compact { height:64px; } }

/* 학습 사다리 */
.ladder-row { display:grid; grid-template-columns:auto 1fr auto auto; align-items:center; gap:8px; }
.ladder-bar { height:8px; border-radius:4px; background:var(--brand); }

/* reduced-motion (styles.css:951 블록에 추가) */
@media (prefers-reduced-motion: reduce) {
  .beat-pip.is-on { transform:none; }   /* 색 전환은 유지 — 상태 피드백 */
}

/* v1.2 조건부 */
.review-item.wide { width:100%; max-width:340px; }   /* V19 */
.bar-gauge { … }
```

⚠️ **ui.js:249 수정이 없으면 `.stage-rhythm .choice`는 매칭 0건**이다(V16) — `.stage-chords .choice`(styles.css:363)가 동작하는 이유는 `.stage-chords`가 `<main>`에 붙기 때문이고, ui.js:219의 `'stage-'+q.kind`는 내부 `.stage-visual` div에만 붙는다. `.choices`는 그 div의 **형제**다.

---

## 5. 박자 이론 표준 사실 — `docs/00` §5 초안

> 신뢰도 마커: **◆ 표준**(교재 간 이견 없음) · **◇ 관례**(조판 관행, 편차 허용) · **▽ 분기**(문맥에 따라 달라짐) · **? 미확인**

### 5-1. 음표 길이 체계

**5-1-1. ◆ 기본 관계** — 인접한 두 음표 길이는 **항상 정확히 2배**다.

**5-1-2. ◆ 도출 공식** — k = 분할 차수(온음표 k=0)

```
value = 1 / 2^k        머리 채움 filled = (k >= 2)
기둥   stem  = (k >= 1)   꼬리   flags  = max(0, k - 2)
```

| k | 이름 (ko / en) | value | units (16분=1) | 4/4 박 | 머리 | 기둥 | 꼬리 |
|---|---|---|---|---|---|---|---|
| 0 | 온음표 / whole (semibreve) | 1 | 16 | 4 | 빈, **넓고 기울지 않음** | 없음 | 0 |
| 1 | 2분음표 / half (minim) | 1/2 | 8 | 2 | 빈 | 있음 | 0 |
| 2 | 4분음표 / quarter (crotchet) | 1/4 | 4 | 1 | 채움 | 있음 | 0 |
| 3 | 8분음표 / eighth (quaver) | 1/8 | 2 | ½ | 채움 | 있음 | 1 |
| 4 | 16분음표 / 16th (semiquaver) | 1/16 | 1 | ¼ | 채움 | 있음 | 2 |

**5-1-3. ▽ 분기 — 「4분음표 = 1박」은 분모 4에서만 참이다.** 박(beat)은 박자표가 정한다. 4분음표는 3/4에서 1박, 2/2에서 ½박, 6/8에서는 분모가 가리키는 단위(8분음표)의 2개분이다. 위 표의 '박' 열은 **4/4 기준값**이다.

**5-1-4. ◇ 기둥 방향** — 머리가 가운데 줄(3번 줄) 이상이면 기둥은 **아래**, 미만이면 위. 길이는 약 1옥타브(3.5칸).

**5-1-5. ◇ 꼬리** — 위·아래 기둥 모두 **기둥의 오른쪽**에 붙는다. 아래 기둥은 수평축 기준 상하반전(x 보존).

### 5-2. 쉼표

**5-2-1. ◆ 음표와 1:1 대응** — 온·2분·4분·8분·16분쉼표가 각각 같은 길이의 음표에 대응한다. 쉼표는 "소리 없음"이 아니라 **"박은 흐르는데 음이 없음"**이다.

**5-2-2. 오선 위 위치** (LINE_YS = 40/52/64/76/88, 아래→위로 1~5번 줄)

| 기호 | 위치 | y 범위 | 마커 |
|---|---|---|---|
| 온쉼표 | 4번 줄 **아래에 매달림**, 깊이 반 칸 | 52~58 | ◆ |
| 2분쉼표 | 3번 줄 **위에 얹힘**, 깊이 반 칸 | 58~64 | ◆ |
| 4분쉼표 | 4번 줄 부근~2번 줄 아래, 중앙 관통 | ≈50~80 | ◇ |
| 8분쉼표 | 갈고리 1개가 3번 칸, 몸통이 2번 줄까지 | 갈고리 ≈57 / 하단 ≈76 | ◇ |
| 16분쉼표 | 갈고리 2개, **아래로 한 칸 확장** | 갈고리 ≈57·69 / 하단 ≈84 | ◇ |

**5-2-3. ◆ 온쉼표의 특례 — 박자표와 무관하게 "한 마디 전체 쉼"** (Read, *Music Notation*; Gould, *Behind Bars*)

4/4에서 4박인 것은 **그 마디가 4박이기 때문**이지 온쉼표의 고유 음가가 4박이어서가 아니다. 3/4에서는 3박, 2/4에서는 2박이다. **2/2의 한 마디 쉼도 2분쉼표가 아니라 온쉼표를 쓴다.** (예외: 4/2의 겹온쉼표)

> 앱 적용: 모드 E는 4/4 문맥을 프롬프트에서 명시하고, 이 사실은 학습 페이지 details로 전달한다.

### 5-3. 점음표

**◆ 규칙**: 점(·)은 **앞 음표 길이의 절반을 더한다** (= ×1.5).

| 기호 | units | 4/4 박 | 분해 |
|---|---|---|---|
| 점2분음표 | 12 | 3 | 𝅗𝅥 2박 + ♩ 1박 |
| 점4분음표 | 6 | 1½ | ♩ 1박 + ♪ ½박 |
| 점8분음표 | 3 | ¾ | ♪ ½박 + 𝅘𝅥𝅯 ¼박 |

**◇ 점의 위치**: 머리가 줄 위면 점은 **바로 위 칸**에, 칸 안이면 같은 칸에.

**◆ 오름차순 정렬**: `¼ · ½ · ¾ · 1 · 1½ · 2 · 3 · 4`

**앱 제약**: 점16분(units 1.5)은 정수 계약을 깨므로 도입하지 않는다. 점쉼표·겹점도 범위 밖.

### 5-4. 박자표

**◆ 표면 규칙**: 위 숫자 = 한 마디에 들어가는 개수, 아래 숫자 = 그 단위 음표(2=2분, 4=4분, 8=8분).

| 박자표 | 한 마디 | 분류 | 실제 박 감각 |
|---|---|---|---|
| 2/4 | 4분음표 2개 | ◆ 단순박자 | 2박 |
| 3/4 | 4분음표 3개 | ◆ 단순박자 | 3박 |
| 4/4 | 4분음표 4개 | ◆ 단순박자 | 4박 |
| 2/2 (alla breve) | 2분음표 2개 | ◆ 단순박자 | 2박 (**2분음표가 1박**) |
| 6/8 | 8분음표 6개 | ◆ **겹박자** | ▽ **3개씩 묶어 2박**(점4분 2개)으로 느낀다 |

**◆ 강세 패턴**: 4/4 = 강·약·중강·약 / 3/4 = 강·약·약 / 2/4·2/2 = 강·약 / 6/8 = 강·약·약·중강·약·약

### 5-5. 마디와 세로줄

**◆** 세로줄(barline)은 마디를 나눈다. 한 마디 안 음표·쉼표의 **units 합은 반드시 박자표가 정한 값과 같다** (4/4=16, 3/4=12, 2/4=8 units).

**◆** 마디 안 각 박에는 강세 위계가 있고(§5-4), 첫 박이 항상 가장 강하다(센박).

### 5-6. 템포와 BPM

**◆** BPM(beats per minute)은 그 자체로는 불완전한 단위다 — **어느 음표를 1박으로 삼는지**가 함께 지정되어야 확정된다. 실제 악보의 메트로놈 지시는 항상 `♩ = 100` 형태로 음표를 명시한다.

**앱 규약**: 본 문서와 코드의 BPM은 **항상 ♩(4분음표) 기준**이다. 분모가 4가 아닌 박자표는 `unitSec(ts) = (60/bpm) × (4/ts.bottom)`으로 환산한다.

**5-6-2. ◆ 검증값 테이블 (♩ = 100 → 1박 = 600ms)** [확인: 산술 실행]

| 기호 | 박 | ms |
|---|---|---|
| 온음표 | 4 | 2400 |
| 2분음표 | 2 | 1200 |
| 점2분음표 | 3 | 1800 |
| 4분음표 | 1 | 600 |
| 점4분음표 | 1½ | 900 |
| 8분음표 | ½ | 300 |
| 점8분음표 | ¾ | 450 |
| 16분음표 | ¼ | 150 |

| 박자표 | 한 마디 (♩=100) |
|---|---|
| 4/4 | 4 × 600 = 2400ms |
| 3/4 | 3 × 600 = 1800ms |
| 2/4 | 2 × 600 = 1200ms |
| 6/8 | 6 × 300 = 1800ms |
| 2/2 | 2 × 1200 = 2400ms |

**5-6-3. ? 미확인 — 빠르기말 BPM 범위**: Largo/Adagio/Andante/Moderato/Allegro/Presto의 수치 범위는 출처 편차가 커서 **순서만** 표준으로 취급한다. 이번 범위에서는 다루지 않는다(백로그).

### 5-7. 조판 관례 (◇ — 음가 규칙이 아님)

| 항목 | 내용 | 앱 처리 |
|---|---|---|
| **빔(beam)** | 인접한 8·16분음표 2개 이상을 꼬리 대신 가로줄로 묶는다. **음가는 동일** | 그리지 않음. 학습 페이지 details로 정직 고지 |
| **빔의 한국 교육과정 용어** | **?** 교재에 따라 '빔' / '묶음줄' / 무명 | 확인 전까지 **"빔(묶음줄)" 병기** (§9 Q8) |
| **꼬리(flag)** | 표준 한국어 용어는 '**꼬리**' | `data/rhythm.js`·`mascot.js:3` 주석 통일 (§9 Q9) |
| **기둥 없는 채운 머리** | 표준 기보에 **존재하지 않는 조합** | 기존 4모드의 의도적 단순화 — details로 고지 |
| **온음표 머리** | 2분음표 머리보다 가로로 넓고 거의 기울지 않는다 | `noteHead(..., wide)` 반영 |

### 5-8. 한/영 용어 대조표

| 한국어 | English | 비고 |
|---|---|---|
| 음표 / 쉼표 | note / rest | |
| 박 / 박자표 | beat / time signature | |
| 마디 / 세로줄 | measure (bar) / barline | |
| 기둥 / 꼬리 / 빔 | stem / flag / beam | '깃발' 아님 |
| 점음표 | dotted note | |
| 센박 / 여린박 | strong beat / weak beat | |
| 단순박자 / 겹박자 | simple meter / compound meter | |
| 붙임줄 / 이음줄 | **tie** / **slur** | ⚠️ 흔한 혼동 — 뒤바꾸지 말 것 |
| 셋잇단음표 | triplet | |
| 온음표 = whole note | semibreve (英) | 미국식/영국식 병기 |

### 부록: §5 원자 사실 체크리스트 (QA 대조용)

1. ◆ 인접 음표 길이는 항상 2배다.
2. ◆ 머리 채움은 4분음표부터, 기둥은 2분음표부터, 꼬리는 8분음표부터.
3. ◆ 점은 앞 길이의 절반을 더한다(×1.5).
4. ◆ 온쉼표는 4번 줄 **아래에 매달리고**, 2분쉼표는 3번 줄 **위에 앉는다**.
5. ◆ **온쉼표는 박자표와 무관하게 한 마디 전체 쉼**이다. 4/4에서만 4박.
6. ◆ 쉼표도 박을 센다 — 박은 흐르는데 음이 없을 뿐이다.
7. ▽ 「4분음표 = 1박」은 분모가 4일 때만 참이다.
8. ◆ 박자표 위 = 개수, 아래 = 단위 음표.
9. ◆ 6/8은 겹박자 — 단위는 8분음표지만 실제로는 3개씩 묶어 2박.
10. ◆ 2/2는 2분음표가 1박.
11. ◆ 4/4 강세 = 강·약·중강·약.
12. ◆ 한 마디 units 합은 박자표 값과 정확히 같다.
13. ◆ BPM은 기준 음표(♩ 등)와 함께여야 확정된다.
14. ◇ 빔은 조판 관례이고 음가를 바꾸지 않는다.

---

## 6. 릴리스 WBS

> **구현 상태 (2026-08-09)**: T-0 및 v1.1 전 항목(T-1~T-10) 구현·검증 완료. 확정 답변 — Q1=BPM 100 / Q2=v1.2 게이트 조건부 보류 / Q5=D11 수용.
> 검증 결과: 풀 easy 24·normal 36(100세션 중복 0·연속중복 0) · 정답 유일성 결함 0(6만 문항) · 기존 4모드 오답 대기 1700ms 불변 · 콘솔 에러 0 · 사운드 Off에서 박 pip 정상 · 영어 UI 한글 잔존 0 · 320×568 스크롤 없이 완주.
> 미검증(실기기 필요): iOS 무음 스위치 · 실기기 SMP 글리프 렌더 · 청음 대비(¼박↔½박).

### T-0 — 선행 게이트 (문서, 릴리스 아님)

| ID | 작업 | 규모 | 파일 | 완료 조건 |
|---|---|---|---|---|
| **T-0** | `docs/00`에 **§5 박자·음표길이·쉼표** 신설 (§5-1 음가 / §5-2 쉼표 / §5-3 점음표 / §5-4 박자표 / §5-5 마디 / §5-6 템포·검증값 / §5-7 조판 관례 / §5-8 용어 / 부록) | **M** | `docs/00-music-theory-reference.md` | §1~§4와 동일 형식(표 중심·원자 사실·부록 체크리스트) + 신뢰도 마커 ◆◇▽? 도입. **본 문서 §5가 그대로 초안** |

> ⚠️ 본 문서가 `docs/00 §5-x-x`를 인용하는 모든 곳은 **T-0에서 신설 예정**인 forward reference다(V10). BPM 100의 근거는 순환을 제거하고 실측으로 대체: **16분음표가 150ms로 남아 지각 변별이 가능하고, 온음표 오답 대기가 3.13초로 상한 안에 든다** (둘 다 본 문서에서 산술 검증).

### v1.1 — 음표와 쉼표 (독립 배포 슬라이스)

| ID | 작업 | 규모 | 파일 | 완료 조건 / 비고 |
|---|---|---|---|---|
| T-1 | `data/rhythm.js` 신설 | **S~M** | `data/rhythm.js` | 점음표 units 정수 불변식 자체검증(w24·h12·q6·e3, s 금지). 랜덤 0 · DOM 0 |
| **T-2** | `staff.js` 확장 — 기둥·꼬리·부점·빈/넓은 머리·쉼표 5종·박자표·`createSymbolSVG`·`createRhythmSVG`·`syncPlayback` | **L** | `src/staff.js` | ⚠️ **임계경로**(T-5·T-6 의존). 기존 export 9개 무수정. `REST_PATHS` 상수 분리. flag는 mascot.js:60 베지어에서 유도 |
| T-3 | `audio.js` — `{at=null}` · `now()` · `schedTime()` · `playClick()` · `stopAll()` + `live[]`/`timers[]` 등록 3곳(:84-95, :108-118, :121-128) + `:136`/`:141` 타이머 등록 + `audioSession` 폴백 / `main.js` 킬스위치 2곳 | **M** (S→M 상향, V49) | `src/audio.js`, `src/main.js` | ⚠️ **청음 검증 필수** — ① `type:'triangle'`로 ¼박↔½박 2배 대비가 보존되는가(피아노·단순 두 설정) ② 클릭에 팝 노이즈가 없는가 ③ **기존 4모드 마지막 문항 정답 시 각인음이 끝까지 들리는가** ④ iOS 실기기 무음 스위치 |
| T-4 | question 규약 4필드 + `playAudio(revealed)` + ui.js **9곳**(:115 :240 :245 :249 :253 :259 :299 :314 :351) + 기존 4모드 회귀 | **S~M** | `src/ui.js`, `src/modes.js` 주석 | 회귀 테스트: 모드 A~D 각각 **오답 1개 이상 만들고 결과 화면 진입**. `Math.max(1700, 0+550)` = 1700 확인 |
| T-5 | 모드 E 구현 + 풀 계측(24/36, 100세션 중복 0 — 04 R-5 방식) | **M** | `src/modes.js` | ⚠️ **착수 커밋에 i18n 키 스텁 + 빈 learn builder 동반 필수**(V32·R2). `nearSymbols`는 **계열 내부**에서만, `glyph2beats`는 units 중복 제거 |
| T-6 | 학습 페이지 `note-value` — **1섹션(길이 사다리) + details 2** + ♩ 칩 2개 + 박 pip·카운터 | **M** (L→M 하향, V29) | `src/learn.js`, `styles.css` | 리듬 전용 재생 버튼(`cueMs`). `seqButton` 사용 금지 |
| T-7 | i18n **24키**(ko/en) + 홈 아이콘 `'♩ ♪'` + `document.documentElement.lang` 1줄 | **S** | `src/i18n.js`, `src/ui.js:115`, `src/game.js` | en 누락 grep 검사 |
| **T-7b** | **MODES 배열 등록** (`modes.js:228`) | **XS** | `src/modes.js` | ⚠️ **v1.1의 마지막 코드 커밋** — 이 시점 이전에는 홈에 카드가 없어야 한다 |
| T-8 | `sw.js` 자산 1줄 + 버전 v4 | **XS** | `sw.js:3, 23` | 완료 조건 = §4.8의 관측 가능한 3단계(install 에러 없음 / `c.match` true / 오프라인 하드 리로드 완주) |
| T-9 | 문서·메타 갱신 — `docs/01:45`, `docs/03:347`, `index.html:7`, `manifest.webmanifest` | **XS** | — | |
| T-10 | QA (아래 표) | **S** | — | |

**의존**: T-0 → T-2 → (T-1 · T-3 병렬) → T-4 → T-5 → T-6 → T-7 → T-7b → T-8 · T-9 → T-10

**T-10 QA 체크리스트**

| # | 항목 | 합격선 |
|---|---|---|
| 1 | **세로 예산** | 320×568 및 landscape(≤560h)에서 **프롬프트~보기 4개가 스크롤 없이 한 화면**(V43) |
| 2 | 홈 5카드 | 320 / 360 / 390 / 430px에서 레이아웃 무파손 |
| 3 | 다크 모드 | `.rhy-item` 색 토큰 + `.is-on` 대비 |
| 4 | 키보드 완주 | 1~4 선택 / H 힌트 / L 듣기(**연타에 중첩 없음**) |
| 5 | `prefers-reduced-motion` | `.beat-pip.is-on` transform 무효화, 색·카운터는 유지 |
| 6 | **음소거 QA** | 사운드 Off에서 **박 pip과 카운터가 정상 재생**되는가 (D11 핵심) |
| 7 | 스크린리더 | 자극이 "악보 기호(그림)"로 읽히고 aria-hidden이 아님 / 신규 SVG에 `<title>` 없음 |
| 8 | 오디오 회귀 | 모드 A~D 마지막 문항 각인음 절단 없음 / 설정↔퀴즈 왕복 시 잔음 없음 |
| 9 | `docs/00 §5` 전수 대조 | 부록 체크리스트 14항목 |
| 10 | 실기기 기록 | iOS Safari / Android Chrome에서 `𝄞 𝄢` 렌더 여부 기록(T-20 게이트 근거 확보, V44) |

### v1.2 — 박자표와 마디 (**게이트 조건부**)

**게이트**: v1.1 배포 후 `note-value`의 `learnSeen` · 별점 기록이 실제로 쌓일 것.

| ID | 작업 | 규모 | 비고 |
|---|---|---|---|
| T-11 | `data/rhythm.js`에 `barCompositions` 활성화 | S | 완료 조건 = **열거 결과를 콘솔 출력해 문서값과 대조**(easy 54 / normal 1013)하고 ≥100임을 확인. 고정 숫자를 게이트로 두지 말 것 |
| T-12 | 모드 F 구현 + `playAudio(revealed)` 누설 분기 + readTS 30% 가중 | M | fillBar 불변식(음표 전용·분모 4 고정) 코드 주석에 명문화 |
| T-13 | 학습 페이지 `measure` 2섹션(박자표 읽기 · 마디 조립기) | L | 조립기 a11y: 게이지 노드를 `render()` 밖에서 1회 생성 + `aria-live="polite" aria-atomic="true"`, 오버플로우는 별도 `role="alert"`, 마디 내용은 `<ol>` + 시각적 숨김 텍스트 (V50) |
| T-14 | i18n 16키 + 홈 아이콘 `'4/4'` + **6카드 2×3 확인** | S | |
| T-15 | QA: 320px 6카드 / 5슬롯 판독 / `.review-item.wide` / 조립기 터치 48px | S | |

### v1.3+ — 조건부

| ID | 작업 | 게이트 |
|---|---|---|
| T-16 | 빔(beam) 렌더 ~10줄 | 사용자 혼동 보고 |
| T-17 | `src/metronome.js` lookahead + `bpm` 영속화 | **수십 초 이상 연속 재생이 필요한 학습이 생길 때** |
| T-18 | 청음 문항 | T-17 완료 |
| T-19 | 붙임줄 vs 이음줄 (모드 E 4번째 유형) | — |
| **T-20** | **접근성 정리 릴리스** — ① `staff.js:118-119` `<title>` 정답 누설 ② `𝄞𝄢` SVG path 전환(docs/02:354-357) ③ ui.js:115 홈 아이콘 SMP → SVG/BMP ④ learn.js:329/332 무효·중복 aria-live | **"나중에"가 아니라 날짜를 잡을 것** (§9 Q7) |

---

## 7. 리스크 & 완화

| # | 리스크 | 등급 | 완화 |
|---|---|---|---|
| R1 | `sw.js` 프리캐시 전멸 → **온라인 방문 0회 + 오프라인 진입 시** 부팅 실패 | **중** (🔴→중, V23) | 네트워크 우선(sw.js:45) + 런타임 put(:48)이 대부분을 메운다. T-8 완료 조건을 `c.match` true + 오프라인 완주로 교체 |
| R2 | `learn.js:76-81` builders 누락 → 학습 라우트 백지 (`TypeError`, 가드 없음) | 🔴 | T-6 첫 커밋에서 builders 등록을 **먼저** 하고 빈 함수로 시작. T-5 착수 커밋 동반 조건에도 포함 |
| R3 | `kind`를 `'staff'`로 재사용 → 결과 화면 크래시 (ui.js:352 → staff.js:100) | 🔴 | `kind:'rhythm'` 신설을 규약 주석에 명문화. T-4 회귀에 "오답 1개 이상 + 결과 화면 진입" |
| R4 | 피아노 잔향이 길이 대비를 왜곡 (audio.js:81 — ¼↔½박 2배가 1.4배로 압축) | 🔴 | `type:'triangle'` 명시로 pianoVoice 우회 — **audio.js 무수정**. T-3 **청음 검증 필수**(코드 검토로 판정 불가) |
| **R5** | **박자를 소리로만 가르치는 설계** — 사운드 Off·iOS 무음·난청에서 학습 가치 0 | 🔴→**중** | **D11**(박 pip·항목 하이라이트·박 카운터, rAF가 오디오 클럭 폴링)로 해소. QA #6이 검증 게이트 |
| R6 | 클릭이 박이 아닌 위치에 떨어져 "클릭 = 음표 끝"을 오학습 | 🔴→**해소** | **D13** — 클릭은 박 위에만, `ceil(beats)+1`회. 마지막이 종료 경계 |
| R7 | `beats2glyph`가 정답 2개 문항 생성 → 옳은 답이 오답 처리 | 🔴→**해소** | 계열 한정 프롬프트 + 계열 내 distractor + 동일 units 배제 |
| R8 | 4분쉼표 SVG가 실물과 달라 학습자 혼동 (개연성 가장 높음) | 중 | `REST_PATHS` 상수 분리 → 로직 무수정 `d` 교체. §5-2-2의 y 범위표가 판정 기준. 최악의 경우 판독 등가 3획 지그재그로 후퇴 |
| R9 | 320px에서 16분음표 꼬리·8분쉼표 뭉개짐 (1 viewBox 단위 ≈ 0.94px) | 중 | ① 보기 SVG는 크롭 viewBox(100×96) + **height 고정 84/72/64px** ② 자극은 320 폭 전체 ③ 부족 시 viewBox 폭 320→400 (`svg.staff{max-width:420px}` 무수정) |
| R10 | 보기 버튼 SVG의 스크린리더 한계 — `aria-label`(기호 이름)이 읽혀 `pair`가 이름 매칭 과제로 변질 | 중 | 모드 A(오선 위치 읽기)와 동일한 본질적 한계. **자극·보기 양쪽 모두**에 해당. 완전 대체 불가 → 듣기 버튼을 비시각 1급 경로로 명문화 + 학습 페이지가 이름·모양·소리를 모두 제공. 문서에 명시 |
| R11 | 오답 대기 3.13초 (온음표, `max(1700, 2580+550)`) | 중 | 오답 경로 한정 + 오답률이 낮아 세션 영향 작음. **정답은 850ms 미변경**(D14) → 원안 R5(정답 대기 2.9초)는 소멸. 레버: BPM 100→120 |
| R12 | `stopAll()`이 기존 오디오 동작을 바꿈 | 낮음 | **미래 예약분만 취소**로 좁혀 회귀 0. "재생 중 ⚙ 설정 진입 → 복귀" 시나리오를 T-10 #8에 포함 |
| R13 | 열거 비용 | **낮음** (중→낮음, V30) | **[실측]** normal 4/4 = 3,084 노드 / 0.077ms. 캐시는 선택 |
| R14 | 음소거 상태에서 `audioMs` 대기가 무의미해 보임 | 낮음 | D11로 대기 중에도 시각 큐가 돌아 '멈춤'이 아님. 별도 분기 불필요 |
| R15 | `type:'triangle'`이 음색 설정을 무시 | 낮음 | **의도된 예외로 확정** + 학습 페이지 안내 1줄 + T-3에 두 음색 대조 청음 |
| R16 | 홈 5카드 비대칭(2+2+1)이 390~430px 주류 폰에서 노출 | 낮음 | **[확인]** ≤360px에서만 1열(styles.css:1017). v1.2를 게이트로 미뤄 **홈이 5카드에서 끝나므로** 영구 상태가 되나, 5는 2+2+1로 마지막 행 1장 — 수용 가능한 미관 문제로 솔직히 표기 |
| R17 | 7번째 모드 추가 시 홈 정보구조 붕괴 | 낮음 | **하드 게이트**: 7장째부터 카테고리 그룹핑 선행 |
| R18 | 셋잇단음표·붙임줄 도입 시 `units` 정수 붕괴 | 낮음 | `units` SSOT 이유. 도입 시 16분→48분 재정의 **1곳** |
| R19 | `docs/00`에 박자 사실 부재 → 정확성 대조 기준 없음 **[확인]** | 🔴 | **T-0을 선행 게이트로 고정** |

---

## 8. 백로그 등재 항목 (`docs/03-plan.md` §9에 추가할 행)

| 우선순위 | 항목 | 출처 | 게이트 / 비고 |
|---|---|---|---|
| **Should** | 모드 F `measure`(박자표·마디) + 학습 페이지 조립기 | 본 문서 §4.5 | **v1.1 배포 후 `note-value`의 learnSeen·별점이 쌓이면 착수.** 설계는 본 문서에 보존 |
| **Should** | **접근성 정리 릴리스(T-20)** — `staff.js:118-119` `<title>` 정답 누설 / `𝄞𝄢` SVG path 전환(docs/02:354-357 미이행) / ui.js:115 홈 아이콘 SMP / learn.js:329·332 무효·중복 aria-live | 검증 4렌즈 | 전부 **확인된 결함**. "나중에"가 아니라 **날짜를 잡을 것** |
| Could | 빔(beam) 렌더 ~10줄 | §2-2 | 학습 페이지 details 고지 후 사용자 혼동 보고 시 |
| Could | 붙임줄(tie) vs 이음줄(slur) — 모드 E 4번째 유형 | §2-2 | 곡선 작도 + 2음 배치 필요 |
| Could | `playSequence` → `at` 예약 리팩터 | §2-2 | `stopAll()` 안정화 후 |
| Could | 빠르기말 6종 순서 정렬 | §2-2 | 모드 F 착수 시 3번째 유형으로 흡수 검토 |
| Later | 연속 기준 박(`src/metronome.js` lookahead) + `bpm` 영속화 | §4.7 | **연속 재생이 수십 초 이상 필요한 학습(예: 연습 모드)이 생길 때** |
| Later | 청음 문항("리듬 듣고 악보 고르기") | §2-2 | 위와 동일 인프라 |
| Later | 6/8 fillBar | §2-2 | 겹박자 학습 페이지 선행 |
| Later | fillBar 빈칸 임의 위치 | §2-2 | 플레이 데이터 확보 후 |
| Later | 홈 카테고리 그룹핑(섹션 헤더) | §2-2 | **모드 7장째 — 하드 게이트** |
| 제외 유지 | 홈 메트로놈 도구 카드 · 앱바 위젯 · 탭 템포 · BPM 슬라이더 · 리듬 탭 채점 · 마이크 채점 · 셋잇단음표 · 점쉼표 · 겹점 · 32분음표 | §2-3 | 무빌드·YAGNI·이론 충돌 |

---

## 9. 미결 질문 (사용자 확인 필요 — 권장안 병기)

| # | 질문 | 권장안 | 판단이 필요한 이유 |
|---|---|---|---|
| **Q1** | 퀴즈 기준 BPM = **100 vs 120** | **100** | D14로 정답 대기가 850ms 고정이 되어 **원안 대비 무게가 크게 줄었다**. 남은 차이는 오답 대기(온음표 3.13초 vs 2.73초)와 16분음표 변별(150ms vs 125ms, 후자는 지각 한계 근접). **오답에서 3.1초 대기를 수용할 수 있는가**가 핵심 |
| **Q2** | **v1.2(모드 F)를 게이트 조건부로 미루는 것**에 동의하는가 | **동의(게이트 부여)** | 사용자 요청은 '음표·쉼표'였고 마디 조립기는 v1.1과 맞먹는 규모. 다만 박자표 없이는 '몇 박'의 문맥이 약해지는데, 이는 프롬프트 한정('4분음표를 1박으로 할 때')으로 v1.1에서 커버한다. **더 미룰 것인가 vs 한 번에 갈 것인가**의 교환 |
| **Q3** | iOS 무음 스위치에서 WebAudio가 들리는가 | **폴백 구현 + 실기기 검증** | `navigator.audioSession.type='playback'`(Safari 16.4+) 3줄은 무해하나 **[추정]**이며, 사용자가 듣던 음악을 멈추는 부작용이 있다. 실패해도 **D11의 시각 채널로 학습은 성립**한다 |
| **Q4** | easy `glyph2beats`의 "보기 4개 = 전체 집합" 수용 | **수용** | 소거법이 통하지만 easy의 우주가 4개라는 것 자체가 학습 프레임이고, 모드 A도 7글자 중 4개(modes.js:57). normal에서 해소 |
| **Q5** | **D11(시각 등가 재생)의 비용을 수용하는가** — `syncPlayback` ~25줄 + CSS 4블록 + QA 1항목 | **수용** | 이것이 없으면 사운드 Off·iOS 무음·난청에서 모드 E는 학습 가치가 0이다. 반대로 "소리 없으면 못 배우는 게 당연하다"고 판단한다면 D11을 빼고 학습 페이지에 안내 문구로 대체할 수는 있다 — **접근성 원칙과 코드량의 교환** |
| **Q6** | 리듬 모드가 **음색 설정을 따르지 않는 것**(항상 triangle) 수용 | **수용 + 안내 1줄** | 피아노 잔향(audio.js:81)과 감쇠 곡선(:80)이 길이 대비를 원리적으로 무너뜨린다. `pianoVoice(tail)` 인자로는 절반만 해결된다. 설정 UI 신뢰 vs 학습 정확성의 교환 |
| **Q7** | 기존 결함 4건(T-20)의 처리 | **별도 릴리스로 날짜 확정** | 전부 확인된 결함이지만 리듬과 무관해 회귀 범위를 섞으면 v1.1 QA가 흐려진다. 다만 "백로그"에 두면 영구 미결이 되기 쉽다 |
| **Q8** | `docs/00 §5-7` "빔"의 한국 교육과정 표준 용어 | **실물 교과서 확인 필요** | 교재에 따라 '빔' / '묶음줄' / 무명. 학습 페이지 details 문구에 직접 영향. 확인 전까지 **"빔(묶음줄)" 병기** |
| **Q9** | '깃발' → '**꼬리**' 용어 통일 | **통일** | 한국 교육과정 용어는 '꼬리'(flag). `mascot.js:3` 주석도 함께 수정하면 1줄 |
| **Q10** | 리듬 자극의 스크린리더 label 정책 | **비누설 일반 label**(`symbolImageLabel`) + 듣기 버튼을 1급 경로로 | 형태 서술("꼬리 1개가 달린 음표")은 기호 이름과 1:1이라 실질 누설이고 ko/en 20문자열 부채를 만든다. 다만 이 선택은 **SR 사용자가 `beats2glyph`·`pair`를 이름 매칭으로 푸는 한계**를 남긴다 |

---

## 부록: 핵심 파일 절대경로

```
D:\work\sing\src\staff.js      D:\work\sing\src\audio.js    D:\work\sing\src\modes.js
D:\work\sing\src\ui.js         D:\work\sing\src\learn.js    D:\work\sing\src\game.js
D:\work\sing\src\i18n.js       D:\work\sing\src\main.js     D:\work\sing\src\storage.js
D:\work\sing\src\mascot.js     D:\work\sing\sw.js           D:\work\sing\styles.css
D:\work\sing\index.html        D:\work\sing\manifest.webmanifest
D:\work\sing\data\rhythm.js    ← 신규 (유일)
D:\work\sing\data\clefs.js     D:\work\sing\data\notes.js
D:\work\sing\docs\00-music-theory-reference.md   ← T-0 §5 신설 (본 문서 §5가 초안)
D:\work\sing\docs\01-analysis.md (:45)  D:\work\sing\docs\03-plan.md (:347)
D:\work\sing\docs\05-character-direction.md (:227)
```

## 부록: 본 검증에서 새로 확인한 사실 (실행·실판독)

| 사실 | 방법 | 영향 |
|---|---|---|
| easy fillBar = 4/4:32 / 3/4:17 / 2/4:5 = **54** | 열거 실행 | 원안값 재현 ✓ |
| normal fillBar = 4/4:**614** / 3/4:**315** / 2/4:**84** = **1013** | 열거 실행 | 원안 2399 [확인] 철회 |
| 열거 비용 = normal 4/4 **3,084 노드 / 0.077ms** | 실측 (100회 평균) | R8 등급 붕괴 → 캐시 선택 |
| `(9/24)^21 = 1.13e-9` (추첨 21회) | 실행 | **원안 수치가 맞음** — 코드 렌즈 지적 기각 |
| y=64 ⇒ dv=34 ⇒ **B4**(treble) / dv=22 ⇒ **D3**(bass) | staff.js:21 + clefs.js:14,29 + notes.js:10 | D12 근거 |
| sw.js는 **네트워크 우선**(:45) + 모든 GET 런타임 put(:48) | 실판독 | R1 등급·QA 기준 정정 |
| ASSETS 현재 **21개** → +1 = **22개** | 실판독 (sw.js:5-25) | 원안 수치 ✓ |
| `t()` 본문은 **i18n.js:204** | 실판독 | 인용 정정 |
| `.mode-grid`는 **styles.css:214**, 1열 전환은 **:1017**(≤360px) | 실판독 | R16 근거 |
| `.review-item{width:150px}`는 **styles.css:561** | 실판독 | V19 근거 |
| 기존 학습 페이지 4개가 전부 `.learn-sec` **1개** (learn.js:109/222/287/371) | 실판독 | V29 근거 |
| `mascot.js:3` 주석이 '**깃발**' / :60에 flag 베지어 존재 | 실판독 | Q9 · V45 근거 |
| `index.html:2` `lang="ko"` 고정 / `:7`·manifest description이 주제 하드코딩 | 실판독 | V48 · V36 근거 |

---

*본 문서는 01-analysis·02-design·03-plan·04-improvement-plan을 대체하지 않고 **박자(음표 길이·쉼표) 학습 범위만** 다룬다. 5개 영역(코드 확장점 감사 / 음악 이론 사실 / 렌더링 방식 3안 / 메트로놈 기술·제품 / 퀴즈 모드 설계)을 독립 조사한 뒤 단일 설계로 통합하고, 4개 렌즈의 적대적 검증 62건을 판정해 반영했다. 검증 과정에서 원안의 blocker 3건(정답 2개 문항 생성 / 청각 단독 의존 / 정답 누설)과 [확인] 마커가 잘못 붙은 수치 2건이 정정되었고, 리듬과 무관한 기존 결함 4건(§8 T-20)이 추가로 발견되었다. 사용자 요청 중 '메트로놈'은 독립 기능으로 기각하되 학습 페이지의 기준 박 재생 엔진으로 흡수하는 것으로 결론지었다(§4.7). 착수 전 §9 미결 질문 10건의 확인이 필요하다.*
