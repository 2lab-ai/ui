/** Documentation + demo contract every component ships in `src/components/<slug>/docs.ts`. The demo site renders it. */
export interface PropDoc {
  /** Property (or attribute) name. Nested data fields use dot paths: `data.parts.cacheRead`. */
  name: string;
  type: string;
  default?: string;
  required?: boolean;
  description: string;
}

export interface EventDoc {
  name: string;
  /** TypeScript shape of `event.detail`. */
  detail: string;
  description: string;
}

export interface DemoDoc {
  id: string;
  title: string;
  description?: string;
  /** Preview area height in px (desktop). Default 420. */
  height?: number;
  /** Put the element on a card surface in the preview (default: true for Components, false for Screens). */
  frame?: boolean;
  /** Build a fresh element (with data) for the preview. Must not touch the network. */
  create(): HTMLElement;
}

export interface ComponentDoc {
  slug: string;
  name: string;
  tag: string;
  /** One sentence: what decision this component gives the person. */
  summary: string;
  /** Longer intro shown under the title. */
  description: string;
  /** Where it lives in the soma-work dashboard. */
  usedIn: string;
  reference: { name: string; url: string };
  /**
   * Group in the sidebar. Pages are the parts of the pages around an app (settings, memory, sign-in); Primitives are
   * the building blocks (menus, dialogs, tabs …) the components share.
   */
  group: 'Components' | 'Screens' | 'Pages' | 'Primitives';
  props: PropDoc[];
  events: EventDoc[];
  keyboard: Array<[keys: string, action: string]>;
  a11y: string[];
  /** Short usage snippet (HTML + JS) shown in the Code tab. */
  usage: string;
  demos: DemoDoc[];
}
