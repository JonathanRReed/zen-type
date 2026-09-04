import type { Quote } from './quotes';

export async function loadServerQuotes(): Promise<Quote[]> {
  const [{ readFile }, { join }] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ]);
  const raw = await readFile(join(process.cwd(), 'public', 'quotes.json'), 'utf-8');
  return JSON.parse(raw) as Quote[];
}
