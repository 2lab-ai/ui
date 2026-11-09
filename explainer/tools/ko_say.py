"""Korean spoken form for the TTS: digits, symbols and Latin letters never reach the voice model raw.

    say = to_say(text, lexicon)     # '2.71원' -> '이 쩜 칠 일 원', '1748년' -> '천칠백사십팔 년'
    check_say(say)                  # raises ValueError if anything but Hangul and punctuation is left

Rules (standard Korean reading, see explainer/README.md "Numbers and letters"):
- Sino-Korean numbers by default: 1748 -> 천칠백사십팔, 10000 -> 만, 0 -> 영. A leading 1 before 십/백/천/만 is dropped.
  A number written with leading zeros is a code and is read digit by digit: 007 -> 영영칠.
- Native numbers (한 두 세 네 … 아흔아홉) before counters that take them (개, 명, 번, 살, 시간, 달, 바퀴, 배 …), written
  right after the digits: 2번 -> 두 번, 101개 -> 백한 개, 1번째 -> 첫 번째. Ambiguous counters (대, 장) read Sino.
- Decimals: 쩜 (how the point is said) and the fraction digit by digit, each its own word: 2.71 -> 이 쩜 칠 일,
  3.14159 -> 삼 쩜 일 사 일 오 구. Spelled "이 점 칠일" the voice model read 이 점 as "this point" / 이점 (advantage) and
  칠일 as "the 7th" (whisper heard "2.7일원", "이점 칠일팔"); joined "이쩜칠일" sometimes dropped a digit.
- Fractions a/b -> b분의 a; a leading - -> 마이너스; 3-1 -> 삼 빼기 일; % -> 퍼센트.
  Ranges (1~2개: 한두 개? 일에서 이 개?), = : ^ and anything else not listed are errors: write the sentence's "say".
- Latin letters and words come from the project lexicon (project.json "say_lexicon", e.g. {"e": "이", "i": "아이",
  "Euler": "오일러"}); a letter or word missing from it is an error, never guessed.
A sentence's own "say" in script.json still wins; it is checked the same way.
"""
import re

DIGITS = '영일이삼사오육칠팔구'
UNITS = ['', '십', '백', '천']
BIG = ['', '만', '억', '조']
NATIVE_ONES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉']
NATIVE_ONES_FULL = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉']
NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔']
# counters that take native numbers (한 개, 두 번, 세 바퀴, 스무 살), longest first so 시간 wins over 시. Ambiguous
# ones (대: 한 대 / 이십 대, 장: 두 장 / 제일 장) are left out: they read Sino; write "say" when you mean the other.
NATIVE_COUNTERS = sorted(['개', '명', '번', '살', '시간', '시', '달', '바퀴', '배', '마리', '권', '잔', '가지', '사람',
                          '줄', '칸', '걸음', '군데', '척', '자루', '그루', '송이', '켤레', '벌', '채'],
                         key=len, reverse=True)
# Sino counters that read better spaced. 도 (degrees, or the particle 'also') and 분의 stay attached on purpose.
SINO_COUNTERS = ['년', '월', '일', '초', '분', '원', '세기', '위', '퍼센트', '층', '회', '등', '킬로', '미터', '그램',
                 '개월', '개국', '개년', '달러', '번지', '번째']
SPACED_COUNTERS = sorted(set(NATIVE_COUNTERS + SINO_COUNTERS) - {'분'}, key=len, reverse=True)
# a counter counts only when its word ends there or a particle follows (2번 곱하면, 3바퀴를, 2배로; not 5달러 -> 달)
PARTICLE = re.compile(r'$|[^가-힣]|(?:을|를|이|가|은|는|에|의|와|과|도|만|로|으로|까지|부터|이나|나|처럼|보다|씩|마다|'
                      r'쯤|뿐|밖에|이면|면|이고|이에요|예요|이죠|죠|입니다|이다|였|이었|째)')
POINT = '쩜'
SYMBOLS = {'%': ' 퍼센트', '+': ' 더하기 ', '×': ' 곱하기 ', '÷': ' 나누기 ', 'π': '파이', '≈': ' 약 '}
ALLOWED = re.compile(r"[가-힣\s.,?!…'\"‘’“”·;()]")


def sino(n):
    """non-negative int -> Sino-Korean (천칠백사십팔, 만, 영)."""
    if n == 0: return '영'
    if n >= 10 ** 16: raise ValueError(f'{n} is too large to read out; write it in words')
    out, g = [], 0
    while n:
        n, chunk = divmod(n, 10000)
        if chunk:
            s = ''
            for p in range(3, -1, -1):
                d = chunk // 10 ** p % 10
                if d: s += ('' if d == 1 and p else DIGITS[d]) + UNITS[p]
            if g == 1 and s == '일': s = ''        # 10000 -> 만, not 일만
            out.append(s + BIG[g])
        g += 1
    return ''.join(reversed(out))


def native(n, before_counter=True):
    """1..99 -> native Korean (한, 스무, 서른두). Before a counter 1-4 and 20 shorten (한/두/세/네/스무)."""
    if not 1 <= n <= 99: raise ValueError(f'native numbers only go to 99, got {n}')
    tens, ones = divmod(n, 10)
    if before_counter and n == 20: return '스무'
    return NATIVE_TENS[tens] + (NATIVE_ONES if before_counter else NATIVE_ONES_FULL)[ones]


def decimal(intpart, frac):
    """2.71 -> 이 쩜 칠 일: 쩜 and every fraction digit as its own word (A/B on cwon, README "Numbers and letters")."""
    return f'{sino(int(intpart))} {POINT} ' + ' '.join(DIGITS[int(c)] for c in frac)


NUM = re.compile(r'(?<![A-Za-z0-9_.])(-)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?:/(\d+))?')


def counter_after(rest, counters):
    """the counter written right after the digits (no space), when its word ends there or a particle follows."""
    return next((c for c in counters if rest.startswith(c) and PARTICLE.match(rest[len(c):])), None)


def _number(m, rest):
    neg, whole, frac, den = m.group(1), m.group(2).replace(',', ''), m.group(3), m.group(4)
    if den is not None:                      # 1/2 -> 이분의 일
        if frac: raise ValueError(f'decimal fraction {m.group(0)!r}: write it out')
        s = f'{sino(int(den))}분의 {sino(int(whole))}'
    elif frac is not None:
        s = decimal(whole, frac)
    elif len(whole) > 1 and whole[0] == '0':  # 007 -> 영영칠: a code, not a quantity
        s = ''.join(DIGITS[int(c)] for c in whole)
    else:
        n = int(whole)
        if rest.startswith('번째') and 1 <= n <= 99:
            s = '첫' if n == 1 else native(n)          # 첫 번째, 두 번째, 열한 번째
        elif n >= 1 and counter_after(rest, NATIVE_COUNTERS):
            # 101개 -> 백한 개: hundreds and up stay Sino, the last two digits go native
            s = native(n) if n <= 99 else sino(n - n % 100) + (native(n % 100) if n % 100 else '')
        else:
            s = sino(n)
    if neg: s = '마이너스 ' + s
    # a counter right after the digits gets a space (1748년 -> 천칠백사십팔 년, 1500년대 -> 천오백 년대, 100퍼센트라고
    # -> 백 퍼센트라고); particles and 분의 stay attached (1에서 -> 일에서, 2분의 1 -> 이분의 일). Spacing never changes
    # the reading, so unlike the native/Sino choice above it does not need the counter's word to end.
    if any(rest.startswith(c) for c in SPACED_COUNTERS):
        s += ' '
    return s


def to_say(text, lexicon=None):
    """text as written in script.json -> what the voice model reads."""
    lexicon = lexicon or {}
    s = text
    # Latin words/letters, longest lexicon entry first; a match must not touch other Latin letters
    for k in sorted(lexicon, key=len, reverse=True):
        s = re.sub(rf'(?<![A-Za-z]){re.escape(k)}(?![A-Za-z])', lexicon[k], s)
    s = re.sub(r'(?<=\d) ?- ?(?=\d)', ' 빼기 ', s)      # 3-1 -> 3 빼기 1 (a leading -1 stays 마이너스)
    out, i = [], 0
    for m in NUM.finditer(s):
        out.append(s[i:m.start()])
        out.append(_number(m, s[m.end():]))
        i = m.end()
    out.append(s[i:])
    s = ''.join(out)
    for k, v in SYMBOLS.items(): s = s.replace(k, v)
    s = re.sub(r'(?<=[가-힣]) {2,}', ' ', s)
    return re.sub(r' +([,.?!])', r'\1', s).strip()


def leftovers(say):
    """characters the voice model should never see (digits, Latin, math symbols, - ~ : =)."""
    return sorted({c for c in say if not ALLOWED.match(c)})


def check_say(say, where=''):
    bad = leftovers(say)
    if bad:
        raise ValueError(f'{where}: TTS text still has {"".join(bad)!r} -> add them to project.json "say_lexicon" '
                         f'or write the sentence\'s "say" by hand: {say!r}')
    return say


def load_lexicon(proj):
    """project.json "say_lexicon" ({"e": "이", "Euler": "오일러"}), or {}."""
    import json, os
    p = os.path.join(proj, 'project.json')
    return (json.load(open(p)).get('say_lexicon') or {}) if os.path.exists(p) else {}


def spoken(sentence, lexicon):
    """a script.json sentence -> the text the voice model gets: its own "say", else to_say(text)."""
    return sentence.get('say') or to_say(sentence['text'], lexicon)


def check_script(script, lexicon):
    """every sentence's spoken form, checked up front (before any GPU job). Exits listing all problems."""
    import sys
    bad = []
    for sc in script['scenes']:
        for k, s in enumerate(sc['sentences']):
            try:
                check_say(spoken(s, lexicon), f'{sc["id"]}:{k}')
            except ValueError as e:
                bad.append(str(e))
    if bad:
        sys.exit('raw digits / Latin / symbols would reach the TTS:\n  ' + '\n  '.join(bad))
