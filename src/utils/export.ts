// Session card PNG export utility
// Renders a 1200x628 PNG with Rosé Pine gradient background and summary stats

export interface SessionCardSummary {
  mode: 'zen' | 'quote';
  date: string; // ISO string
  time: number; // seconds
  words: number; // total words
  wpm?: number; // quote mode
  accuracy?: number; // quote mode
}

export async function exportSessionCard(summary: SessionCardSummary) {
  const width = 1200;
  const height = 628;
  const dpi = 2; // retina crisp
  const canvas = document.createElement('canvas');
  canvas.width = width * dpi;
  canvas.height = height * dpi;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpi, dpi);

  // Background gradient using current CSS variables
  const css = getComputedStyle(document.documentElement);
  const base = (css.getPropertyValue('--rp-base') || '#191724').trim();
  const overlay = (css.getPropertyValue('--rp-overlay') || '#26233a').trim();
  const text = (css.getPropertyValue('--rp-text') || '#e0def4').trim();
  const foam = (css.getPropertyValue('--rp-foam') || '#9ccfd8').trim();
  const gold = (css.getPropertyValue('--rp-gold') || '#f6c177').trim();
  const rose = (css.getPropertyValue('--rp-rose') || '#ea9a97').trim();
  const iris = (css.getPropertyValue('--rp-iris') || '#c4a7e7').trim();

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, base);
  grad.addColorStop(1, overlay);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Grain mask (subtle)
  ctx.globalAlpha = 0.08;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (Math.random() < 0.05) {
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;

  // Title
  ctx.fillStyle = foam;
  ctx.font = '700 40px Inter, system-ui, sans-serif';
  ctx.fillText('Zen Typer Session', 60, 100);

  // Date
  const d = new Date(summary.date);
  ctx.fillStyle = text;
  ctx.font = '400 20px Inter, system-ui, sans-serif';
  ctx.fillText(d.toLocaleString(), 60, 130);

  // Stats block
  const toMMSS = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  let y = 210;
  const line = (label: string, value: string, color: string) => {
    ctx.fillStyle = color;
    ctx.font = '600 28px JetBrains Mono, ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(label, 60, y);
    ctx.fillStyle = text;
    ctx.font = '600 28px JetBrains Mono, ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(value, 260, y);
    y += 48;
  };

  line('Mode', summary.mode.toUpperCase(), iris);
  line('Time', toMMSS(summary.time), foam);
  line('Words', String(summary.words), gold);
  if (summary.wpm !== undefined) line('WPM', String(summary.wpm), rose);
  if (summary.accuracy !== undefined) line('Accuracy', `${Math.round(summary.accuracy)}%`, iris);

  // Footer
  ctx.fillStyle = text;
  ctx.font = '400 16px Inter, system-ui, sans-serif';
  ctx.fillText('Built with Rosé Pine', 60, height - 40);

  // Download
  const png = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = png;
  a.download = `zen-typer-session-${ts}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
