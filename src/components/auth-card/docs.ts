import type { ComponentDoc } from '../../docs/types';
import './auth-card';
import type { AuthCardData, UiAuthCard } from './auth-card';
import { authCardHtml } from './auth-card';

/** Provider logos stay the provider's own colours, so the host slots them (`slot="logo-<id>"`). */
const LOGOS: Record<string, string> = {
  google:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
  microsoft:
    '<svg viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>',
};

function make(data: AuthCardData, attrs: Record<string, string> = {}, logos: string[] = []): UiAuthCard {
  const el = document.createElement('ui-auth-card');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const id of logos) {
    const box = document.createElement('span');
    box.innerHTML = LOGOS[id] ?? '';
    const svg = box.firstElementChild;
    if (svg) {
      svg.setAttribute('slot', `logo-${id}`);
      el.append(svg);
    }
  }
  el.data = data;
  // The demo never leaves the page: the element holds ("Redirecting…") as it would, the click's navigation is
  // stopped at the host, and a moment later the card is free again.
  el.addEventListener('click', (e) => e.preventDefault());
  el.addEventListener('ui-provider', () => setTimeout(() => el.renderNow(), 1600));
  el.addEventListener('ui-navigate', (e) => e.preventDefault());
  el.addEventListener('ui-confirm', (e) => e.preventDefault());
  return el;
}

/** Wrap the card on the page colour, as a sign-in page would show it. */
function stage(el: HTMLElement): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'display:grid;place-items:center;min-height:100%;padding:28px 16px;box-sizing:border-box;';
  box.append(el);
  el.style.width = '100%';
  return box;
}

const PROVIDERS: AuthCardData['providers'] = [
  { id: 'google', label: 'Continue with Google', href: '/auth/google' },
  { id: 'microsoft', label: 'Continue with Microsoft', href: '/auth/microsoft' },
];

const SIGN_IN: AuthCardData = {
  brand: { label: 'Workbench', mark: true, href: '/' },
  title: 'Sign in',
  text: 'Use the work account your team signs in with.',
  providers: PROVIDERS,
  hint: 'In a chat thread, type `login` to get a one-time sign-in link.',
  finePrint: 'Only accounts your workspace knows can sign in.',
};

export const doc: ComponentDoc = {
  slug: 'auth-card',
  name: 'Auth Card',
  tag: 'ui-auth-card',
  summary:
    'Who are you signing in as? — one calm card: the providers, the account you have, or the session you are about to switch to.',
  description:
    'A centred card for the pages around an app. Signed out, it lists the sign-in providers as full-width buttons, with another way in under an “or” divider. Signed in, it shows the account first — Continue is the one ink button, Sign out stays quiet — and the providers follow under “Use a different account”. The confirm variant names the session that ends and the one that starts, and posts a real form. Provider buttons are real links and the form a real form, and `authCardHtml(data)` renders the card on the server as a declarative shadow root, so the page works before (and without) the script; the element takes over in place from the JSON it carries. After a press the chosen button reads “Redirecting…” and the others step back, so a second press cannot start a second sign-in; coming back through the back button frees the card.',
  usedIn: 'soma-work sign-in page (/login) and the SSO session-switch confirm page (M-09, M-10).',
  reference: { name: 'Sign-in card', url: 'https://www.affectui.com' },
  group: 'Pages',
  props: [
    {
      name: 'data.brand',
      type: '{ label: string; mark?: boolean | IconName; href?: string }',
      description:
        'The product above the card: a word, a glyph tile (`true` = the library mark) and a link. Or use slot `brand`.',
    },
    { name: 'data.title', type: 'string', description: 'The heading (an h1 — the page’s heading).' },
    {
      name: 'data.text',
      type: 'string',
      description: 'One short paragraph under the heading; `code` in backticks is set in mono.',
    },
    {
      name: 'data.error',
      type: 'string',
      description: 'Why the last attempt failed — an alert line at the top of the card.',
    },
    {
      name: 'data.providers',
      type: 'AuthProvider[]',
      description:
        '`{ id, label, href, icon?, logo? }` — full-width link buttons. `icon` is a library glyph, `logo` an image URL (http(s), same-site or a raster data URL); a multi-colour SVG goes in slot `logo-<id>`.',
    },
    { name: 'data.hint', type: 'string', description: 'Another way in, under an “or” divider after the providers.' },
    {
      name: 'data.account',
      type: 'AuthSignedIn',
      description:
        '`{ name, meta?, initials?, continue?: { href, label? }, signOut?: { href, label? } }` — signed in already: the account first, then the providers under `switchLabel`.',
    },
    {
      name: 'data.switchLabel',
      type: 'string',
      default: '"Use a different account"',
      description: 'The divider above the providers when `account` is set.',
    },
    {
      name: 'data.confirm',
      type: 'AuthConfirm',
      description:
        '`{ from?, to, action, method?, fields?, confirmLabel?, cancelLabel?, cancelHref? }` — the session-switch variant: both sessions, then Cancel · Continue as <name> (a real form with hidden `fields`).',
    },
    {
      name: 'data.finePrint',
      type: 'string',
      description: 'Small print under the card. Slot `fine-print` takes rich content.',
    },
    { name: 'lang', type: '"en" | "ko"', default: '"en"', description: 'Built-in words.' },
    {
      name: 'page',
      type: 'boolean attribute',
      description: 'Fill the viewport and centre on the page colour (a whole sign-in page).',
    },
    { name: 'busy', type: 'boolean (read-only)', description: 'A sign-in or a switch is on its way.' },
    {
      name: 'authCardHtml(data, { lang?, page?, theme? })',
      type: 'string',
      description:
        'Server-side markup: the element with a declarative shadow root (styles + card) and the data as JSON.',
    },
  ],
  events: [
    {
      name: 'ui-provider',
      detail: '{ id: string; href: string }',
      description:
        'A provider button was pressed. Cancelable: prevent it to start the sign-in yourself (a popup); otherwise the link navigates and the card shows “Redirecting…”.',
    },
    {
      name: 'ui-navigate',
      detail: "{ id: 'brand' | 'continue' | 'sign-out' | 'cancel'; href: string | null }",
      description: 'One of the card’s own links. Cancelable (prevent it to route in-app).',
    },
    {
      name: 'ui-confirm',
      detail: '{ action: string; fields: Record<string, string> }',
      description:
        'The session switch was confirmed. Cancelable: prevent it to post yourself; otherwise the form submits and the button shows “Switching…”.',
    },
  ],
  keyboard: [
    ['Tab', 'Brand, then each button in order (providers, continue, sign out; cancel, confirm).'],
    ['Enter', 'Follow the focused link / submit the form.'],
  ],
  a11y: [
    'The title is an h1; the error is role="alert" with an icon and words.',
    'Provider buttons are links with their words as the name; logos are decorative.',
    'While a sign-in is on its way the pressed button is aria-busy with “Redirecting…”, the others aria-disabled.',
    'The two sessions are a list with “Signed in now” / “New session” before each name — never colour alone.',
    'Works without JavaScript when rendered with authCardHtml (declarative shadow DOM, real links and form).',
    'Sound (opt-in, @2lab.ai/ui/sound): a provider, the brand, Continue, Sign out and Cancel play navigate — also when the host cancels ui-provider / ui-navigate to take the sign-in or the route over; confirming a session switch plays tap once ui-confirm does. Silent until the page turns sound on.',
  ],
  usage: `<ui-auth-card page></ui-auth-card>
<script type="module">
  import '@2lab.ai/ui/auth-card';
  const card = document.querySelector('ui-auth-card');
  card.data = {
    brand: { label: 'Workbench', mark: true, href: '/' },
    title: 'Sign in',
    providers: [{ id: 'google', label: 'Continue with Google', href: '/auth/google' }],
    hint: 'In a chat thread, type \`login\` to get a one-time link.',
    error: new URLSearchParams(location.search).get('error') ? 'Sign-in was cancelled.' : undefined,
  };
</script>

// Server: the same card, working before (and without) the script.
import { authCardHtml } from '@2lab.ai/ui/auth-card';
res.send(\`<!doctype html><link rel="stylesheet" href="/tokens.css">\${authCardHtml(data, { page: true })}
<script type="module" src="/ui/auth-card.js"></script>\`);`,
  demos: [
    {
      id: 'sign-in',
      title: 'Sign in',
      description:
        'Providers as full-width links (the logos are slotted), another way in under “or”, small print. Press one: it reads “Redirecting…” for a moment.',
      height: 560,
      frame: false,
      create: () => stage(make(SIGN_IN, {}, ['google', 'microsoft'])),
    },
    {
      id: 'signed-in',
      title: 'Signed in already',
      description:
        'The account comes first — Continue is the one ink button — and the providers follow under “Use a different account”.',
      height: 640,
      frame: false,
      create: () =>
        stage(
          make(
            {
              brand: { label: 'Workbench', mark: true, href: '/' },
              account: {
                name: 'Mina Park',
                meta: 'mina@example.com · via Google',
                continue: { href: '/app', label: 'Continue to the workbench' },
                signOut: { href: '/logout' },
              },
              providers: PROVIDERS,
              hint: 'In a chat thread, type `login` to get a one-time sign-in link.',
            },
            {},
            ['google', 'microsoft'],
          ),
        ),
    },
    {
      id: 'switch',
      title: 'Confirm a session switch',
      description:
        'A one-time link would replace the session this browser has: both sessions, then Cancel · Continue as … (a real form).',
      height: 520,
      frame: false,
      create: () =>
        stage(
          make({
            brand: { label: 'Workbench', mark: true },
            title: 'Switch accounts?',
            text: 'This link signs this browser in as someone else. Your current session ends.',
            confirm: {
              from: { name: 'Mina Park', meta: 'mina@example.com' },
              to: { name: 'Jon Lee', meta: 'jon@example.com' },
              action: '/auth/switch',
              fields: { token: 'one-time-token' },
              cancelHref: '/app',
            },
          }),
        ),
    },
    {
      id: 'error-ko',
      title: 'An error, in Korean',
      description: 'lang="ko" — the alert line sits at the top of the card; the hint keeps its code span.',
      height: 560,
      frame: false,
      create: () =>
        stage(
          make(
            {
              brand: { label: 'Workbench', mark: true, href: '/' },
              title: '로그인',
              text: '팀에서 쓰는 업무 계정으로 로그인하세요.',
              error: '로그인 링크가 만료되었습니다. 새 링크를 받아 다시 시도하세요.',
              providers: [
                { id: 'google', label: 'Google로 계속', href: '/auth/google' },
                { id: 'microsoft', label: 'Microsoft로 계속', href: '/auth/microsoft' },
              ],
              hint: '채팅 스레드에서 `login`을 입력하면 일회용 로그인 링크를 받습니다.',
            },
            { lang: 'ko' },
            ['google', 'microsoft'],
          ),
        ),
    },
    {
      id: 'server',
      title: 'Server-rendered',
      description:
        'authCardHtml(data) → the element, a declarative shadow root and its data as JSON. A server page shows it before any script runs; here the element upgrades from the JSON it carries.',
      height: 480,
      frame: false,
      create: () => {
        const box = document.createElement('div');
        box.innerHTML = authCardHtml({
          brand: { label: 'Workbench', mark: true },
          title: 'Sign in',
          providers: [{ id: 'sso', label: 'Continue with single sign-on', href: '/auth/sso', icon: 'user' }],
          finePrint: 'Works with JavaScript off: the button is a link.',
        });
        const el = box.firstElementChild as HTMLElement;
        el.addEventListener('click', (e) => e.preventDefault());
        return stage(el);
      },
    },
  ],
};
