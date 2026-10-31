/**
 * `@2lab.ai/ui/server` — what a server renders without a DOM: the auth card's markup for a page that works before
 * (and without) the script, its stylesheet as data, the page tokens and the kit sheet, and the icon set. No element
 * is defined here and nothing touches `HTMLElement` or `customElements` at load, so it imports (`import`) and
 * requires (`require`, the `.cjs` build) on Node alike. The same functions are exported from `@2lab.ai/ui/auth-card`
 * for a page that also registers the element.
 */
export type {
  AuthAccount,
  AuthCardData,
  AuthConfirm,
  AuthConfirmDetail,
  AuthLang,
  AuthLink,
  AuthNavigateDetail,
  AuthProvider,
  AuthProviderDetail,
  AuthSignedIn,
  AuthStrings,
} from '../components/auth-card/markup';
export {
  authCardCss,
  authCardHtml,
  authCardMarkup,
  authInitials,
  authInline,
  authStateJson,
  authStrings,
} from '../components/auth-card/markup';
export { esc, escAttr, safeHref, safeLink, safeSrc } from '../core/html';
export { baseCss, DARK, LIGHT, SHARED, tokensCss } from '../core/tokens';
export type { IconName, IconOptions } from '../icons/icons';
export { hasIcon, ICON_ALIASES, ICON_NAMES, icon, iconName } from '../icons/icons';
export { KIT_CLASSES, kitCss } from '../kit/kit';
