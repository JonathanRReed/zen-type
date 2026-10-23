// Independent Astro islands can attach effects in any order. Readiness means
// these eager handlers are listening, not that deferred panel bodies loaded.
const REQUIRED = ['typing', 'shortcuts', 'help', 'pause', 'archive', 'progress'] as const;
type InteractivePart = typeof REQUIRED[number];
const documents = new WeakMap<Document, Map<InteractivePart, Set<symbol>>>();

export function markInteractiveReady(part: InteractivePart): () => void {
  if (typeof document === 'undefined') return () => {};
  const doc = document;
  let parts = documents.get(doc);
  if (!parts) {
    parts = new Map();
    documents.set(doc, parts);
    const current = parts;
    doc.addEventListener('astro:before-swap', () => {
      current.clear();
      doc.documentElement.removeAttribute('data-app-ready');
    });
  }
  const current = parts;
  const sync = () => {
    if (REQUIRED.every(key => current.get(key)?.size)) doc.documentElement.setAttribute('data-app-ready', '1');
    else doc.documentElement.removeAttribute('data-app-ready');
  };
  let owners = current.get(part);
  if (!owners) {
    owners = new Set();
    current.set(part, owners);
  }
  const token = Symbol(part);
  owners.add(token);
  sync();
  return () => {
    owners.delete(token);
    sync();
  };
}
