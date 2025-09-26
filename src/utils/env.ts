export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function safeDocument(): Document | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  return document;
}

export function safeWindow(): Window | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window;
}
