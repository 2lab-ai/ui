import { describe, expect, it } from 'vitest';
import {
  activityCss,
  activityId,
  estimateTokens,
  formatBytes,
  rawViewHtml,
  skillBadgesHtml,
  sysBadgeHtml,
  sysKindLabel,
  utf8Bytes,
} from './activity';

/** Parse markup into a detached container. */
function dom(html: string): HTMLElement {
  const box = document.createElement('div');
  box.innerHTML = html;
  return box;
}

const XSS = '<img src=x onerror=alert(1)>"\'&';

describe('sysKindLabel', () => {
  it('names every kind in en and ko', () => {
    expect(['compact', 'restart', 'retry', 'goal', 'cron', 'background'].map((k) => sysKindLabel(k))).toEqual([
      'Compacted',
      'Restarted',
      'Retried',
      'Goal',
      'Scheduled',
      'Background',
    ]);
    expect(['compact', 'restart', 'retry', 'goal', 'cron', 'background'].map((k) => sysKindLabel(k, 'ko'))).toEqual([
      '압축',
      '재시작',
      '재시도',
      '목표',
      '예약',
      '백그라운드',
    ]);
  });

  it('an unknown kind is the kind itself (unescaped — the caller escapes)', () => {
    expect(sysKindLabel('renew')).toBe('renew');
    expect(sysKindLabel('<b>')).toBe('<b>');
    expect(sysKindLabel('toString')).toBe('toString');
  });
});

describe('sysBadgeHtml', () => {
  it('icon + word with data-kind', () => {
    const b = dom(sysBadgeHtml('cron')).querySelector('.sys-badge')!;
    expect(b.getAttribute('data-kind')).toBe('cron');
    expect(b.querySelector('svg[data-icon="clock"]')).not.toBeNull();
    expect(b.textContent).toBe('Scheduled');
    expect(dom(sysBadgeHtml('restart', 'ko')).textContent).toBe('재시작');
    expect(dom(sysBadgeHtml('retry')).querySelector('svg[data-icon="refresh"]')).not.toBeNull();
    expect(dom(sysBadgeHtml('goal')).querySelector('svg[data-icon="target"]')).not.toBeNull();
  });

  it('a label replaces the word; unknown kinds get the gear; everything is escaped', () => {
    const box = dom(sysBadgeHtml(XSS, 'en', XSS));
    expect(box.querySelector('img')).toBeNull();
    const b = box.querySelector('.sys-badge')!;
    expect(b.getAttribute('data-kind')).toBe(XSS);
    expect(b.textContent).toBe(XSS);
    expect(b.querySelector('svg[data-icon="gear"]')).not.toBeNull();
    expect(dom(sysBadgeHtml('goal', 'en', 'Goal 2/5')).textContent).toBe('Goal 2/5');
  });
});

describe('estimateTokens', () => {
  it('about 4 ASCII characters per token, every other character one, rounded up', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens('a'.repeat(4800))).toBe(1200);
    expect(estimateTokens('한글')).toBe(2);
    expect(estimateTokens('ab한')).toBe(2);
    expect(estimateTokens(undefined as unknown as string)).toBe(0);
  });
});

describe('formatBytes / utf8Bytes / activityId', () => {
  it('formats B, KiB, MiB, GiB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(812)).toBe('812 B');
    expect(formatBytes(1024)).toBe('1.0 KiB');
    expect(formatBytes(12_595)).toBe('12.3 KiB');
    expect(formatBytes(1.2 * 1024 * 1024)).toBe('1.2 MiB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GiB');
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });

  it('counts UTF-8 bytes', () => {
    expect(utf8Bytes('abc')).toBe(3);
    expect(utf8Bytes('é')).toBe(2);
    expect(utf8Bytes('한')).toBe(3);
    expect(utf8Bytes('😀')).toBe(4);
  });

  it('ids keep letters, digits, _ and - only', () => {
    expect(activityId('g1:e/2')).toBe('g1_e_2');
    expect(activityId('')).toBe('act');
  });
});

describe('skillBadgesHtml', () => {
  const skills = [
    { name: 'code-review', text: 'a'.repeat(4800) },
    { name: 'release-notes', tokens: 950 },
    { name: 'plain' },
  ];

  it('one chip per skill with name and ~tokens; nothing open by default', () => {
    const box = dom(skillBadgesHtml(skills, { keyPrefix: 'e1' }));
    const group = box.querySelector('.skill-badges')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Skills used: 3');
    const chips = Array.from(box.querySelectorAll<HTMLButtonElement>('button.skill-badge'));
    expect(chips).toHaveLength(3);
    expect(chips.map((c) => c.dataset.skill)).toEqual(['0', '1', '2']);
    expect(chips[0].textContent).toBe('code-review~1.2K tokens');
    expect(chips[1].querySelector('.skill-tok')?.textContent).toBe('~950 tokens');
    expect(chips[2].querySelector('.skill-tok')).toBeNull();
    expect(chips.every((c) => c.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(chips[0].getAttribute('aria-controls')).toBe('e1-skill-0');
    expect(chips[0].dataset.key).toBe('e1:skill:0');
    expect(box.querySelector('.skill-pane')).toBeNull();
  });

  it('the open skill shows its pane with the text in a <pre>', () => {
    const box = dom(skillBadgesHtml(skills, { keyPrefix: 'g/1', open: 0 }));
    const chips = box.querySelectorAll('button.skill-badge');
    expect(chips[0].getAttribute('aria-expanded')).toBe('true');
    const pane = box.querySelector('.skill-pane')!;
    expect(pane.id).toBe('g_1-skill-0');
    expect(chips[0].getAttribute('aria-controls')).toBe(pane.id);
    expect(pane.querySelector('pre.skill-text')?.textContent).toBe('a'.repeat(4800));
    expect(pane.querySelector('.skill-tok')?.textContent).toBe('~1.2K tokens (estimate)');
    // Out of range → closed.
    expect(dom(skillBadgesHtml(skills, { keyPrefix: 'x', open: 9 })).querySelector('.skill-pane')).toBeNull();
  });

  it('idPrefix sets the id stem; data-key still uses keyPrefix', () => {
    const box = dom(skillBadgesHtml(skills, { keyPrefix: 's:a:b', idPrefix: 'wl7', open: 1 }));
    const chip = box.querySelectorAll('button.skill-badge')[1];
    expect(chip.getAttribute('aria-controls')).toBe('wl7-skill-1');
    expect(chip.getAttribute('data-key')).toBe('s:a:b:skill:1');
    expect(box.querySelector('.skill-pane')?.id).toBe('wl7-skill-1');
  });

  it('skips non-object entries; a pane without text has no <pre>', () => {
    const list = [null, 'x', { name: 'only' }] as unknown as Parameters<typeof skillBadgesHtml>[0];
    const box = dom(skillBadgesHtml(list, { keyPrefix: 'k', open: 0 }));
    expect(box.querySelectorAll('button.skill-badge')).toHaveLength(1);
    expect(box.querySelector('.skill-pane .skill-name')?.textContent).toBe('only');
    expect(box.querySelector('.skill-pane pre')).toBeNull();
    expect(skillBadgesHtml(undefined as unknown as [], { keyPrefix: 'k' })).toBe('');
  });

  it('escapes names and text; empty list renders nothing; ko strings', () => {
    const box = dom(skillBadgesHtml([{ name: XSS, text: XSS }], { keyPrefix: XSS, open: 0, lang: 'ko' }));
    expect(box.querySelector('img')).toBeNull();
    expect(box.querySelector('.skill-badge .skill-name')?.textContent).toBe(XSS);
    expect(box.querySelector('.skill-badge')?.getAttribute('data-key')).toBe(`${XSS}:skill:0`);
    expect(box.querySelector('pre')?.textContent).toBe(XSS);
    expect(box.querySelector('.skill-badges')?.getAttribute('aria-label')).toBe('사용한 스킬 1개');
    expect(box.querySelector('.skill-badge .skill-tok')?.textContent).toMatch(/토큰$/);
    expect(skillBadgesHtml([], { keyPrefix: 'a' })).toBe('');
  });
});

describe('rawViewHtml', () => {
  it('ready: size, Copy, the text in a pre, the truncation line', () => {
    const box = dom(
      rawViewHtml(
        { state: 'ready', text: 'line 1\nline 2', bytes: 1.2 * 1024 * 1024, truncated: true },
        { keyPrefix: 'e1' },
      ),
    );
    expect(box.querySelector('.raw')?.getAttribute('data-state')).toBe('ready');
    expect(box.querySelector('.raw-size')?.textContent).toBe('1.2 MiB');
    const copy = box.querySelector<HTMLButtonElement>('button.raw-copy')!;
    expect(copy.textContent).toBe('Copy');
    expect(copy.dataset.key).toBe('e1:copy');
    expect(box.querySelector('.raw-retry')).toBeNull();
    expect(box.querySelector('pre.raw-text')?.textContent).toBe('line 1\nline 2');
    expect(box.querySelector('.raw-note')?.textContent).toBe('Showing the start only — the full output is 1.2 MiB');
  });

  it('size defaults to the text’s UTF-8 size; copied shows a check; a note and Retry when asked', () => {
    const box = dom(
      rawViewHtml(
        { state: 'ready', text: 'héllo', note: 'From the stored copy', canRetry: true },
        { keyPrefix: 'k', copied: true },
      ),
    );
    expect(box.querySelector('.raw-size')?.textContent).toBe('6 B');
    const copy = box.querySelector('.raw-copy')!;
    expect(copy.textContent).toBe('Copied');
    expect(copy.hasAttribute('data-copied')).toBe(true);
    expect(copy.querySelector('svg[data-icon="check"]')).not.toBeNull();
    expect(box.querySelector('.raw-retry')?.textContent).toBe('Retry');
    expect(box.querySelector('.raw-note')?.textContent).toBe('From the stored copy');
  });

  it('calm lines for loading / missing / denied / error (Retry by default only on error)', () => {
    const at = (state: 'loading' | 'missing' | 'denied' | 'error') => dom(rawViewHtml({ state }, { keyPrefix: 'p' }));
    const loading = at('loading');
    expect(loading.querySelector('.raw')?.getAttribute('aria-busy')).toBe('true');
    expect(loading.querySelector('.raw-spin')).not.toBeNull();
    expect(loading.textContent).toBe('Loading output…');
    expect(at('missing').textContent).toBe('This output was not saved');
    expect(at('denied').textContent).toBe('Only the owner can see this output');
    expect(at('missing').querySelector('.raw-retry')).toBeNull();
    const error = at('error');
    expect(error.querySelector('.raw-line')?.textContent).toBe('Couldn’t load the output' + 'Retry');
    expect(error.querySelector('.raw-retry')?.getAttribute('data-key')).toBe('p:retry');
    expect(
      dom(rawViewHtml({ state: 'error', canRetry: false }, { keyPrefix: 'p' })).querySelector('.raw-retry'),
    ).toBeNull();
    expect(dom(rawViewHtml({ state: 'missing', note: 'Gone' }, { keyPrefix: 'p' })).textContent).toBe('Gone');
  });

  it('an unknown state or no view reads as missing; an explicit 0 bytes stays 0', () => {
    const odd = { state: 'weird' } as unknown as Parameters<typeof rawViewHtml>[0];
    expect(
      dom(rawViewHtml(odd, { keyPrefix: 'p' }))
        .querySelector('.raw')
        ?.getAttribute('data-state'),
    ).toBe('missing');
    expect(
      dom(rawViewHtml(undefined as unknown as Parameters<typeof rawViewHtml>[0], { keyPrefix: 'p' })).textContent,
    ).toBe('This output was not saved');
    expect(
      dom(rawViewHtml({ state: 'ready', text: 'abc', bytes: 0 }, { keyPrefix: 'p' })).querySelector('.raw-size')
        ?.textContent,
    ).toBe('0 B');
  });

  it('escapes text and note; ko strings', () => {
    const box = dom(rawViewHtml({ state: 'ready', text: XSS, note: XSS }, { keyPrefix: XSS, lang: 'ko' }));
    expect(box.querySelector('img')).toBeNull();
    expect(box.querySelector('pre')?.textContent).toBe(XSS);
    expect(box.querySelector('.raw-note')?.textContent).toBe(XSS);
    expect(box.querySelector('.raw-copy')?.textContent).toBe('복사');
    expect(dom(rawViewHtml({ state: 'error' }, { keyPrefix: 'p', lang: 'ko' })).textContent).toBe(
      '원본 출력을 불러오지 못했어요다시 시도',
    );
    expect(
      dom(
        rawViewHtml({ state: 'ready', text: 'x', truncated: true, bytes: 2048 }, { keyPrefix: 'p', lang: 'ko' }),
      ).querySelector('.raw-note')?.textContent,
    ).toBe('앞부분만 표시 — 원본 2.0 KiB');
  });
});

describe('activityCss', () => {
  it('hover is gated to fine pointers; presses scale only without reduced motion', () => {
    const hover = activityCss.indexOf('@media (hover: hover) and (pointer: fine)');
    expect(hover).toBeGreaterThan(-1);
    expect(activityCss.indexOf(':hover')).toBeGreaterThan(hover);
    expect(activityCss).toContain(':active:not(:disabled):not(:focus-visible) { transform: scale(0.97); }');
    expect(activityCss).toMatch(/prefers-reduced-motion: reduce\)[^@]*transform: none/);
    expect(activityCss).not.toMatch(/font-weight: (?:[1-4]\d\d|[89]\d\d)\b/);
  });

  it('tokens and color-mix only — no hex or rgba literals', () => {
    expect(activityCss).toContain('.sys-badge');
    expect(activityCss).toContain('.skill-badge');
    expect(activityCss).toContain('.raw-text');
    expect(activityCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(activityCss).not.toMatch(/rgba?\(/);
  });
});
