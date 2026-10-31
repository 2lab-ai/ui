import { describe, expect, it } from 'vitest';
import { fmtSpan } from '../components/elapsed/elapsed';
import { fmtDuration, fmtDurationIn } from './format';

describe('fmtDurationIn — elapsed time in the surface language (0.15.1)', () => {
  const samples = [0, 999, 42_000, 65_000, 9 * 60_000 + 22_000, 60 * 60_000, 2 * 3_600_000 + 5 * 60_000 + 30_000];

  it('is fmtDuration in English (unchanged output for every English surface)', () => {
    for (const ms of samples) expect(fmtDurationIn(ms)).toBe(fmtDuration(ms));
    for (const ms of samples) expect(fmtDurationIn(ms, 'en')).toBe(fmtDuration(ms));
  });

  it('says it in Korean with the same words as <ui-elapsed lang="ko"> — a plan step, a run and a live time read alike', () => {
    expect(fmtDurationIn(42_000, 'ko')).toBe('42초');
    expect(fmtDurationIn(65_000, 'ko')).toBe('1분 05초');
    expect(fmtDurationIn(9 * 60_000 + 22_000, 'ko')).toBe('9분 22초');
    expect(fmtDurationIn(2 * 3_600_000 + 5 * 60_000 + 30_000, 'ko')).toBe('2시간 05분');
    for (const ms of samples) expect(fmtDurationIn(ms, 'ko')).toBe(fmtSpan(ms, 'ko'));
  });
});
