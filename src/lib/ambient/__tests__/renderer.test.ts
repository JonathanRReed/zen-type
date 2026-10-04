import { describe, it, expect } from 'vitest';
import { resolveColor } from '../renderer';

describe('resolveColor', () => {
  it('returns rgb triple for valid CSS colors', () => {
    // Probe element works with CSS rgb/hex values in JSDOM or returns fallback
    const result = resolveColor('#ff0000', [0, 0, 0]);
    expect(result).toHaveLength(3);
    expect(result.every(v => typeof v === 'number' && v >= 0 && v <= 1)).toBe(true);
  });

  it('reuses the probe element on repeated calls', () => {
    const c1 = resolveColor('rgb(100, 150, 200)', [0, 0, 0]);
    const c2 = resolveColor('rgb(50, 100, 150)', [0, 0, 0]);
    expect(c1).toEqual([100 / 255, 150 / 255, 200 / 255]);
    expect(c2).toEqual([50 / 255, 100 / 255, 150 / 255]);
    // Ensure only 1 span element was created for probe
    const probes = document.querySelectorAll('span[style*="visibility: hidden"]');
    expect(probes.length).toBe(1);
  });
});

it('does not reuse the previous color when the next CSS value is invalid', () => {
  resolveColor('rgb(255, 0, 0)', [0, 0, 0]);
  expect(resolveColor('not-a-css-color', [0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
});
