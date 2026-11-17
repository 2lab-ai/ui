"""Korean 2-set (두벌식) keyboard: text -> keystrokes, and the IME composition state after every keystroke."""
CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
V2 = {'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ'}
C2 = {'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ'}
V2R = {v: k for k, v in V2.items()}
C2R = {v: k for k, v in C2.items()}
SHIFT = set('ㄲㄸㅃㅆㅉㅒㅖ')
CONS = set(CHO) | set('ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ')
VOW = set(JUNG)


def compose(cho, jung, jong=''):
    if cho is None and jung is None: return ''
    if cho is None: return jung
    if jung is None: return cho
    return chr(0xAC00 + (CHO.index(cho) * 21 + JUNG.index(jung)) * 28 + JONG.index(jong or ''))


def decompose(ch):
    o = ord(ch) - 0xAC00
    if 0 <= o < 11172:
        return CHO[o // 588], JUNG[(o % 588) // 28], JONG[o % 28]
    return None


def keys_for(text):
    """text -> list of keys: Hangul jamo (single keys), or literal chars ('\n', ' ', digits, punctuation)."""
    out = []
    for ch in text:
        d = decompose(ch)
        if d:
            c, v, j = d
            out.append(c); out.extend(V2.get(v, v)); out.extend(C2.get(j, j) if j else '')
        elif ch in V2: out.extend(V2[ch])
        else: out.append(ch)
    return out


class IME:
    def __init__(self):
        self.done = ''; self.cho = self.jung = None; self.jong = ''

    def comp(self): return compose(self.cho, self.jung, self.jong) if (self.cho or self.jung) else ''

    def commit(self):
        self.done += self.comp(); self.cho = self.jung = None; self.jong = ''

    def key(self, k):
        if k == '\b':
            if self.jong:
                self.jong = C2[self.jong][0] if self.jong in C2 else ''
            elif self.jung:
                self.jung = V2[self.jung][0] if self.jung in V2 else None
            elif self.cho: self.cho = None
            else: self.done = self.done[:-1]
            return
        if k in CONS and k in CHO or k in CONS:
            if self.jung is None:
                if self.cho is None: self.cho = k
                else: self.commit(); self.cho = k
            elif self.cho is None:   # bare vowel then consonant: commit vowel
                self.commit(); self.cho = k
            elif not self.jong:
                if k in JONG and k not in ('ㄸ', 'ㅃ', 'ㅉ'): self.jong = k
                else: self.commit(); self.cho = k
            else:
                c = C2R.get(self.jong + k)
                if c: self.jong = c
                else: self.commit(); self.cho = k
        elif k in VOW:
            if self.cho is not None and self.jung is None: self.jung = k
            elif self.jung is not None and not self.jong:
                v = V2R.get(self.jung + k)
                if v and self.cho is not None: self.jung = v
                else: self.commit(); self.jung = k
            elif self.jong:
                if self.jong in C2: keep, move = C2[self.jong][0], C2[self.jong][1]
                else: keep, move = '', self.jong
                self.jong = keep; self.commit(); self.cho = move; self.jung = k
            else: self.jung = k
        else:
            self.commit(); self.done += k

    def state(self): return self.done, self.comp()


def simulate(keys):
    ime = IME(); states = []
    for k in keys:
        ime.key(k); states.append(ime.state())
    return states


if __name__ == '__main__':
    for t in ['아주 작은 습관의 힘', '갔어요', '언니 바보 ㅋ', '1%씩 1년 = 37배', '읽다 말았다', '괜찮아', '없어']:
        ks = keys_for(t); st = simulate(ks)
        final = st[-1][0] + st[-1][1]
        print(t, '->', final, len(ks), 'keys', 'OK' if final == t else 'MISMATCH', st[:6])
