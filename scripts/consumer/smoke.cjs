// CommonJS runtime smoke, no DOM: require('@2lab.ai/ui/server') takes the `require` condition (dist/server.cjs) and
// renders the auth card on plain Node; the `import` condition (dist/server.js) loads here too and renders the same.
// Neither defines an element — that is the auth-card entry's job on the page.
const assert = require('node:assert/strict');

assert.equal(typeof globalThis.HTMLElement, 'undefined', 'smoke.cjs needs a DOM-less Node');
const s = require('@2lab.ai/ui/server');
assert.match(
  require.resolve('@2lab.ai/ui/server'),
  /[\\/]dist[\\/]server\.cjs$/,
  'require did not take dist/server.cjs',
);
const data = {
  brand: { label: 'Workbench', mark: true },
  title: 'Sign in',
  providers: [{ id: 'google', label: 'Continue with Google', href: '/auth/google' }],
};
const html = s.authCardHtml(data, { page: true, lang: 'ko' });
assert.ok(html.startsWith('<ui-auth-card lang="ko" page>'), 'authCardHtml did not render the element');
assert.ok(html.includes(`<style>${s.authCardCss}</style>`), 'the declarative root does not carry authCardCss');
assert.ok(html.includes('href="/auth/google"'), 'the provider link is missing');
assert.ok(s.tokensCss.includes('--ui-text:') && s.kitCss.includes('.ui-btn'), 'tokensCss / kitCss did not load');
assert.ok(s.icon('user').startsWith('<svg'), 'icon() did not load');
assert.equal(s.esc('<b>'), '&lt;b&gt;');
assert.equal(s.UiAuthCard, undefined, 'the server entry must define no element');
assert.equal(typeof globalThis.customElements, 'undefined', 'the server entry touched the DOM');

import('@2lab.ai/ui/server').then((m) => {
  assert.equal(m.authCardHtml(data, { page: true, lang: 'ko' }), html, 'ESM and CommonJS builds render differently');
  console.log(
    `smoke.cjs: require('@2lab.ai/ui/server') → dist/server.cjs, import → the same markup; authCardHtml ${html.length} chars, no element defined`,
  );
});
