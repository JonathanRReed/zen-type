// A 1200x630 PNG of a finished quote, drawn on a canvas in the current
// theme's colours and the site's own typefaces. Saved straight from the
// browser; nothing is uploaded.

import { splitSource } from './quotes';

export interface ShareCardInput {
  timeSec: number;
  wpm: number;
  accuracy: number;
  streak?: number;
  quote: string;
  author?: string;
  source?: string;
  bestWpm?: boolean;
}

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 84;

const SERIF = "'Newsreader', 'Iowan Old Style', Palatino, Georgia, serif";
const SANS = "'Hanken Grotesk', 'Avenir Next', 'Segoe UI', system-ui, sans-serif";

const cssVar = (name: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

/**
 * A colour at reduced opacity. Canvas does not take color-mix() everywhere,
 * and the theme colours are plain hex, so this does the arithmetic itself.
 */
function alpha(color: string, opacity: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) return opacity > 0.5 ? color : 'rgba(128, 128, 128, 0.5)';
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

const formatTime = (sec: number): string => {
  const total = Math.max(0, Math.round(sec));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The largest type size at which the quote fits the space above the figures. */
function fitQuote(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxHeight: number): { size: number; lines: string[] } {
  for (const size of [58, 52, 46, 40, 35, 30, 26]) {
    ctx.font = `400 ${size}px ${SERIF}`;
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length * size * 1.3 <= maxHeight) return { size, lines };
  }
  ctx.font = `400 24px ${SERIF}`;
  const lines = wrap(ctx, text, maxWidth);
  const max = Math.max(1, Math.floor(maxHeight / (24 * 1.3)));
  if (lines.length > max) {
    lines.length = max;
    lines[max - 1] = `${(lines[max - 1] ?? '').replace(/\s+\S*$/, '')}…`;
  }
  return { size: 24, lines };
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, caret: string): void {
  const rect = (rx: number, ry: number, w: number, h: number, r: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x + rx * scale, y + ry * scale, w * scale, h * scale, r * scale);
    ctx.fill();
  };
  rect(1, 5, 11, 5, 1.6, '#7a7c9c');
  rect(20, 5, 11, 5, 1.6, '#a678e6');
  rect(1, 16, 11, 5, 1.6, '#e0527f');
  rect(20, 16, 11, 5, 1.6, '#f0b24d');
  rect(15.1, 1, 1.8, 24, 0.9, caret);
}

function renderShareCard(input: ShareCardInput): HTMLCanvasElement {
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * scale;
  canvas.height = HEIGHT * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  const floor = cssVar('--scene-floor', '#05040a');
  const base = cssVar('--rp-base', '#191724');
  const ink = cssVar('--rp-text', '#f1ece2');
  const accent = cssVar('--theme-accent', '#c4a7e7');
  const gold = cssVar('--rp-gold', '#f6c177');
  const mix = (percent: number) => alpha(ink, percent / 100);

  // Ground: the scene's floor rising to its base, with one soft light.
  const ground = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  ground.addColorStop(0, base);
  ground.addColorStop(1, floor);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const light = ctx.createRadialGradient(WIDTH * 0.24, -40, 0, WIDTH * 0.24, -40, 760);
  light.addColorStop(0, alpha(accent, 0.3));
  light.addColorStop(1, alpha(accent, 0));
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textBaseline = 'alphabetic';

  // Wordmark
  drawMark(ctx, MARGIN, 62, 1.15, ink);
  ctx.fillStyle = ink;
  ctx.font = `500 28px ${SERIF}`;
  ctx.fillText('Zen Typer', MARGIN + 50, 86);
  ctx.textAlign = 'right';
  ctx.fillStyle = mix(52);
  ctx.font = `400 19px ${SANS}`;
  ctx.fillText('zentype.jonathanrreed.com', WIDTH - MARGIN, 85);
  ctx.textAlign = 'left';

  // Figures along the bottom, above a hairline.
  const figureBase = HEIGHT - 76;
  const figures: Array<[string, string]> = [
    [String(Math.round(input.wpm)), 'words a minute'],
    [`${Math.round(input.accuracy)}%`, 'accuracy'],
    [formatTime(input.timeSec), 'time'],
  ];
  if (input.streak && input.streak > 1) figures.push([String(input.streak), 'days in a row']);
  let x = MARGIN;
  for (const [value, label] of figures) {
    ctx.fillStyle = ink;
    ctx.font = `400 62px ${SERIF}`;
    ctx.fillText(value, x, figureBase);
    const valueWidth = ctx.measureText(value).width;
    ctx.fillStyle = mix(52);
    ctx.font = `400 19px ${SANS}`;
    ctx.fillText(label, x + 2, figureBase + 32);
    x += Math.max(valueWidth, ctx.measureText(label).width) + 64;
  }
  if (input.bestWpm) {
    ctx.fillStyle = gold;
    ctx.font = `400 22px ${SERIF}`;
    ctx.textAlign = 'right';
    ctx.fillText('My fastest yet.', WIDTH - MARGIN, figureBase);
    ctx.textAlign = 'left';
  }
  const ruleY = figureBase - 84;
  ctx.fillStyle = mix(14);
  ctx.fillRect(MARGIN, ruleY, WIDTH - MARGIN * 2, 1);

  // The passage, as large as the space allows, with its credit.
  const top = 150;
  const creditHeight = input.author || input.source ? 56 : 0;
  const { size, lines } = fitQuote(ctx, input.quote, WIDTH - MARGIN * 2, ruleY - top - creditHeight - 36);
  ctx.fillStyle = ink;
  ctx.font = `400 ${size}px ${SERIF}`;
  let y = top + size;
  for (const line of lines) {
    ctx.fillText(line, MARGIN, y);
    y += size * 1.3;
  }

  const credit = splitSource(input.source);
  const author = input.author && input.author !== 'Proverb' ? input.author : '';
  let cx = MARGIN;
  const creditY = y + 10;
  const part = (text: string, font: string, fill: string) => {
    if (!text) return;
    ctx.font = font;
    ctx.fillStyle = fill;
    ctx.fillText(text, cx, creditY);
    cx += ctx.measureText(text).width + 16;
  };
  part(author, `400 24px ${SERIF}`, ink);
  part(credit.title, `italic 400 24px ${SERIF}`, mix(76));
  part(credit.detail, `400 24px ${SERIF}`, mix(52));

  return canvas;
}

/** Fonts are fetched on demand; make sure the ones the card uses are in. */
async function fontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`400 40px 'Newsreader'`),
      document.fonts.load(`500 28px 'Newsreader'`),
      document.fonts.load(`italic 400 24px 'Newsreader'`),
      document.fonts.load(`400 19px 'Hanken Grotesk'`),
    ]);
  } catch {
    // Draw with whatever is available.
  }
}

export async function downloadShareCard(input: ShareCardInput): Promise<void> {
  await fontsReady();
  const canvas = renderShareCard(input);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `zen-typer-${stamp}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
