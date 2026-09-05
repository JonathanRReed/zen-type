import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';

// A real Storage implementation for the tests. jsdom's own localStorage is
// not reliably exposed under every runner, and a no-op mock would hide the
// persistence bugs these tests exist to catch.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.has(key) ? this.map.get(key)! : null; }
  key(index: number): string | null { return Array.from(this.map.keys())[index] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(String(key), String(value)); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true });

beforeEach(() => {
  storage.clear();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

global.ResizeObserver = class ResizeObserver {
  constructor(_cb: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
