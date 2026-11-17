"""Signature-jingle candidates for the edit's 5-second title card, played on real instruments: each one is written as MIDI
here and rendered by FluidSynth with the MuseScore General SoundFont (MIT). The owner picks one; the edit plan names it
(`JINGLE = 'citypop'`) and cut.py uses it in place of sound.py's synthesised tune.
usage: python jingles.py <out dir> [name ...]   ->  <out>/jingle_<name>.wav (48 kHz stereo, 5.0 s, faded, same loudness)
       python jingles.py --list
Needs: fluidsynth on PATH, the SoundFont at <cache>/soundfonts/MuseScore_General.sf2 (engine/setup_assets.py fetches it)."""
import os, struct, subprocess, sys, tempfile, wave
import numpy as np

SR = 48000
DUR = 5.0
CACHE = os.environ.get('STREAM_CACHE') or os.path.join(os.path.expanduser('~'), '.cache', '2lab-stream')
SF2 = os.path.join(CACHE, 'soundfonts', 'MuseScore_General.sf2')
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def nm(s):
    """'C5' -> 72, 'Bb3' -> 58, 'F#4' -> 66"""
    k = NAMES[s[0]]; i = 1
    while i < len(s) and s[i] in '#b': k += 1 if s[i] == '#' else -1; i += 1
    return 12 * (int(s[i:]) + 1) + k


class Song:
    """notes in beats at one tempo; channel 9 is drums (GM numbers, kit chosen by program in bank 128)"""
    def __init__(self, bpm):
        self.bpm, self.ev, self.prog = bpm, [], {}

    def inst(self, ch, program, vol=100, pan=64, rev=50, cho=0):
        self.prog[ch] = (program, vol, pan, rev, cho)

    def n(self, ch, note, at, dur, vel=90):
        p = nm(note) if isinstance(note, str) else note
        self.ev.append((at, 0x90 | ch, p, vel)); self.ev.append((at + dur, 0x80 | ch, p, 0))

    def chord(self, ch, notes, at, dur, vel=70, strum=0.0):
        for i, x in enumerate(notes): self.n(ch, x, at + i * strum, dur - i * strum, vel)

    def seq(self, ch, notes, vel=90, legato=0.95):
        """[(note or None, at, dur), ...]"""
        for x, at, d in notes:
            if x: self.n(ch, x, at, d * legato, vel)

    def dr(self, note, at, vel=80):
        self.n(9, note, at, 0.1, vel)

    def midi(self, path, tail_beats=2.0):
        tpb = 480; us = int(60e6 / self.bpm)
        def vlq(v):
            out = [v & 0x7F]; v >>= 7
            while v: out.insert(0, (v & 0x7F) | 0x80); v >>= 7
            return bytes(out)
        evs = []
        for ch, (prog, vol, pan, rev, cho) in self.prog.items():
            if ch == 9: evs += [(0, bytes([0xB9, 0, 120])), (0, bytes([0xB9, 32, 0])), (0, bytes([0xC9, prog]))]
            else: evs += [(0, bytes([0xB0 | ch, 0, 0])), (0, bytes([0xC0 | ch, prog]))]
            evs += [(0, bytes([0xB0 | ch, 7, vol])), (0, bytes([0xB0 | ch, 10, pan])), (0, bytes([0xB0 | ch, 91, rev])), (0, bytes([0xB0 | ch, 93, cho]))]
        for at, st, p, v in self.ev: evs.append((int(round(at * tpb)), bytes([st, p, v])))
        evs.sort(key=lambda e: (e[0], e[1][0] & 0xF0 == 0x90))   # note-offs before note-ons at one tick
        end = max(e[0] for e in evs) + int(tail_beats * tpb)
        data = bytearray(b'\x00\xFF\x51\x03' + struct.pack('>I', us)[1:]); last = 0
        for t, b in evs: data += vlq(t - last) + b; last = t
        data += vlq(end - last) + b'\xFF\x2F\x00'
        open(path, 'wb').write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, tpb) + b'MTrk' + struct.pack('>I', len(data)) + bytes(data))


# ---------------------------------------------------------------------------------------------------- the candidates
# every tune is 5.0 s at its tempo: beats = 5.0 * bpm / 60 (the last chord rings into the fade)

def music_box():
    """동화 뮤직박스 — celesta tune over pizzicato strings, a harp run into the last chord, glockenspiel on top (F major, 120)"""
    s = Song(120); s.inst(0, 8, 110, 60, 70); s.inst(1, 45, 90, 70); s.inst(2, 46, 90, 64, 80); s.inst(3, 9, 70, 50, 80); s.inst(4, 45, 95, 64)
    s.seq(0, [('C5', 0, .5), ('F5', .5, .5), ('A5', 1, .5), ('C6', 1.5, 1), ('Bb5', 2.5, .5), ('A5', 3, .5), ('G5', 3.5, .5), ('E5', 4, 1),
              ('G5', 5, .5), ('A5', 5.5, .5), ('F5', 6, 4)], 100)
    for b, ch in [(0, ['F4', 'A4', 'C5']), (1, ['F4', 'A4', 'C5']), (2.5, ['F4', 'Bb4', 'D5']), (3.5, ['F4', 'Bb4', 'D5']), (4, ['E4', 'G4', 'C5']), (5, ['E4', 'Bb4', 'C5'])]:
        s.chord(1, ch, b, .4, 70)
    s.seq(4, [('F2', 0, .5), ('C3', 1, .5), ('Bb2', 2.5, .5), ('C3', 4, .5), ('C3', 5, .5), ('F2', 6, 3)], 85)
    for i, x in enumerate(['F4', 'A4', 'C5', 'F5', 'A5', 'C6']): s.n(2, x, 5.4 + i * .1, 3.5, 70)
    s.chord(3, ['F6', 'A6', 'C7'], 6, 3, 60, .08)
    s.inst(5, 49, 70, 64, 90); s.chord(5, ['F3', 'C4', 'A4'], 5.5, 4.5, 55)   # strings hold the last chord to the end
    return s


def lofi_keys():
    """로파이 건반 — tine electric piano chords and a lazy lick over a soft kit (C major, 84)"""
    s = Song(84); s.inst(0, 4, 105, 64, 60, 30); s.inst(1, 33, 100); s.inst(2, 4, 90, 80, 70, 40); s.inst(9, 0, 80)
    s.chord(0, ['F3', 'A3', 'C4', 'E4', 'G4'], 0, 2, 62, .02); s.chord(0, ['E3', 'G3', 'B3', 'D4'], 2, 1, 60, .02); s.chord(0, ['A3', 'C#4', 'E4', 'G4'], 3, 1, 60, .02)
    s.chord(0, ['D3', 'F3', 'A3', 'C4', 'E4'], 4, 1, 60, .02); s.chord(0, ['G3', 'B3', 'D4', 'F4', 'A4'], 5, 1, 60, .02); s.chord(0, ['C3', 'E3', 'G3', 'B3', 'D4'], 6, 2, 64, .03)
    s.seq(2, [('E5', .5, .5), ('G5', 1, .5), ('A5', 1.5, 1), ('G5', 2.75, .25), ('E5', 3, .5), ('D5', 3.5, .5), ('E5', 4.5, .5), ('G5', 5, .5), ('B5', 5.5, .5), ('C6', 6, 2)], 82)
    s.seq(1, [('F2', 0, 1.5), ('E2', 2, .9), ('A1', 3, .9), ('D2', 4, .9), ('G1', 5, .9), ('C2', 6, 1.5)], 95)
    for b in range(7):
        s.dr(36, b, 70 if b % 2 == 0 else 0) if b % 2 == 0 else s.dr(38, b, 55)
        s.dr(42, b, 45); s.dr(42, b + 0.66, 35)
    return s


def marimba_vlog():
    """브이로그 마림바 — bouncy marimba over a nylon-guitar strum and claps (C major, 128)"""
    s = Song(128); s.inst(0, 12, 115, 64, 50); s.inst(1, 24, 95, 80, 40); s.inst(2, 32, 95); s.inst(3, 9, 70, 40, 70); s.inst(9, 0, 85)
    s.seq(0, [('G4', 0, .5), ('C5', .5, .5), ('E5', 1, .5), ('G5', 1.5, .5), ('E5', 2, .5), ('C5', 2.5, .5), ('D5', 3, .5), ('F5', 3.5, .5),
              ('A5', 4, .5), ('G5', 4.5, .5), ('E5', 5, .5), ('C5', 5.5, .5), ('D5', 6, .5), ('E5', 6.5, .5), ('G5', 7, .5), ('B5', 7.5, .5), ('C6', 8, 2.6)], 105)
    for b, ch in [(0, ['C3', 'G3', 'C4', 'E4']), (2, ['A2', 'E3', 'A3', 'C4']), (4, ['F2', 'C3', 'F3', 'A3']), (6, ['G2', 'D3', 'G3', 'B3']), (8, ['C3', 'G3', 'C4', 'E4'])]:
        for k in range(4 if b < 8 else 1): s.chord(1, ch, b + k * .5, .45, 72 if k % 2 == 0 else 55, .015)
    s.seq(2, [('C2', 0, 1), ('A1', 2, 1), ('F1', 4, 1), ('G1', 6, 1), ('C2', 8, 2)], 90)
    for b in range(1, 8, 2): s.dr(39, b, 80)
    for b in range(0, 8, 2): s.dr(36, b, 75)
    s.dr(49, 8, 70); s.dr(36, 8, 80); s.chord(3, ['C6', 'E6', 'G6'], 8, 2, 65, .06)
    return s


def jazz_trio():
    """재즈 트리오 — piano lick, walking bass, brushes; ii-V-I into a 6/9 (Bb major, 140 swing)"""
    s = Song(140); s.inst(0, 0, 110, 70, 60); s.inst(1, 32, 105, 54); s.inst(9, 40, 90)
    sw = lambda b: b + (0.16 if (b * 2) % 2 == 1 else 0)   # swing the off-beats
    lick = [('F5', 0, .5), ('G5', .5, .5), ('A5', 1, .5), ('C6', 1.5, .5), ('Bb5', 2, .5), ('G5', 2.5, .5), ('F5', 3, .5), ('D5', 3.5, .5),
            ('Eb5', 4, .5), ('E5', 4.5, .5), ('F5', 5, .5), ('A5', 5.5, .5), ('G5', 6, .5), ('Eb5', 6.5, .5), ('D5', 7, .5), ('C5', 7.5, .5)]
    for x, at, d in lick: s.n(0, x, sw(at), d * .8, 92)
    s.chord(0, ['Eb3', 'G3', 'Bb3', 'D4'], 0, 1.8, 60); s.chord(0, ['Eb3', 'A3', 'C4', 'F4'], 4, 1.8, 60)
    s.chord(0, ['D3', 'G3', 'C4', 'F4', 'D5', 'G5', 'Bb5'], 8, 3.5, 78, .03)
    s.seq(1, [(x, i, 1) for i, x in enumerate(['C2', 'Eb2', 'G2', 'A2', 'F2', 'A2', 'C3', 'Eb3'])] + [('Bb1', 8, 3.5)], 100)
    for b in range(8):
        s.dr(51, b, 70); s.dr(51, sw(b + .5), 50)
        if b % 2: s.dr(38, b, 45); s.dr(44, b, 50)
    s.dr(51, 8, 80); s.dr(36, 8, 60); s.dr(49, 8, 55)
    return s


def chiptune():
    """칩튠 — square-wave tune, saw bass, a coin arpeggio at the end (C major, 150)"""
    s = Song(150); s.inst(0, 80, 100, 64, 20); s.inst(1, 81, 85, 64, 10); s.inst(2, 80, 70, 90, 20); s.inst(9, 24, 85)
    s.seq(0, [('C5', 0, .5), ('E5', .5, .5), ('G5', 1, .5), ('C6', 1.5, 1), ('B5', 2.5, .5), ('G5', 3, .5), ('E5', 3.5, .5), ('G5', 4, 1),
              ('A5', 5, .5), ('F5', 5.5, .5), ('D5', 6, .5), ('F5', 6.5, .5), ('G5', 7, .5), ('B5', 7.5, .5), ('D6', 8, .5), ('C6', 8.5, 1)], 95, .85)
    for i, x in enumerate(['C6', 'E6', 'G6', 'C7']): s.n(2, x, 9.5 + i * .17, .3, 85)
    s.chord(1, ['C3', 'G3'], 10.2, 2.3, 80); s.chord(0, ['E5', 'G5', 'C6'], 10.2, 2.3, 70)   # a held chord after the coin
    s.seq(1, [(x, i * .5, .45) for i, x in enumerate(['C3', 'C3', 'G2', 'G2', 'C3', 'C3', 'G2', 'G2', 'E3', 'E3', 'B2', 'B2', 'F2', 'F2', 'D3', 'D3', 'G2', 'B2'])] + [('C3', 9, 1.5)], 90)
    for b in range(9):
        s.dr(36, b, 80) if b % 2 == 0 else s.dr(38, b, 70)
        s.dr(42, b + .5, 50)
    return s


def fanfare():
    """작은 팡파르 — brass call with timpani and strings, a held Bb chord and a cymbal (Bb major, 100)"""
    s = Song(100); s.inst(0, 56, 110, 64, 60); s.inst(1, 60, 95, 50, 70); s.inst(2, 57, 95, 78, 60); s.inst(3, 47, 100, 64, 50); s.inst(4, 48, 85, 64, 80); s.inst(9, 48, 90)
    s.seq(0, [('F4', 0, .33), ('F4', .33, .33), ('F4', .66, .34), ('Bb4', 1, 1), ('D5', 2, .5), ('F5', 2.5, 1.5), ('Eb5', 4, .5), ('D5', 4.5, .5), ('C5', 5, .5),
              ('D5', 5.5, .25), ('Eb5', 5.75, .25), ('D5', 6, 2.3)], 105)
    s.seq(1, [('D4', 1, 1), ('F4', 2, 2), ('G4', 4, 1), ('Eb4', 5, 1), ('F4', 6, 2.3)], 85)
    s.seq(2, [('Bb2', 1, 1), ('Bb2', 2, 2), ('Eb3', 4, 1), ('F3', 5, 1), ('Bb2', 6, 2.3)], 85)
    s.seq(3, [('Bb2', 1, .5), ('F2', 2, .5), ('Eb2', 4, .5), ('F2', 5, .5)], 100)
    for k in range(10): s.n(3, 'Bb2', 6 + k * .12, .12, 60 + k * 4)
    s.chord(4, ['Bb2', 'F3', 'Bb3', 'D4'], 1, 7.3, 60)
    s.dr(49, 6, 100); s.dr(57, 6, 80)
    return s


def citypop():
    """시티팝 — synth bass, FM electric piano, brass stabs and an alto sax line (F major, 112)"""
    s = Song(112); s.inst(0, 65, 105, 70, 60, 20); s.inst(1, 38, 100); s.inst(2, 5, 85, 50, 50, 50); s.inst(3, 61, 90, 78, 50); s.inst(9, 0, 90)
    s.seq(0, [('A5', 0, .5), ('C6', .5, .5), ('E6', 1, 1), ('D6', 2, .5), ('C6', 2.5, .5), ('B5', 3, .5), ('G5', 3.5, .5), ('A5', 4, .5),
              ('G5', 4.5, .5), ('E5', 5, .5), ('G5', 5.5, .5), ('A5', 6, 3.3)], 95)
    for b, ch in [(0, ['F3', 'A3', 'C4', 'E4']), (2, ['E3', 'G#3', 'B3', 'D4']), (4, ['A2', 'C3', 'E3', 'G3', 'B3']), (6, ['D3', 'F3', 'A3', 'C4', 'E4'])]:
        s.chord(2, ch, b, 1.9 if b < 6 else 3.3, 60, .01)
    s.seq(1, [(x, at, d) for x, at, d in [('F2', 0, .5), ('F2', .75, .25), ('F3', 1, .5), ('E2', 2, .5), ('E2', 2.75, .25), ('E3', 3, .5), ('A1', 4, .5), ('A2', 4.5, .5),
              ('G2', 5, .5), ('E2', 5.5, .5), ('D2', 6, 3)]], 100, .9)
    for b in (1.5, 3.5, 5.5): s.chord(3, ['C5', 'E5', 'A5'] if b < 3 else ['B4', 'D5', 'G#5'] if b < 5 else ['C5', 'E5', 'G5'], b, .25, 85)
    s.chord(3, ['D4', 'A4', 'C5', 'E5'], 6, 1.5, 80)
    for b in range(6):
        s.dr(36, b, 85); s.dr(38 if b % 2 else 42, b, 75 if b % 2 else 45)
        for k in (.25, .5, .75): s.dr(42, b + k, 40)
    s.dr(49, 6, 75); s.dr(36, 6, 85)
    return s


def guitar_whistle():
    """기타와 휘파람 — nylon-guitar picking under a whistled tune, a shaker (G major, 96)"""
    s = Song(96); s.inst(0, 78, 100, 70, 60); s.inst(1, 24, 105, 56, 50); s.inst(9, 0, 70)
    pick = lambda root, ch, at: [s.n(1, x, at + i * .5, 1.6 - i * .5 if i < 3 else .5, 70 - i * 4) for i, x in enumerate([root] + ch)]
    pick('G2', ['D3', 'G3', 'B3'], 0); pick('E2', ['B2', 'E3', 'G3'], 2); pick('C3', ['G3', 'C4', 'E4'], 4); pick('D3', ['A3', 'D4', 'F#4'], 6)
    s.chord(1, ['G2', 'D3', 'G3', 'B3', 'D4', 'G4'], 7, 1.2, 72, .04)
    s.seq(0, [('D5', 0, .5), ('G5', .5, .5), ('A5', 1, .5), ('B5', 1.5, 1), ('A5', 2.5, .5), ('G5', 3, .5), ('E5', 3.5, .5), ('G5', 4, 1),
              ('A5', 5, .5), ('B5', 5.5, .5), ('G5', 6, 2)], 92)
    for k in range(16): s.dr(82, k * .5, 45 if k % 2 else 60)
    return s


def night_glock():
    """책 듣는 밤 — warm strings, harp arpeggios, a glockenspiel lullaby (A minor to C, 76)"""
    s = Song(76); s.inst(0, 9, 100, 64, 90); s.inst(1, 49, 85, 64, 90); s.inst(2, 46, 95, 50, 80); s.inst(3, 0, 70, 70, 80)
    s.chord(1, ['A2', 'E3', 'C4'], 0, 1.6, 60); s.chord(1, ['F2', 'C3', 'A3'], 1.6, 1.6, 60); s.chord(1, ['C3', 'G3', 'E4'], 3.2, 3.2, 62)
    for i, x in enumerate(['A3', 'C4', 'E4', 'A4', 'F3', 'A3', 'C4', 'F4', 'C4', 'E4', 'G4', 'C5', 'E5']): s.n(2, x, i * .4, 1.5, 62)
    s.seq(0, [('E6', 0, .8), ('C6', .8, .8), ('A5', 1.6, .8), ('C6', 2.4, .8), ('G5', 3.2, .4), ('A5', 3.6, .4), ('C6', 4.0, 2.4)], 85)
    s.chord(3, ['C3', 'G3', 'E4'], 3.2, 3, 50)
    return s


def bossa():
    """보사노바 — nylon-guitar comping, flute, shaker and rim (D minor to C, 128)"""
    s = Song(128); s.inst(0, 73, 100, 70, 60); s.inst(1, 24, 100, 56, 40); s.inst(2, 32, 95); s.inst(9, 0, 75)
    comp = [0, 1.5, 2.5, 4, 5.5, 6.5]
    for at in comp:
        ch = ['F3', 'A3', 'C4', 'E4'] if at < 4 else ['F3', 'B3', 'D4', 'E4']
        s.chord(1, ch, at, .9, 62, .01)
    s.chord(1, ['E3', 'G3', 'B3', 'D4'], 8, 2.6, 66, .03)
    s.seq(2, [('D2', 0, 1.4), ('A1', 1.5, .5), ('D2', 2, 1.4), ('A1', 3.5, .5), ('G1', 4, 1.4), ('D2', 5.5, .5), ('G1', 6, 1.4), ('D2', 7.5, .5), ('C2', 8, 2.5)], 90)
    s.seq(0, [('A5', 0, 1), ('G5', 1, .5), ('E5', 1.5, .5), ('F5', 2, 1.5), ('D5', 3.5, .5), ('E5', 4, .5), ('F5', 4.5, .5), ('G5', 5, 1), ('B5', 6, .5),
              ('A5', 6.5, .5), ('G5', 7, 1), ('E5', 8, 2.5)], 90)
    for k in range(20): s.dr(82, k * .5, 50 if k % 2 else 35)
    for at in [0, 1.5, 3, 4.5, 5.5, 7]: s.dr(37, at, 60)
    return s


def baroque():
    """바로크 하프시코드 — running harpsichord over a pizzicato bass, a trill into the cadence (D major, 132)"""
    s = Song(132); s.inst(0, 6, 105, 60, 50); s.inst(1, 45, 95, 70); s.inst(2, 70, 85, 64, 50)
    run = ['D5', 'F#5', 'A5', 'F#5', 'D5', 'A4', 'D5', 'F#5', 'G5', 'E5', 'C#5', 'E5', 'A5', 'G5', 'F#5', 'E5', 'F#5', 'D5', 'B4', 'D5', 'G5', 'F#5', 'E5', 'D5',
           'C#5', 'E5', 'A5', 'G5', 'F#5', 'E5', 'D5', 'C#5']
    for i, x in enumerate(run): s.n(0, x, i * .25, .24, 80 if i % 4 == 0 else 66)
    for i in range(8): s.n(0, 'E5' if i % 2 == 0 else 'F#5', 8 + i * .0625, .06, 70)
    s.chord(0, ['D4', 'A4', 'D5', 'F#5'], 8.5, 2.5, 85, .02)
    s.seq(1, [(x, i, .5) for i, x in enumerate(['D3', 'D3', 'A2', 'A2', 'B2', 'G2', 'A2', 'A2'])] + [('D2', 8.5, 2)], 90)
    s.seq(2, [('D3', 0, 2), ('A2', 2, 2), ('G2', 4, 2), ('A2', 6, 2.5), ('D2', 8.5, 2.5)], 70)
    return s


def vibes_lounge():
    """비브라폰 라운지 — vibraphone tune, upright bass, brushes and a side stick (Eb major, 118 swing)"""
    s = Song(118); s.inst(0, 11, 110, 70, 70); s.inst(1, 32, 100, 54); s.inst(2, 0, 70, 50, 60); s.inst(9, 40, 85)
    sw = lambda b: b + (0.16 if (b * 2) % 2 == 1 else 0)
    for x, at, d in [('G5', 0, .5), ('Bb5', .5, .5), ('D6', 1, 1), ('C6', 2, .5), ('Bb5', 2.5, .5), ('G5', 3, 1), ('F5', 4, .5), ('G5', 4.5, .5), ('Ab5', 5, .5),
                     ('C6', 5.5, .5), ('Bb5', 6, .5), ('G5', 6.5, .5), ('Eb5', 7, .5), ('F5', 7.5, .5), ('G5', 8, 2)]:
        s.n(0, x, sw(at), d * .9, 95)
    for b, ch in [(0, ['Eb3', 'G3', 'Bb3', 'D4']), (2, ['C3', 'Eb3', 'G3', 'Bb3']), (4, ['F3', 'Ab3', 'C4', 'Eb4']), (6, ['Bb2', 'D3', 'F3', 'Ab3']), (8, ['Eb3', 'G3', 'Bb3', 'C4'])]:
        s.chord(2, ch, b + .5, 1.2 if b < 8 else 1.8, 58)
    s.seq(1, [(x, i, 1) for i, x in enumerate(['Eb2', 'G2', 'C2', 'Eb2', 'F2', 'Ab2', 'Bb1', 'D2'])] + [('Eb2', 8, 2)], 100)
    for b in range(8): s.dr(51, b, 60); s.dr(51, sw(b + .5), 45); s.dr(37, b, 55 if b % 2 else 0) if b % 2 else None
    s.dr(51, 8, 70)
    return s


def funk_clav():
    """펑크 클라비넷 — a 16th clavinet riff, slap bass, brass hits, a big E9 ending (E minor, 108)"""
    s = Song(108); s.inst(0, 7, 100, 50, 30); s.inst(1, 36, 105); s.inst(2, 61, 100, 78, 50); s.inst(9, 0, 95)
    riff = ['E4', None, 'G4', 'E4', None, 'A4', None, 'G4', 'E4', None, 'D4', None, 'E4', 'G4', None, 'B4']
    for bar in range(2):
        for i, x in enumerate(riff):
            if x: s.n(0, x, bar * 4 + i * .25, .18, 85 if i % 4 == 0 else 65)
    s.seq(1, [('E2', 0, .5), ('E3', .75, .25), ('E2', 1.5, .25), ('G2', 2, .5), ('A2', 3, .5), ('B2', 3.5, .5), ('E2', 4, .5), ('E3', 4.75, .25), ('D3', 5.5, .25),
              ('B2', 6, .5), ('A2', 6.5, .5), ('G2', 7, .5), ('E2', 8, 1)], 105, .85)
    for at in (1.75, 3.75, 5.75): s.chord(2, ['B4', 'D5', 'G5'], at, .2, 95)
    s.chord(2, ['G#4', 'B4', 'D5', 'F#5'], 8, 1.4, 110); s.chord(0, ['E3', 'G#3', 'B3', 'D4', 'F#4'], 8, 1.4, 90)
    for b in range(8):
        s.dr(36, b, 90) if b % 2 == 0 else s.dr(38, b, 85)
        for k in (0, .25, .5, .75): s.dr(42, b + k, 55 if k == .5 else 38)
    s.dr(49, 8, 100); s.dr(36, 8, 100)
    return s


def piano_sting():
    """피아노 시그니처 — a warm grand piano motif with a soft string swell (C major, 90)"""
    s = Song(90); s.inst(0, 0, 112, 64, 70); s.inst(1, 49, 75, 64, 90)
    s.seq(0, [('E5', 0, .5), ('G5', .5, .5), ('C6', 1, 1), ('B5', 2, .5), ('G5', 2.5, .5), ('A5', 3, 1), ('G5', 4, .5), ('E5', 4.5, .5), ('D5', 5, .5), ('E5', 5.5, .5), ('C5', 6, 1.5)], 88)
    for i, x in enumerate(['C3', 'G3', 'E4', 'G3', 'A2', 'E3', 'C4', 'E3', 'F2', 'C3', 'A3', 'C3', 'G2', 'D3', 'B3', 'D3']): s.n(0, x, i * .375, .7, 55)
    s.chord(0, ['C2', 'G2', 'E3', 'G3', 'C4'], 6, 1.5, 70, .03)
    s.chord(1, ['C3', 'E3', 'G3'], 0, 3, 45); s.chord(1, ['F3', 'A3', 'C4'], 3, 3, 50); s.chord(1, ['C3', 'G3', 'E4'], 6, 1.5, 55)
    return s


CANDIDATES = {f.__name__: f for f in (music_box, lofi_keys, marimba_vlog, jazz_trio, chiptune, fanfare, citypop, guitar_whistle, night_glock,
                                      bossa, baroque, vibes_lounge, funk_clav, piano_sting)}


def describe(name): return CANDIDATES[name].__doc__.split(' — ')[0]


def render(name, out_wav, sf2=SF2):
    """MIDI -> FluidSynth -> 5.0 s, faded tail, loudness matched (RMS of the loud part), 48 kHz stereo wav"""
    if not os.path.exists(sf2): raise SystemExit(f'SoundFont missing: {sf2} (run engine/setup_assets.py)')
    with tempfile.TemporaryDirectory() as d:
        mid = os.path.join(d, 'j.mid'); raw = os.path.join(d, 'j.wav')
        CANDIDATES[name]().midi(mid)
        subprocess.run(['fluidsynth', '-ni', '-q', '-F', raw, '-r', str(SR), '-g', '0.7', '-R', '1', '-C', '1', sf2, mid], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        w = wave.open(raw); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, w.getnchannels()) / 32768
    n = int(DUR * SR); x = np.pad(x, ((0, max(0, n - len(x))), (0, 0)))[:n]
    k = int(0.45 * SR); x[-k:] *= (np.linspace(1, 0, k) ** 1.6)[:, None]
    loud = np.sqrt(np.mean(x[:int(4.0 * SR)] ** 2)) + 1e-9
    x = x * (0.16 / loud)                                       # the same felt level for every candidate
    hot = np.abs(x) > 0.8                                       # a soft knee over 0.8 instead of turning the whole tune down
    x[hot] = np.sign(x[hot]) * (0.8 + 0.18 * np.tanh((np.abs(x[hot]) - 0.8) / 0.18))
    with wave.open(out_wav, 'wb') as o:
        o.setnchannels(2); o.setsampwidth(2); o.setframerate(SR); o.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    return out_wav


if __name__ == '__main__':
    if '--list' in sys.argv:
        for k in CANDIDATES: print(k, '-', CANDIDATES[k].__doc__)
        sys.exit(0)
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for name in (sys.argv[2:] or list(CANDIDATES)):
        print(name, '->', render(name, os.path.join(out, f'jingle_{name}.wav')))
