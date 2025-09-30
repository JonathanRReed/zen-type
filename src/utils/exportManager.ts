/**
 * Enhanced export utilities for Zen Type
 * Provides multiple export formats, better formatting, and improved user experience
 */

import { getStats, getTelemetry, type SessionCardSummary, type SessionSummary } from './storage';

export interface ExportOptions {
  format: 'png' | 'svg' | 'json' | 'txt' | 'csv';
  includeStats?: boolean;
  includeTelemetry?: boolean;
  dateRange?: { start: Date; end: Date };
  filename?: string;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  userAgent: string;
  stats: ReturnType<typeof getStats>;
  telemetry?: ReturnType<typeof getTelemetry>;
  sessions?: SessionSummary[];
  metadata: {
    totalWords: number;
    totalSessions: number;
    averageWpm: number;
    averageAccuracy: number;
    exportFormat: string;
  };
}

export class ExportManager {
  private static instance: ExportManager;

  static getInstance(): ExportManager {
    if (!ExportManager.instance) {
      ExportManager.instance = new ExportManager();
    }
    return ExportManager.instance;
  }

  /**
   * Export session data in various formats
   */
  async exportData(options: ExportOptions): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    try {
      switch (options.format) {
        case 'json':
          await this.exportJSON(options, timestamp);
          break;
        case 'csv':
          await this.exportCSV(options, timestamp);
          break;
        case 'txt':
          await this.exportTXT(options, timestamp);
          break;
        case 'png':
        case 'svg':
          await this.exportSessionCard(options, timestamp);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  /**
   * Export comprehensive data as JSON
   */
  private async exportJSON(options: ExportOptions, timestamp: string): Promise<void> {
    const data: ExportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      stats: getStats(),
      metadata: await this.generateMetadata(options.format)
    };

    // Include telemetry if requested
    if (options.includeTelemetry) {
      data.telemetry = getTelemetry();
    }

    // Include sessions if available (would need to be stored)
    // data.sessions = getRecentSessions();

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    this.downloadBlob(blob, `zen-type-data-${timestamp}.json`);
  }

  /**
   * Export telemetry data as CSV
   */
  private async exportCSV(_options: ExportOptions, timestamp: string): Promise<void> {
    const telemetry = getTelemetry();

    if (telemetry.length === 0) {
      throw new Error('No telemetry data to export');
    }

    const headers = ['Date', 'Mode', 'Duration (sec)', 'Words', 'WPM', 'Accuracy (%)'];
    const rows = telemetry.map(entry => [
      new Date(entry.date).toLocaleDateString(),
      entry.mode,
      entry.timeSec.toString(),
      entry.words.toString(),
      entry.wpm?.toString() || '',
      entry.accuracy?.toString() || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    this.downloadBlob(blob, `zen-type-telemetry-${timestamp}.csv`);
  }

  /**
   * Export text summary
   */
  private async exportTXT(options: ExportOptions, timestamp: string): Promise<void> {
    const stats = getStats();
    const metadata = await this.generateMetadata(options.format);

    const content = `Zen Type - Session Summary
Generated: ${new Date().toLocaleString()}

=== OVERALL STATISTICS ===
Total Words Typed: ${stats.totalWords}
Total Characters: ${stats.totalChars}
Total Time: ${Math.floor(stats.totalTime / 60)}m ${Math.floor(stats.totalTime % 60)}s
Sessions Completed: ${stats.sessionsCompleted}
Best WPM: ${stats.bestWpm}
Average Accuracy: ${Math.round(stats.averageAccuracy)}%
Zen Sessions: ${stats.zenSessions}
Quote Sessions: ${stats.quoteSessions}

=== PERFORMANCE METRICS ===
Average WPM: ${metadata.averageWpm}
Export Format: ${options.format.toUpperCase()}

Keep practicing! 🚀`;

    const blob = new Blob([content], { type: 'text/plain' });
    this.downloadBlob(blob, `zen-type-summary-${timestamp}.txt`);
  }

  /**
   * Enhanced session card export with better formatting
   */
  private async exportSessionCard(options: ExportOptions, timestamp: string): Promise<void> {
    // Get current session data from the active component
    const event = new CustomEvent('requestCurrentSession');
    window.dispatchEvent(event);

    // Wait a bit for the component to respond
    await new Promise(resolve => setTimeout(resolve, 100));

    // For now, create a placeholder - in real implementation,
    // the component would set this data
    const sessionData = (window as any).__currentSessionData;

    if (!sessionData) {
      throw new Error('No active session to export');
    }

    if (options.format === 'png') {
      await this.exportSessionCardPNG(sessionData, timestamp);
    } else {
      await this.exportSessionCardSVG(sessionData, timestamp);
    }
  }

  /**
   * Enhanced PNG export with better styling
   */
  private async exportSessionCardPNG(data: SessionCardSummary, timestamp: string): Promise<void> {
    const width = 1200;
    const height = 628;
    const dpi = 2;

    const canvas = document.createElement('canvas');
    canvas.width = width * dpi;
    canvas.height = height * dpi;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    ctx.scale(dpi, dpi);

    // Enhanced styling with gradients and better typography
    const css = getComputedStyle(document.documentElement);
    const base = (css.getPropertyValue('--rp-base') || '#191724').trim();
    const overlay = (css.getPropertyValue('--rp-overlay') || '#26233a').trim();
    const text = (css.getPropertyValue('--rp-text') || '#e0def4').trim();
    const foam = (css.getPropertyValue('--rp-foam') || '#9ccfd8').trim();
    const gold = (css.getPropertyValue('--rp-gold') || '#f6c177').trim();
    const rose = (css.getPropertyValue('--rp-rose') || '#ea9a97').trim();
    const iris = (css.getPropertyValue('--rp-iris') || '#c4a7e7').trim();

    // Background with subtle pattern
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, base);
    grad.addColorStop(1, overlay);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Add subtle texture pattern
    ctx.globalAlpha = 0.03;
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        if (Math.random() < 0.1) {
          ctx.fillStyle = text;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Title with better typography
    ctx.fillStyle = foam;
    ctx.font = 'bold 48px Inter, system-ui, sans-serif';
    ctx.fillText('Zen Typer', 60, 90);

    // Subtitle
    ctx.fillStyle = text;
    ctx.font = '300 24px Inter, system-ui, sans-serif';
    ctx.fillText('Session Complete', 60, 130);

    // Session data with enhanced layout
    let y = 200;
    const lineHeight = 60;

    const drawMetric = (label: string, value: string, color: string, icon?: string) => {
      // Icon
      if (icon) {
        ctx.fillStyle = color;
        ctx.font = 'normal 32px Inter, system-ui, sans-serif';
        ctx.fillText(icon, 60, y);
      }

      // Label
      ctx.fillStyle = text;
      ctx.font = '500 24px Inter, system-ui, sans-serif';
      ctx.fillText(label, icon ? 110 : 60, y);

      // Value
      ctx.fillStyle = color;
      ctx.font = 'bold 36px JetBrains Mono, ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(value, width - 60, y);
      ctx.textAlign = 'left';

      y += lineHeight;
    };

    const formatTime = (seconds: number): string => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    drawMetric('Mode', data.mode.toUpperCase(), iris, '🏷️');
    drawMetric('Duration', formatTime(data.time), foam, '⏱️');
    drawMetric('Words', data.words.toString(), gold, '📝');
    if (data.wpm) drawMetric('WPM', data.wpm.toString(), rose, '⚡');
    if (data.accuracy) drawMetric('Accuracy', `${Math.round(data.accuracy)}%`, iris, '🎯');

    // Footer
    ctx.fillStyle = text;
    ctx.font = '300 18px Inter, system-ui, sans-serif';
    ctx.fillText(`Generated ${new Date().toLocaleDateString()}`, 60, height - 50);
    ctx.fillText('Built with Rosé Pine • Keep typing! 🚀', 60, height - 20);

    const png = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = png;
    link.download = `zen-typer-session-${timestamp}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Enhanced SVG export
   */
  private async exportSessionCardSVG(data: SessionCardSummary, timestamp: string): Promise<void> {
    const css = getComputedStyle(document.documentElement);
    const base = (css.getPropertyValue('--rp-base') || '#191724').trim();
    const overlay = (css.getPropertyValue('--rp-overlay') || '#26233a').trim();
    const text = (css.getPropertyValue('--rp-text') || '#e0def4').trim();
    const foam = (css.getPropertyValue('--rp-foam') || '#9ccfd8').trim();
    const gold = (css.getPropertyValue('--rp-gold') || '#f6c177').trim();
    const rose = (css.getPropertyValue('--rp-rose') || '#ea9a97').trim();
    const iris = (css.getPropertyValue('--rp-iris') || '#c4a7e7').trim();

    const formatTime = (seconds: number): string => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${base}"/>
      <stop offset="100%" stop-color="${overlay}"/>
    </linearGradient>
    <pattern id="texture" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="${text}" opacity="0.03"/>
      <circle cx="2" cy="2" r="0.5" fill="${text}" opacity="0.05"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="1200" height="628" fill="url(#bg)"/>
  <rect width="1200" height="628" fill="url(#texture)"/>

  <!-- Content -->
  <g font-family="Inter, system-ui, sans-serif">
    <!-- Header -->
    <text x="60" y="80" font-size="48" font-weight="700" fill="${foam}">Zen Typer</text>
    <text x="60" y="110" font-size="24" font-weight="300" fill="${text}">Session Complete</text>

    <!-- Metrics -->
    <g font-family="'JetBrains Mono', ui-monospace, monospace" text-anchor="end">
      <g transform="translate(1140, 180)">
        <text x="0" y="0" font-size="24" font-weight="500" fill="${iris}">Mode</text>
        <text x="0" y="60" font-size="36" font-weight="bold" fill="${foam}">${data.mode.toUpperCase()}</text>

        <text x="0" y="140" font-size="24" font-weight="500" fill="${foam}">Duration</text>
        <text x="0" y="200" font-size="36" font-weight="bold" fill="${gold}">${formatTime(data.time)}</text>

        <text x="0" y="280" font-size="24" font-weight="500" fill="${gold}">Words</text>
        <text x="0" y="340" font-size="36" font-weight="bold" fill="${rose}">${data.words}</text>

        ${data.wpm ? `
          <text x="0" y="420" font-size="24" font-weight="500" fill="${rose}">WPM</text>
          <text x="0" y="480" font-size="36" font-weight="bold" fill="${iris}">${data.wpm}</text>
        ` : ''}

        ${data.accuracy ? `
          <text x="0" y="${data.wpm ? '560' : '420'}" font-size="24" font-weight="500" fill="${iris}">Accuracy</text>
          <text x="0" y="${data.wpm ? '620' : '480'}" font-size="36" font-weight="bold" fill="${foam}">${Math.round(data.accuracy)}%</text>
        ` : ''}
      </g>
    </g>

    <!-- Footer -->
    <text x="60" y="580" font-size="18" font-weight="300" fill="${text}">
      Generated ${new Date().toLocaleDateString()}
    </text>
    <text x="60" y="600" font-size="16" fill="${text}">
      Built with Rosé Pine • Keep typing! 🚀
    </text>
  </g>
</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zen-typer-session-${timestamp}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate metadata for exports
   */
  private async generateMetadata(format: string) {
    const stats = getStats();
    const telemetry = getTelemetry();

    const totalSessions = telemetry.length;
    const averageWpm = totalSessions > 0
      ? Math.round(telemetry.reduce((sum, t) => sum + (t.wpm || 0), 0) / totalSessions)
      : 0;

    return {
      totalWords: stats.totalWords,
      totalSessions,
      averageWpm,
      averageAccuracy: Math.round(stats.averageAccuracy),
      exportFormat: format
    };
  }

  /**
   * Helper to download blob with filename
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Quick export current session
   */
  async quickExport(format: 'png' | 'svg' | 'json' = 'png'): Promise<void> {
    await this.exportData({ format });
  }

  /**
   * Export all data
   */
  async exportAll(): Promise<void> {
    await this.exportData({
      format: 'json',
      includeStats: true,
      includeTelemetry: true
    });
  }
}

// Export singleton instance
export const exportManager = ExportManager.getInstance();
