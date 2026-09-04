// A 1200x630 PNG summary of a session, drawn on a canvas in the current
// theme's colours. Downloaded straight from the browser; nothing is uploaded.

export interface ShareCardInput {
  mode: 'zen' | 'quote';
  date?: string;
  timeSec: number;
  words: number;
  wpm?: number;
  accuracy?: number;
  streak?: number;
  quote?: string;
  author?: string;
  bestWpm?: boolean;
}

const cssVar = (name: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const formatTime = (sec: number): string => {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    const last = lines[maxLines - 1] ?? '';
    lines[maxLines - 1] = last.replace(/\s+\S*$/, '') + '…';
  }
  return lines;
}

export function renderShareCard(input: ShareCardInput): HTMLCanvasElement {
  const width = 1200;
  const height = 630;
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  const base = cssVar('--rp-base', '#191724');
  const surface = cssVar('--rp-surface', '#1f1d2e');
  const text = cssVar('--rp-text', '#e0def4');
  const muted = cssVar('--rp-subtle', '#908caa');
  const accent = cssVar('--theme-accent', '#c4a7e7');
  const accent2 = cssVar('--theme-accent-2', '#9ccfd8');
  const gold = cssVar('--rp-gold', '#f6c177');

  // Ground
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, base);
  grad.addColorStop(1, surface);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Soft accent bloom, top left, and a cooler one bottom right
  const bloom = ctx.createRadialGradient(180, 120, 20, 180, 120, 560);
  bloom.addColorStop(0, accent + '55');
  bloom.addColorStop(1, 'transparent');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, width, height);
  const bloom2 = ctx.createRadialGradient(1040, 560, 20, 1040, 560, 520);
  bloom2.addColorStop(0, accent2 + '33');
  bloom2.addColorStop(1, 'transparent');
  ctx.fillStyle = bloom2;
  ctx.fillRect(0, 0, width, height);

  // Fine grain
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
    ctx.fillRect(Math.random() * width, Math.random() * height, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;

  const sans = "Inter, 'Helvetica Neue', Arial, system-ui, sans-serif";
  const mono = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

  // Wordmark
  ctx.fillStyle = accent;
  ctx.font = `600 22px ${sans}`;
  ctx.letterSpacing = '0.28em';
  ctx.fillText('ZEN TYPER', 72, 84);
  ctx.letterSpacing = '0em';
  ctx.fillStyle = muted;
  ctx.font = `400 18px ${sans}`;
  ctx.fillText(input.mode === 'quote' ? 'Quote mode' : 'Zen mode', 72, 114);

  // Headline number
  const headlineValue = input.mode === 'quote' && input.wpm !== undefined ? String(Math.round(input.wpm)) : String(Math.round(input.words));
  const headlineLabel = input.mode === 'quote' && input.wpm !== undefined ? 'words per minute' : 'words written';
  ctx.fillStyle = text;
  ctx.font = `600 148px ${mono}`;
  ctx.fillText(headlineValue, 66, 292);
  const headlineWidth = ctx.measureText(headlineValue).width;
  ctx.fillStyle = muted;
  ctx.font = `400 26px ${sans}`;
  ctx.fillText(headlineLabel, 72 + headlineWidth + 22, 286);
  if (input.bestWpm) {
    ctx.fillStyle = gold;
    ctx.font = `600 18px ${sans}`;
    ctx.letterSpacing = '0.2em';
    ctx.fillText('PERSONAL BEST', 74 + headlineWidth + 22, 252);
    ctx.letterSpacing = '0em';
  }

  // Secondary row
  const secondary: Array<[string, string]> = [];
  if (input.accuracy !== undefined) secondary.push([`${Math.round(input.accuracy)}%`, 'accuracy']);
  secondary.push([formatTime(input.timeSec), 'time']);
  if (input.mode === 'quote') secondary.push([String(Math.round(input.words)), 'words']);
  if (input.streak && input.streak > 1) secondary.push([`${input.streak}`, input.streak === 1 ? 'day' : 'days in a row']);
  let x = 72;
  for (const [value, label] of secondary) {
    ctx.fillStyle = text;
    ctx.font = `500 40px ${mono}`;
    ctx.fillText(value, x, 372);
    const w = ctx.measureText(value).width;
    ctx.fillStyle = muted;
    ctx.font = `400 18px ${sans}`;
    ctx.fillText(label, x, 400);
    x += Math.max(w, ctx.measureText(label).width) + 56;
  }

  // Quote
  if (input.quote) {
    ctx.fillStyle = text;
    ctx.globalAlpha = 0.86;
    ctx.font = `400 26px ${sans}`;
    const lines = wrap(ctx, `“${input.quote}”`, 1056, 3);
    let y = 470;
    for (const line of lines) {
      ctx.fillText(line, 72, y);
      y += 36;
    }
    ctx.globalAlpha = 1;
    if (input.author) {
      ctx.fillStyle = accent2;
      ctx.font = `500 20px ${sans}`;
      ctx.fillText(`— ${input.author}`, 72, y + 4);
    }
  }

  // Footer
  ctx.fillStyle = muted;
  ctx.font = `400 16px ${sans}`;
  ctx.textAlign = 'right';
  ctx.fillText('zentype.jonathanrreed.com', width - 72, height - 44);
  ctx.textAlign = 'left';
  const rule = ctx.createLinearGradient(72, 0, width - 72, 0);
  rule.addColorStop(0, accent);
  rule.addColorStop(1, 'transparent');
  ctx.fillStyle = rule;
  ctx.fillRect(72, height - 72, width - 144, 2);

  return canvas;
}

export function downloadShareCard(input: ShareCardInput): void {
  const canvas = renderShareCard(input);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `zen-typer-${input.mode}-${stamp}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
