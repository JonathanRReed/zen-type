import type { Quote } from './quotes';

export async function loadServerQuotes(): Promise<Quote[]> {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const raw = await readFile(join(process.cwd(), 'public', 'quotes.json'), 'utf-8');
  return JSON.parse(raw) as Quote[];
}
