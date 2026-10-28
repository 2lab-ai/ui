/**
 * Bring live markup in line with freshly rendered markup, keeping every node whose place did not change — so focus,
 * a running spinner's rotation and a CSS transition survive a live update. An element with `data-key` pairs only with
 * the element of the same tag and key; any other node pairs, in order, with one of the same tag and first class.
 */
function sig(n: Node): string {
  if (n.nodeType !== 1) return `#${n.nodeType}`;
  const el = n as Element;
  const key = el.getAttribute('data-key');
  if (key !== null) return `${el.tagName}|@${key}`;
  const c = el.getAttribute('class') ?? '';
  const sp = c.indexOf(' ');
  return `${el.tagName}|${sp < 0 ? c : c.slice(0, sp)}`;
}

function morphNode(a: Node, b: Node): void {
  if (a.nodeType !== 1) {
    if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
    return;
  }
  // An unchanged subtree (the common case: one agent's numbers moved) is skipped in one native compare.
  if (a.isEqualNode(b)) return;
  const ea = a as Element;
  const eb = b as Element;
  for (const at of Array.from(ea.attributes)) if (!eb.hasAttribute(at.name)) ea.removeAttribute(at.name);
  for (const at of Array.from(eb.attributes))
    if (ea.getAttribute(at.name) !== at.value) ea.setAttribute(at.name, at.value);
  morphChildren(ea, eb);
}

/** Morph `from`'s children into `to`'s (`to` is consumed: its unmatched nodes move into `from`). */
export function morphChildren(from: Node, to: Node): void {
  const pool = new Map<string, Node[]>();
  for (let c = from.firstChild; c; c = c.nextSibling) {
    const s = sig(c);
    const list = pool.get(s);
    if (list) list.push(c);
    else pool.set(s, [c]);
  }
  const want: Node[] = [];
  for (let c = to.firstChild; c; ) {
    const next = c.nextSibling;
    const old = pool.get(sig(c))?.shift();
    if (old) {
      morphNode(old, c);
      want.push(old);
    } else want.push(c);
    c = next;
  }
  for (const list of pool.values()) for (const n of list) from.removeChild(n);
  let cur = from.firstChild;
  for (const n of want) {
    if (n === cur) {
      cur = cur.nextSibling;
      continue;
    }
    from.insertBefore(n, cur);
  }
}
