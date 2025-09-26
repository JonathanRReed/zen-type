import type { Quote } from './quotes';

export async function loadServerQuotes(): Promise<Quote[]> {
  const { readFile } = await import('node:fs/promises');
  const fileUrl = new URL('../../public/quotes.json', import.meta.url);
  const raw = await readFile(fileUrl, 'utf-8');
  return JSON.parse(raw) as Quote[];
}
