# karaoke/tools/build_songs.py — 가사 + 실측 싱크 → karaoke/songs.js 생성기
#
#   python karaoke/tools/build_songs.py [--cache DIR]
#
# 하는 일
#   1) karaoke/lyrics-source.md 의 가사를 읽는다 (사용자가 붙여넣는 원본)
#   2) 곡마다 정해 둔 '타이밍 근거'에서 줄별 시작 시각을 가져온다
#        lrclib:<id>       — 공개 싱크 가사 DB. 특정 길이의 음원 기준으로 찍혀 있으므로
#                            반드시 '길이가 같은 영상'과 짝지어야 한다.
#        youtube-cc:<vid>  — 그 영상에 달린 자막(수동) + 자동 자막의 단어 타이밍
#   3) 사용자 가사와 근거 가사는 줄 나눔이 다르다(한 줄을 둘로 쪼개거나 두 줄을 합침).
#      그래서 줄 단위가 아니라 '글자 단위 전역 정렬'로 사용자 각 줄 첫 글자의 시각을 구한다.
#   4) songs.js 를 쓰고, 줄마다 근거와 얼마나 일치했는지 보고한다.
#
# 네트워크(lrclib, YouTube)는 --cache 에 파일이 없을 때만 쓴다. 캐시는 리포에 넣지 않는다
# (자막·가사 원문이므로).

import argparse, io, json, os, re, statistics, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # karaoke/
SRC = os.path.join(ROOT, 'lyrics-source.md')
OUT = os.path.join(ROOT, 'songs.js')

# ── 곡 설정 ───────────────────────────────────────────
# blocks: 블록별 줄 수·종류·라벨. 원본에 빈 줄이 없는 곡도 있어서 여기서 명시한다.
# youtube: 타이밍이 검증된 영상. timing 근거와 같은 음원이어야 한다.
SONGS = [
    dict(
        id='yjh-saranghagi', title='사랑하기 때문에', artist='유재하',
        released='1987', source='1집 『사랑하기 때문에』 (1987)',
        youtube='6O8oM-vPRtY', duration=381,  # 유재하 - Topic (공식 음원)
        timing='lrclib:17372891',  # 381초 음원 전용 싱크 — 간주가 3~4초 긴 마스터까지 반영
        blocks=[(4, 'verse', '1절'), (4, 'verse', '1절'), (4, 'bridge', '전개'), (6, 'chorus', '후렴'),
                (4, 'verse', '2절'), (4, 'bridge', '전개'), (7, 'chorus', '후렴')],
    ),
    dict(
        id='gohw-amyeon', title='암연', artist='고한우',
        released=None, source='원곡 · RIAK 공식 오디오',
        youtube='WhLgoz204Z4', duration=271,  # [Official Audio] 고한우 - 암연(Tearful)
        timing='youtube-cc:WhLgoz204Z4',  # 영상 자체의 수동 자막(2줄씩) + 자동 자막 단어 타이밍
        blocks=[(4, 'verse', '1절'), (4, 'verse', '2절'), (4, 'chorus', '후렴'), (4, 'chorus', '후렴 ②'),
                (4, 'chorus', '후렴'), (4, 'chorus', '후렴 ②'), (1, 'outro', '엔딩')],
    ),
    dict(
        id='ssk-dusaram', title='두 사람', artist='성시경',
        released=None, source='4집 『다시 꿈꾸고 싶다』',
        youtube='GtYO-9I4dUQ', duration=256,  # 이 영상 자막과 대조해 0.4초 이내 일치 확인
        timing='lrclib:18702319',
        blocks=[(4, 'verse', '1절'), (3, 'chorus', '후렴'), (6, 'verse', '2절'), (3, 'bridge', '브릿지'),
                (3, 'chorus', '후렴'), (3, 'outro', '엔딩')],
    ),
    dict(
        id='leejuck-dahaeng', title='다행이다', artist='이적',
        released='2007', source='3집 『나무로 만든 노래』 (2007)',
        youtube='59y92uRqV7g', duration=212,  # Lee Juck - Topic (공식 음원)
        timing='lrclib:15782978',  # 213.8초 스트리밍 음원 기준 싱크
        blocks=[(6, 'verse', '1절'), (3, 'bridge', '전개'), (7, 'chorus', '후렴'), (6, 'verse', '2절'),
                (3, 'bridge', '전개'), (7, 'chorus', '후렴'), (2, 'outro', '엔딩')],
    ),
]

H = lambda s: re.sub(r'[^가-힣]', '', s)


# ── 가사 원본 파싱 ────────────────────────────────────
def parse_lyrics(path):
    """'가사' 줄 이후의 `N) 제목` 섹션을 읽는다. 빈 줄은 무시(블록은 SONGS 설정이 정한다)."""
    txt = io.open(path, encoding='utf-8').read()
    body = re.split(r'^\s*가사\s*$', txt, maxsplit=1, flags=re.M)
    body = body[1] if len(body) == 2 else txt
    out, cur = {}, None
    for raw in body.splitlines():
        line = raw.strip()
        m = re.match(r'^\d+\)\s*(.+)$', line)
        if m:
            cur = m.group(1).strip()
            out[cur] = []
        elif line and cur:
            out[cur].append(re.sub(r'\s*\[\d+\]\s*$', '', line.lstrip('*').strip()))
    return out


# ── 타이밍 근거 수집 ──────────────────────────────────
def fetch_json(url, cache_file):
    if cache_file and os.path.exists(cache_file):
        return json.load(io.open(cache_file, encoding='utf-8'))
    req = urllib.request.Request(url, headers={'User-Agent': 'sing-karaoke/1.0 (personal practice)'})
    data = json.load(urllib.request.urlopen(req, timeout=30))
    if cache_file:
        io.open(cache_file, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False))
    return data


def lrclib_lines(lid, cache):
    d = fetch_json(f'https://lrclib.net/api/get/{lid}', cache and os.path.join(cache, f'lrclib-{lid}.json'))
    out = []
    for l in (d.get('syncedLyrics') or '').splitlines():
        m = re.match(r'\[(\d+):(\d+(?:\.\d+)?)\](.*)', l)
        if m and H(m.group(3)):
            out.append((int(m.group(1)) * 60 + float(m.group(2)), m.group(3).strip()))
    if not out:
        sys.exit(f'lrclib {lid}: 싱크 가사가 없다')
    return out, d.get('duration')


def yt_subs(vid, cache, auto):
    """수동(ko) 또는 자동(ko-orig) 자막 json3. 캐시에 없으면 yt-dlp 로 받는다."""
    name = f'{vid}.ko-orig.json3' if auto else f'{vid}.ko.json3'
    path = cache and os.path.join(cache, name)
    if not (path and os.path.exists(path)):
        import yt_dlp
        opts = {'quiet': True, 'skip_download': True, 'subtitlesformat': 'json3',
                'outtmpl': os.path.join(cache or '.', '%(id)s.%(ext)s'),
                'writeautomaticsub': auto, 'writesubtitles': not auto,
                'subtitleslangs': ['ko-orig' if auto else 'ko']}
        with yt_dlp.YoutubeDL(opts) as y:
            y.download([f'https://www.youtube.com/watch?v={vid}'])
    return json.load(io.open(path, encoding='utf-8'))


def cc_events(d):
    out = []
    for e in d.get('events', []):
        t = ''.join(s.get('utf8', '') for s in e.get('segs') or [])
        t = re.sub(r'\[[^\]]*\]', '', t).replace('\n', ' ').strip()
        if H(t):
            s = e['tStartMs'] / 1000
            out.append((s, s + e.get('dDurationMs', 0) / 1000, t))
    return out


def cc_word_onsets(d):
    out = []
    for e in d.get('events', []):
        for s in e.get('segs') or []:
            if H(s.get('utf8', '')):
                out.append((e.get('tStartMs', 0) + s.get('tOffsetMs', 0)) / 1000)
    return sorted(set(out))


# ── 근거 → 글자별 시각 ────────────────────────────────
def char_times_from_lines(lines, song_end):
    """[(시작, 끝|None, 텍스트)] → 글자열, 글자별 시각, 글자별 근거 줄 번호.
    끝이 없는 줄은 다음 줄 시작까지로 보되, 뒤에 긴 간주가 오면 노래가 그만큼 늘어진 게
    아니므로 곡 평균 음절 속도로 상한을 둔다."""
    rates = []
    for i, (t, e, x) in enumerate(lines):
        nxt = lines[i + 1][0] if i + 1 < len(lines) else None
        n = len(H(x))
        if nxt and n:
            rates.append((nxt - t) / n)
    rate = statistics.median(rates) if rates else 0.6
    chars, times, owner = [], [], []
    for i, (t, e, x) in enumerate(lines):
        h = H(x)
        nxt = lines[i + 1][0] if i + 1 < len(lines) else song_end
        end = e if e else nxt
        end = min(end, nxt, t + len(h) * rate * 1.15)
        for k, ch in enumerate(h):
            chars.append(ch)
            times.append(t + (end - t) * k / max(1, len(h)))
            owner.append(i)
    return chars, times, owner


# ── 글자 단위 전역 정렬 (Needleman–Wunsch) ────────────
def align(a, b, match=3, mismatch=-2, gap=-2):
    """a[i] → b[j] 대응(대각 이동만). 반복 후렴이 있어도 전역·단조라 순서가 꼬이지 않는다."""
    n, m = len(a), len(b)
    S = [[0] * (m + 1) for _ in range(n + 1)]
    P = [[0] * (m + 1) for _ in range(n + 1)]  # 0=대각 1=위(a 건너뜀) 2=왼(b 건너뜀)
    for i in range(1, n + 1):
        S[i][0], P[i][0] = i * gap, 1
    for j in range(1, m + 1):
        S[0][j], P[0][j] = j * gap, 2
    for i in range(1, n + 1):
        ai, Si, Sp, Pi = a[i - 1], S[i], S[i - 1], P[i]
        for j in range(1, m + 1):
            d = Sp[j - 1] + (match if ai == b[j - 1] else mismatch)
            u = Sp[j] + gap
            l = Si[j - 1] + gap
            if d >= u and d >= l:
                Si[j], Pi[j] = d, 0
            elif u >= l:
                Si[j], Pi[j] = u, 1
            else:
                Si[j], Pi[j] = l, 2
    amap = [None] * n
    exact = [False] * n
    i, j = n, m
    while i > 0 and j > 0:
        p = P[i][j]
        if p == 0:
            amap[i - 1] = j - 1
            exact[i - 1] = a[i - 1] == b[j - 1]
            i, j = i - 1, j - 1
        elif p == 1:
            i -= 1
        else:
            j -= 1
    return amap, exact


def snap(t, onsets, window=2.5, min_gap=0.6):
    """자동 자막 단어 시작 중 '앞에 숨 쉰 틈이 큰 것'으로 맞춘다 — 줄이 바뀌는 지점."""
    best, best_score = t, None
    for k, o in enumerate(onsets):
        if abs(o - t) > window or k == 0:
            continue
        g = o - onsets[k - 1]
        if g < min_gap:
            continue
        sc = g - 0.3 * abs(o - t)
        if best_score is None or sc > best_score:
            best, best_score = o, sc
    return best


# ── 곡 하나 처리 ─────────────────────────────────────
def build_song(cfg, user_lines, cache):
    kind, ref = cfg['timing'].split(':', 1)
    onsets = None
    if kind == 'lrclib':
        L, ldur = lrclib_lines(ref, cache)
        if ldur and abs(ldur - cfg['duration']) > 2.5:
            print(f"  ⚠ lrclib 음원 {ldur:.1f}s ↔ 영상 {cfg['duration']}s — 길이가 달라 타이밍이 어긋날 수 있다")
        src = [(t, None, x) for t, x in L]
    else:
        ev = cc_events(yt_subs(ref, cache, auto=False))
        onsets = cc_word_onsets(yt_subs(ref, cache, auto=True))
        # 자막 이벤트는 다음 이벤트 직전까지(뒤 반주 포함) 이어진다. 그 길이로 비례 분할하면
        # 둘째 줄이 늦게 잡히므로, 곡의 표준 이벤트 길이(중앙값)를 노래 구간의 상한으로 둔다.
        # (자동 자막 단어로 끝점을 잡기엔 노래 구간에서 ASR 이 너무 듬성듬성하다)
        typ = statistics.median(e - s for s, e, _ in ev)
        src = [(s, min(e, s + typ), t) for s, e, t in ev]

    chars, times, owner = char_times_from_lines(src, cfg['duration'])
    U, starts = [], []
    for l in user_lines:
        starts.append(len(U))
        U.extend(H(l))
    starts.append(len(U))
    amap, exact = align(U, chars)

    out, report = [], []
    rate = (times[-1] - times[0]) / max(1, len(times))  # 평균 글자 간격
    for li in range(len(user_lines)):
        a, b = starts[li], starts[li + 1]
        k = next((k for k in range(a, b) if amap[k] is not None), None)
        conf = sum(exact[a:b]) / max(1, b - a)
        if k is None:
            out.append(None)
            report.append((li, None, conf, None, False))
            continue
        j = amap[k]
        t = times[j] - (k - a) * rate
        mid = j > 0 and owner[j - 1] == owner[j]  # 근거 줄 중간에서 시작 = 사용자가 쪼갠 줄
        snapped = False
        if mid and onsets:
            t2 = snap(t, onsets)
            snapped, t = t2 != t, t2
        out.append(t)
        report.append((li, t, conf, owner[j], mid))

    # 근거에 없는 줄은 앞뒤 사이를 음절 비율로 메운다
    for i, t in enumerate(out):
        if t is None:
            prev = next((out[p] for p in range(i - 1, -1, -1) if out[p] is not None), 0.0)
            nxt = next((out[q] for q in range(i + 1, len(out)) if out[q] is not None), cfg['duration'])
            out[i] = prev + (nxt - prev) * 0.5
    for i in range(1, len(out)):  # 단조 증가 보장
        if out[i] <= out[i - 1]:
            out[i] = out[i - 1] + 0.3
    return [round(t, 2) for t in out], report, len(src)


# ── songs.js 쓰기 ─────────────────────────────────────
def js(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def write_js(entries):
    chunks = []
    for cfg, lines, timing in entries:
        blocks, i = [], 0
        for n, kind, label in cfg['blocks']:
            ls = ',\n          '.join(js(l) for l in lines[i:i + n])
            blocks.append(f"      {{ kind: '{kind}', label: '{label}', lines: [\n          {ls},\n        ] }}")
            i += n
        first, last = timing[0], timing[-1]
        chunks.append(
            '  {\n'
            f"    id: '{cfg['id']}',\n"
            f"    title: {js(cfg['title'])},\n"
            f"    artist: {js(cfg['artist'])},\n"
            f"    released: {js(cfg['released']) if cfg['released'] else 'null'},\n"
            f"    source: {js(cfg['source'])},\n"
            f"    duration: {cfg['duration']},\n"
            f"    intro: {int(first)},\n"
            f"    outro: {max(4, int(cfg['duration'] - last - 6))},\n"
            f"    youtubeId: '{cfg['youtube']}',\n"
            f"    searchQuery: {js(cfg['artist'] + ' ' + cfg['title'])},\n"
            '    sequence: null,\n'
            '    // 실측 싱크: 줄마다 시작 시각(초). youtubeId 영상 기준이다.\n'
            f"    timing: {{ source: '{cfg['timing']}', videoId: '{cfg['youtube']}', duration: {cfg['duration']},\n"
            f"      lines: [{', '.join(f'{t:g}' for t in timing)}] }},\n"
            '    blocks: [\n' + ',\n'.join(blocks) + ',\n    ],\n'
            '  }'
        )
    head = (
        '// karaoke/songs.js — 가사 + 곡 메타 + 실측 싱크 (단일 데이터 출처)\n'
        '//\n'
        '// ⚠ 생성 파일이다. 가사는 karaoke/lyrics-source.md 를 고치고\n'
        '//   python karaoke/tools/build_songs.py 를 다시 돌린다.\n'
        '//\n'
        '// timing   : 줄별 시작 시각(초). youtubeId 영상과 짝이다 — 다른 영상이면 오프셋으로 맞춘다.\n'
        '//            lrclib:<id>      공개 싱크 가사(같은 길이의 음원 기준)\n'
        '//            youtube-cc:<vid> 그 영상의 자막 + 자동 자막 단어 타이밍\n'
        '// kind     : verse | chorus | bridge | outro\n'
        '// sequence : 부르는 순서(블록 인덱스). null = 적힌 순서대로.\n\n'
        'export const SONGS = [\n'
    )
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(head + ',\n'.join(chunks) + ',\n];\n')


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', help='lrclib/자막 캐시 폴더 (리포 밖)')
    args = ap.parse_args()
    if args.cache:
        os.makedirs(args.cache, exist_ok=True)

    lyrics = parse_lyrics(SRC)
    entries = []
    for cfg in SONGS:
        lines = lyrics.get(cfg['title'])
        if not lines:
            sys.exit(f"가사 원본에 「{cfg['title']}」 이 없다 (있는 곡: {list(lyrics)})")
        need = sum(n for n, _, _ in cfg['blocks'])
        if need != len(lines):
            sys.exit(f"「{cfg['title']}」 블록 설정 {need}줄 ≠ 가사 {len(lines)}줄")
        print(f"\n== {cfg['title']} / {cfg['artist']}  ({len(lines)}줄, 근거 {cfg['timing']}, 영상 {cfg['youtube']})")
        timing, report, nsrc = build_song(cfg, lines, args.cache)
        low = 0
        for li, t, conf, own, mid in report:
            flag = '쪼갠줄' if mid else ''
            warn = ' ⚠낮음' if conf < 0.6 else ''
            low += conf < 0.6
            print(f"   {li + 1:2d}  {timing[li]:7.2f}s  일치 {conf:4.0%}  근거줄 {('-' if own is None else own + 1):>3}  {flag}{warn}")
        print(f"   → 첫 줄 {timing[0]:.2f}s / 끝 줄 {timing[-1]:.2f}s / 곡 {cfg['duration']}s / 낮은 일치 {low}줄")
        if timing[-1] >= cfg['duration']:
            sys.exit('  ✗ 마지막 줄이 곡 길이를 넘는다 — 영상·근거 짝을 확인하라')
        entries.append((cfg, lines, timing))
    write_js(entries)
    print(f'\n생성: {OUT}')


if __name__ == '__main__':
    main()
