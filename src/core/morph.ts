/**
 * Bring a live subtree in line with freshly rendered markup, keeping every node whose place did not change —
 * so focus, a running transition (the menu's open/close, the effort thumb) and live-region text nodes survive
 * a re-render. Ported from the soma-work dashboard's `morphInnerHtml` (spec 12).
 *
 * Children pair up in order. A node with `data-mk` pairs only with the node of the same key (a row that stands
 * for one model never turns into another model's row); unkeyed nodes pair by tag + id + first class.
 */
export function morphInto(el: Element, html: string): void {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  morphChildren(el, tpl.content);
}

function keyOf(n: Node): string {
  if (n.nodeType !== 1) return `#${n.nodeType}`;
  const e = n as Element;
  const k = e.getAttribute('data-mk');
  if (k !== null) return `${e.tagName}|@${k}`;
  const c = e.getAttribute('class') || '';
  const sp = c.indexOf(' ');
  return `${e.tagName}|${e.id}.${sp < 0 ? c : c.slice(0, sp)}`;
}

function keyLater(n: Node | null, key: string): boolean {
  for (; n; n = n.nextSibling) if (keyOf(n) === key) return true;
  return false;
}

function morphNode(a: Node, b: Node): void {
  if (a.nodeType !== 1) {
    if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
    return;
  }
  const ae = a as Element;
  const be = b as Element;
  for (let i = ae.attributes.length - 1; i >= 0; i--) {
    const name = ae.attributes[i].name;
    if (!be.hasAttribute(name)) ae.removeAttribute(name);
  }
  for (let i = 0; i < be.attributes.length; i++) {
    const at = be.attributes[i];
    if (ae.getAttribute(at.name) !== at.value) ae.setAttribute(at.name, at.value);
  }
  morphChildren(ae, be);
}

function morphChildren(a: Node, b: Node): void {
  let cur = a.firstChild;
  let next = b.firstChild;
  while (next) {
    // A live node the fresh markup no longer has goes first, so the nodes after it still pair with their own.
    if (cur && keyOf(cur) !== keyOf(next) && !keyLater(next, keyOf(cur))) {
      const dropped = cur;
      cur = cur.nextSibling;
      a.removeChild(dropped);
      continue;
    }
    const after: ChildNode | null = next.nextSibling;
    if (cur && keyOf(cur) === keyOf(next)) {
      morphNode(cur, next);
      cur = cur.nextSibling;
    } else {
      a.insertBefore(next, cur);
    }
    next = after;
  }
  while (cur) {
    const gone = cur;
    cur = cur.nextSibling;
    a.removeChild(gone);
  }
}
