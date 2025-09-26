/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getJSON, setJSON, getSettings, DEFAULT_SETTINGS } from '../storage';

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage.store[key];
  }),
  clear: vi.fn(() => {
    mockLocalStorage.store = {};
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('Storage Utilities', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('getJSON', () => {
    it('returns fallback when localStorage is unavailable', () => {
      // @ts-ignore
      const originalLocalStorage = window.localStorage;
      // @ts-ignore
      window.localStorage = undefined;

      const result = getJSON('test', 'fallback');
      expect(result).toBe('fallback');

      // @ts-ignore
      window.localStorage = originalLocalStorage;
    });

    it('returns fallback when key does not exist', () => {
      const result = getJSON('nonexistent', 'fallback');
      expect(result).toBe('fallback');
    });

    it('returns parsed JSON when key exists', () => {
      const testData = { name: 'test', value: 123 };
      setJSON('test', testData);

      const result = getJSON('test', 'fallback');
      expect(result).toEqual(testData);
    });

    it('returns fallback when JSON is invalid', () => {
      mockLocalStorage.setItem('invalid', '{ invalid json }');

      const result = getJSON('invalid', 'fallback');
      expect(result).toBe('fallback');
    });
  });

  describe('setJSON', () => {
    it('stores data as JSON string', () => {
      const testData = { name: 'test', value: 123 };
      setJSON('test', testData);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'test',
        JSON.stringify(testData)
      );
    });

    it('handles localStorage unavailable gracefully', () => {
      // @ts-ignore
      const originalLocalStorage = window.localStorage;
      // @ts-ignore
      window.localStorage = undefined;

      expect(() => setJSON('test', 'data')).not.toThrow();

      // @ts-ignore
      window.localStorage = originalLocalStorage;
    });
  });

  describe('getSettings', () => {
    it('returns default settings when no stored settings exist', () => {
      const settings = getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('merges stored settings with defaults', () => {
      const partialSettings = { theme: 'Forest' as const, showStats: false };
      setJSON('zt.settings', partialSettings);

      const settings = getSettings();
      expect(settings.theme).toBe('Forest');
      expect(settings.showStats).toBe(false);
      expect(settings.reducedMotion).toBe(DEFAULT_SETTINGS.reducedMotion);
    });

    it('migrates legacy Plain theme to Void', () => {
      setJSON('zt.settings', { theme: 'Plain' as any });

      const settings = getSettings();
      expect(settings.theme).toBe('Void');
    });

    it('validates theme values', () => {
      setJSON('zt.settings', { theme: 'InvalidTheme' as any });

      const settings = getSettings();
      expect(settings.theme).toBe('Void');
    });
  });
});
