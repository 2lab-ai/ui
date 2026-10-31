// A CommonJS TypeScript server (module commonjs, moduleResolution node10): the root resolves through "types", the
// server entry through "typesVersions" — the one subpath such a server needs.
import { fmtTokens } from '@2lab.ai/ui';
import { type AuthCardData, authCardCss, authCardHtml, icon, tokensCss } from '@2lab.ai/ui/server';

const data: AuthCardData = { title: 'Sign in', providers: [{ id: 'sso', label: 'Continue', href: '/auth/sso' }] };
console.log(
  fmtTokens(1500),
  authCardHtml(data, { page: true }).length,
  authCardCss.length,
  tokensCss.length,
  icon('user').length,
);
