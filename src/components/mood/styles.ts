/**
 * `<ui-mood>`: a plain block around the host's markup; it draws nothing, it only reads and sets `mood` / `--mood`.
 * The host's own type and colour pass through untouched (the base sheet's 14 px and ink would otherwise be inherited
 * by everything wrapped).
 */
export const styles = `
:host { display: block; --mood: 0; }
/* the base sheet's theme rules set color-scheme on the host; these win over them (same weight, later) */
:host, :host(:not([theme="light"])), :host([theme="dark"]) { color: inherit; font: inherit; letter-spacing: inherit; color-scheme: inherit; }
.ui-root { display: contents; }
`;
