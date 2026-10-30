// @vitest-environment node
import { describe, expect, it } from 'vitest';

/**
 * The server entry loads on plain Node: no DOM at all in this file's environment, so anything that touched
 * `HTMLElement`, `customElements`, `document` or `window` at import time would throw here.
 */
describe('@2lab.ai/ui/server', () => {
  it('runs without a DOM', () => {
    expect(typeof (globalThis as { HTMLElement?: unknown }).HTMLElement).toBe('undefined');
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
  });

  it('renders the auth card, its sheet, the tokens, the kit and the icons', async () => {
    const s = await import('./index');
    const html = s.authCardHtml(
      {
        brand: { label: 'Workbench', mark: true },
        title: 'Sign in',
        providers: [{ id: 'google', label: 'Continue with Google', href: '/auth/google' }],
      },
      { lang: 'ko', page: true, theme: 'dark' },
    );
    expect(html.startsWith('<ui-auth-card lang="ko" page theme="dark"><template shadowrootmode="open"><style>')).toBe(
      true,
    );
    expect(html).toContain(`<style>${s.authCardCss}</style>`);
    expect(html).toContain('href="/auth/google"');
    expect(html).toContain('<script type="application/json" data-auth-state>');
    expect(s.authCardCss.startsWith(s.baseCss)).toBe(true);
    expect(s.authCardCss).toContain('.ac-card {');
    expect(s.authCardMarkup({ title: 'Hi' })).toContain('<h1 class="ac-title">Hi</h1>');
    expect(s.authStateJson({ title: '</script>' })).toBe('{"title":"\\u003c/script>"}');
    expect(s.authInitials('mina.park@example.com')).toBe('MP');
    expect(s.authStrings('ko').cancel).toBe('취소');
    expect(s.tokensCss).toContain('--ui-text:');
    expect(s.kitCss).toContain('.ui-btn');
    expect(s.icon('user')).toMatch(/^<svg/);
    expect(s.esc('<b>')).toBe('&lt;b&gt;');
  });

  it('defines no element (that is the auth-card entry)', async () => {
    const s = (await import('./index')) as Record<string, unknown>;
    expect(s.UiAuthCard).toBeUndefined();
    expect(s.define).toBeUndefined();
  });
});
