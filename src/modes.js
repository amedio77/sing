// src/modes.js — 5개 학습 모드 = 평범한 배열. 레지스트리·전략 패턴 없음.
// 모드 규약: { id, name(key), generate() → question }
// question: { key:str, prompt():str, render(el), choices:[key], answer:key,
//             labelFor(key):str, playAudio(revealed), hint:str, kind, review }
//   labelFor(key)  ⚠️ 반드시 String — ui.js가 템플릿 리터럴·문자열 연결에 그대로 넣는다
//   playAudio(revealed) 답변 전(false)/후(true). 인자를 무시하는 기존 모드는 무영향
// 선택 필드: labelNode?(key):Element  보기 버튼 내용을 그림으로 (없으면 labelFor 텍스트)
//            audioMs?:number          재생 길이. 오답 자동진행 대기의 하한이 된다
//            review.svg?():Element    결과 화면 오답 복기용 그림 (+ review.cap / review.wide)
// key = 문제 정체성(그 모드가 평가하는 학습 항목이 같으면 같은 key).
//       createQuiz(game.js)가 세션 내 무중복 판정에 사용. 누락 시 해당 문항만 dedup 제외.
// ⚠️ kind 를 'staff'로 재사용하지 말 것 — ui.js 결과 화면이 review.clef를 createStaffSVG에 넘겨
//    TypeError를 던지고, 그 throw가 replaceChildren 이전이라 화면이 이전 문항에 멈춘다.

import { CLEFS } from '../data/clefs.js';
import { makeNote, LETTERS, SOLFEGE } from '../data/notes.js';
import { SHARP_ORDER, FLAT_ORDER } from '../data/keys.js';
import { makeChord } from '../data/chords.js';
import { symbolPool, VISUAL_PAIR, beatsLabel, UNITS_PER_BEAT, HINT_KO, HINT_EN } from '../data/rhythm.js';
import { createStaffSVG, createChordSVG, createKeySigSVG, createSymbolSVG, beatPips, syncPlayback } from './staff.js';
import { playNote, playChord, rhythmCue, cueMs, stopAll, audioClock } from './audio.js';
import { getState } from './game.js';
import { t, letterLabel, noteLabel } from './i18n.js';

// ── 유틸 ──────────────────────────────────────────────
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const SIGN_CHAR = { '#': '♯', b: '♭' };
function ordinalEn(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// diatonic 값 → makeNote (덧줄 음 포함 풀 생성용)
function noteFromDv(dv) {
  return makeNote(LETTERS[((dv % 7) + 7) % 7], Math.floor(dv / 7));
}
// 음자리표 음 풀: 쉬움=오선 안(dvRef..+8), 보통=덧줄 포함(dvRef−3..+10)
function notePool(clef, difficulty) {
  const lo = difficulty === 'easy' ? clef.dvRef : clef.dvRef - 3;
  const hi = clef.dvRef + (difficulty === 'easy' ? 8 : 10);
  const pool = [];
  for (let dv = lo; dv <= hi; dv++) pool.push(noteFromDv(dv));
  return pool;
}

// ── 모드 A: 음자리표 음 위치 ──────────────────────────
const clefPosition = {
  id: 'clef-position',
  name: 'clefPosition',
  generate() {
    const st = getState();
    // 음자리표는 홈에서 선택한 state.clef를 따른다 (난이도와 분리)
    const clef = st.clef === 'both' ? pick([CLEFS.treble, CLEFS.bass]) : st.clef === 'bass' ? CLEFS.bass : CLEFS.treble;
    const note = pick(notePool(clef, st.difficulty)); // 덧줄 포함 확장 풀
    const distract = shuffle(LETTERS.filter((l) => l !== note.english)).slice(0, 3);
    const choices = shuffle([note.english, ...distract]);
    return {
      kind: 'staff',
      key: `${clef.id}:${note.english}${note.octave}`, // 위치 읽기가 학습 항목 → 옥타브 포함
      prompt: () => `${getState().lang === 'ko' ? clef.nameKo : clef.nameEn} · ${t('askNoteName')}`,
      render: (c) => c.appendChild(createStaffSVG(clef, note)),
      choices,
      answer: note.english,
      labelFor: (k) => letterLabel(k),
      playAudio: () => playNote(note.letter + note.octave), // 문자열 피치 필수 — 숫자는 Hz로 해석됨(audio.js noteToFreq)
      hint: `${clef.mnemonicLinesKo} (${clef.mnemonicLinesEn}) · ${clef.mnemonicSpacesKo} (${clef.mnemonicSpacesEn})`,
      review: { clef, note },
    };
  },
};

// ── 모드 B: 계이름 ↔ 영어 매칭 ────────────────────────
const noteMatching = {
  id: 'note-matching',
  name: 'noteMatching',
  generate() {
    const letter = pick(LETTERS);
    const oct = pick([4, 5]); // 오선 위치 다양화
    const dir = pick(['ko2en', 'en2ko']); // 쉬움도 양방향 — 실질 풀 7→14로 세션 내 무중복 성립 (labelFor가 양방향 지원)
    const targetIsEn = dir === 'ko2en';
    const srcLabel = targetIsEn ? SOLFEGE[letter] : letter; // 병기할 출처 라벨
    const note = makeNote(letter, oct); // 오선 표시용 (자연음, 옥타브 랜덤)
    const distract = shuffle(LETTERS.filter((l) => l !== letter)).slice(0, 3);
    const choices = shuffle([letter, ...distract]);
    return {
      kind: 'match',
      key: `${dir}:${letter}`, // 글자 매칭이 학습 항목 → 옥타브(표시용 변화)는 제외
      prompt: () => t('askMatchTo'),
      render: (c) => {
        const wrap = document.createElement('div');
        wrap.className = 'match-staff';
        wrap.appendChild(createStaffSVG(CLEFS.treble, note)); // 높은음자리표에 음 표시
        const sub = document.createElement('div');
        sub.className = 'match-sub';
        sub.textContent = srcLabel; // 출처 체계 라벨 병기
        wrap.appendChild(sub);
        c.appendChild(wrap);
      },
      choices,
      answer: letter,
      labelFor: (k) => (targetIsEn ? k : SOLFEGE[k]), // 목표 체계 라벨(매칭 학습)
      playAudio: () => playNote(letter + oct),
      hint: '도=C 레=D 미=E 파=F 솔=G 라=A 시=B',
      review: { srcLabel, answerLabel: targetIsEn ? letter : SOLFEGE[letter] },
    };
  },
};

// ── 모드 C: 조표 붙는 순서 ────────────────────────────
const keyOrder = {
  id: 'key-order',
  name: 'keyOrder',
  generate() {
    const st = getState();
    const useSharp = Math.random() < 0.5; // 쉬움/보통 모두 샤프·플랫 혼합
    const order = useSharp ? SHARP_ORDER : FLAT_ORDER;
    const sign = useSharp ? '#' : 'b';
    const signCh = SIGN_CHAR[sign];
    const type = st.difficulty === 'easy' ? 'next' : pick(['next', 'nth']);

    const idx = type === 'next' ? rnd(order.length) : rnd(order.length);
    const answerLetter = order[idx];
    const answer = answerLetter + sign;
    const distractLetters = shuffle(order.filter((l) => l !== answerLetter)).slice(0, 3);
    const choices = shuffle([answer, ...distractLetters.map((l) => l + sign)]);
    const shown = order.slice(0, idx); // 'next'에서 이미 놓인 조표들

    return {
      kind: 'chips',
      key: `${sign}:${idx}`, // next/nth는 같은 사실(order[idx])의 문구 변형 → type 제외로 세션당 1회
      prompt: () => {
        const lang = getState().lang;
        if (type === 'nth') {
          const word = useSharp ? t('sharp') : t('flat');
          return lang === 'ko' ? `${word} ${idx + 1}번째는?` : `${ordinalEn(idx + 1)} ${useSharp ? 'sharp' : 'flat'}?`;
        }
        const word = useSharp ? t('sharp') : t('flat');
        return lang === 'ko'
          ? `${idx === 0 ? '처음' : '다음에'} 붙는 ${word}는?`
          : `Which ${useSharp ? 'sharp' : 'flat'} comes ${idx === 0 ? 'first' : 'next'}?`;
      },
      render: (c) => {
        if (type === 'next') {
          // 지금까지 붙은 조표를 실제 조표 위치로 오선에 표시(+다음 자리 '?')
          c.appendChild(createKeySigSVG(sign, idx, CLEFS.treble, { showNext: true }));
        } else {
          const badge = document.createElement('div');
          badge.className = 'sign-badge';
          badge.textContent = signCh;
          c.appendChild(badge);
        }
      },
      choices,
      answer,
      labelFor: (k) => letterLabel(k),
      playAudio: () => playNote(answerLetter + sign + '4'),
      hint: '샤프: 파도솔레라미시 (F C G D A E B) / 플랫은 역순: 시미라레솔도파 (B E A D G C F)',
      review: { answerLabel: letterLabel(answer) },
    };
  },
};

// ── 모드 D: 피아노 코드 (화음) ─────────────────────────
const TRIADS = ['maj', 'min', 'aug', 'dim'];
const SEVENTHS = ['dom7', 'maj7', 'min7'];

// 겹임시표(Baug 등) 제외하고 유효 코드 하나 뽑기
function pickChord(qualities) {
  let c;
  let guard = 0;
  do {
    c = makeChord(pick(LETTERS), pick(qualities));
  } while (c.hasDoubleAccidental && guard++ < 40);
  return c;
}

const chord = {
  id: 'chord',
  name: 'chord',
  generate() {
    const st = getState();
    const qualities = st.difficulty === 'easy' ? TRIADS : [...TRIADS, ...SEVENTHS];
    const target = pickChord(qualities);
    const dir = pick(['notes2name', 'name2notes']); // 둘 다(방향 랜덤)

    // 오답 코드 3개 (겹임시표 제외, id 중복 없음)
    const seen = new Set([target.id]);
    const distractors = [];
    let g = 0;
    while (distractors.length < 3 && g++ < 100) {
      const c = pickChord(qualities);
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      distractors.push(c);
    }
    const options = shuffle([target, ...distractors]);
    const byId = Object.fromEntries(options.map((c) => [c.id, c]));
    const notesLabel = (c) => c.tones.map((tn) => noteLabel(tn)).join(' · ');
    const choices = options.map((c) => c.id);

    return {
      kind: 'chord',
      key: `${dir}:${target.id}`,
      prompt: () => (dir === 'notes2name' ? t('askChordName') : t('askChordNotes')),
      render: (el) => {
        if (dir === 'notes2name') {
          el.appendChild(createChordSVG(target.tones, CLEFS.treble)); // 화음을 오선에 쌓아 표시
        } else {
          const card = document.createElement('div');
          card.className = 'chord-card name';
          card.textContent = target.symbol; // 코드 심볼
          el.appendChild(card);
        }
      },
      choices,
      answer: target.id,
      labelFor: (id) => (dir === 'notes2name' ? byId[id].symbol : notesLabel(byId[id])),
      playAudio: () => playChord(target.tones.map((tn) => tn.pitch)),
      hint:
        st.lang === 'ko' ? `${target.symbol} (${target.ko}) = ${target.hint}` : `${target.symbol} (${target.nameEn}) = ${target.hintEn}`,
      review: { kind: 'chord', symbol: target.symbol, notes: notesLabel(target) },
    };
  },
};

// ── 모드 E: 음표와 쉼표 (길이) ─────────────────────────
// 삼중 일치의 박자 버전 = 「모양 = 이름 = 지속시간」.
// 음높이는 학습 변수가 아니므로 상수(오선 3번째 줄)로 고정하고, 변하는 것은 '울리는 시간'이다.
const RHY_TYPES = ['glyph2beats', 'beats2glyph', 'pair'];
const symName = (s) => (getState().lang === 'ko' ? s.ko : s.en);
const unitsKey = (u) => 'u' + u;

// units 거리가 가까운 순 n개. 인접 오답은 흔한 오개념을 자동으로 포착한다
// (점 무시 / 머리 채움 혼동 / 꼬리 개수 혼동). n+1 후보 중 셔플해 결정성을 완화한다.
function nearest(cands, targetUnits, n) {
  const sorted = cands.slice().sort((a, b) => Math.abs(a.units - targetUnits) - Math.abs(b.units - targetUnits));
  return shuffle(sorted.slice(0, n + 1)).slice(0, n);
}

// 온쉼표(4박)↔2분쉼표(2박)는 사각형이 줄 위냐 아래냐만 다른 최악의 혼동쌍인데
// normal에서는 사이에 3박이 끼어 인접에서 밀린다 → 강제 선삽입 (distractor 규칙의 유일한 예외)
function forceVisualPair(target, distract, cands) {
  const id = VISUAL_PAIR[target.id];
  if (!id || distract.some((s) => s.id === id)) return distract;
  const forced = cands.find((s) => s.id === id);
  return forced ? [forced, ...distract.slice(0, -1)] : distract;
}

// 자극·보기 공통: 오선 위 기호 하나
const symSVG = (sym, opts) => createSymbolSVG(sym, CLEFS.treble, opts);

const noteValue = {
  id: 'note-value',
  name: 'noteValue',
  generate() {
    const st = getState();
    const pool = symbolPool(st.difficulty); // easy 8 / normal 13
    const type = pick(RHY_TYPES);

    // 유형별로 (자극 노드, 보기, 정답, 라벨)만 다르고 재생·복기 구조는 공유한다
    let cueSym; // 소리로 들려줄 기호
    let ansSym; // 정답 기호 (복기용)
    let makeStimulus; // () => Element
    let choices;
    let answer;
    let labelFor;
    let labelNode = null;
    let promptText;
    let cap;

    if (type === 'glyph2beats') {
      const target = pick(pool);
      cueSym = ansSym = target;
      // 보기는 '박 값' — 같은 값이 두 버튼에 나오지 않도록 units 집합에서 중복 제거 후 인접 추출
      const others = [...new Set(pool.map((s) => s.units))]
        .filter((u) => u !== target.units)
        .map((u) => ({ units: u }));
      answer = unitsKey(target.units);
      choices = shuffle([answer, ...nearest(others, target.units, 3).map((o) => unitsKey(o.units))]);
      labelFor = (k) => beatsLabel(+k.slice(1) / UNITS_PER_BEAT, getState().lang);
      promptText = t('askBeats');
      makeStimulus = () => symSVG(target, { label: t('symbolImageLabel') });
      cap = `${symName(target)} = ${beatsLabel(target.beats, st.lang)}`;
    } else if (type === 'beats2glyph') {
      // ⚠️ 계열 한정 필수 — 음표와 쉼표는 같은 박 값을 1:1로 공유하므로(♩ 1박 = 𝄽 1박)
      //    계열을 섞으면 "1박짜리는?"에 정답이 2개가 된다. 엔진은 단일 정답만 인정한다.
      const wantRest = Math.random() < 0.5;
      const series = pool.filter((s) => s.rest === wantRest);
      const target = pick(series);
      cueSym = ansSym = target;
      const cands = series.filter((s) => s.units !== target.units); // 동일 길이 배제(정답 2개 방지)
      const distract = forceVisualPair(target, nearest(cands, target.units, 3), cands);
      const byId = Object.fromEntries([target, ...distract].map((s) => [s.id, s]));
      answer = target.id;
      choices = shuffle(Object.keys(byId));
      labelFor = (k) => symName(byId[k]);
      labelNode = (k) => symSVG(byId[k], { compact: true });
      promptText = t(wantRest ? 'askBeatsRest' : 'askBeatsNote').replace('{n}', beatsLabel(target.beats, st.lang));
      makeStimulus = () => {
        const card = document.createElement('div');
        card.className = 'beats-card';
        card.textContent = beatsLabel(target.beats, st.lang);
        return card;
      };
      cap = `${beatsLabel(target.beats, st.lang)} = ${symName(target)}`;
    } else {
      // pair — 음표↔쉼표 짝. 점음표는 대응 쉼표가 범위 밖이라 제외.
      const plain = pool.filter((s) => !s.dotted);
      const src = pick(plain);
      const series = plain.filter((s) => s.rest !== src.rest);
      const target = series.find((s) => s.units === src.units);
      cueSym = src; // 자극(보이는 것)을 들려준다 — 정답 누설이 아니라 자극의 소리 축
      ansSym = target;
      const cands = series.filter((s) => s.units !== target.units);
      const distract = forceVisualPair(target, nearest(cands, target.units, 3), cands);
      const byId = Object.fromEntries([target, ...distract].map((s) => [s.id, s]));
      answer = target.id;
      choices = shuffle(Object.keys(byId));
      labelFor = (k) => symName(byId[k]);
      labelNode = (k) => symSVG(byId[k], { compact: true });
      promptText = t(src.rest ? 'askPairNote' : 'askPairRest');
      makeStimulus = () => symSVG(src, { label: t('symbolImageLabel') });
      cap = `${symName(src)} = ${symName(target)}`;
    }

    const nBeats = Math.max(1, Math.ceil(cueSym.beats));
    let root = null; // render가 만든 컨테이너 — playAudio가 시각 동기화에 사용
    let counter = null;
    let stopSync = () => {};

    return {
      kind: 'rhythm', // ⚠️ 'staff' 재사용 금지 (결과 화면이 review.clef를 요구한다)
      key: `${type}:${ansSym.id}`, // 평가 방향 + 평가 대상 기호
      prompt: () => promptText,
      render: (c) => {
        const box = document.createElement('div');
        box.className = 'rhythm-box';
        box.appendChild(makeStimulus());
        box.appendChild(beatPips(nBeats)); // 소리 없이도 박이 흐르는 시각 채널
        counter = document.createElement('div');
        counter.className = 'beat-counter';
        counter.textContent = `0 / ${nBeats}`;
        box.appendChild(counter);
        root = box;
        c.appendChild(box);
      },
      choices,
      answer,
      labelFor,
      labelNode,
      // 모드 E는 자극이 이미 보이거나 프롬프트에 적혀 있으므로 재생이 정답을 더 누설하지 않는다.
      // 오히려 이 소리가 시각 비의존 1급 경로다 → revealed 를 보지 않는다.
      playAudio: () => {
        stopAll(); // 연타 시 예약 시퀀스 중첩 차단
        stopSync();
        const cue = rhythmCue(cueSym);
        stopSync = syncPlayback(root, { ...cue, clock: audioClock, counterEl: counter });
      },
      audioMs: cueMs(cueSym),
      hint: st.lang === 'ko' ? HINT_KO : HINT_EN,
      // 복기는 좁은 카드(150px) 안이라 크롭 뷰박스로 — 오선 3·4번 줄은 남으므로 쉼표 위치 변별 유지
      review: { svg: () => symSVG(ansSym, { compact: true, highlight: true, label: t('symbolImageLabel') }), cap },
    };
  },
};

export const MODES = [clefPosition, noteMatching, keyOrder, chord, noteValue];
