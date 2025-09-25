// Quote loading and management utilities

export interface Quote {
  id: string;
  text: string;
  author: string;
  source?: string;
}

let quotesCache: Quote[] | null = null;

export async function loadQuotes(): Promise<Quote[]> {
  // Return cached quotes if available
  if (quotesCache) {
    return quotesCache;
  }

  try {
    if (typeof window === 'undefined') {
      // SSR/build: read from public/quotes.json using Node fs
      const fs = await import('node:fs/promises');
      const path = `${process.cwd()}/public/quotes.json`;
      const raw = await fs.readFile(path, 'utf-8');
      const arr = JSON.parse(raw) as Quote[];
      quotesCache = arr;
      return arr;
    } else {
      const response = await fetch('/quotes.json');
      if (!response.ok) {
        throw new Error(`Failed to load quotes: ${response.status}`);
      }
      const arr = await response.json() as Quote[];
      quotesCache = arr;
      return arr;
    }
  } catch (error) {
    console.error('Error loading quotes:', error);
    // Return fallback quotes if fetch fails
    return getFallbackQuotes();
  }
}

export function getRandomQuote(quotes: Quote[]): Quote {
  if (quotes.length === 0) {
    return getFallbackQuotes()[0];
  }
  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
}

export function getFallbackQuotes(): Quote[] {
  return [
    {
      id: "fallback-01",
      text: "The only way to do great work is to love what you do.",
      author: "Steve Jobs",
      source: "Stanford Commencement Speech"
    },
    {
      id: "fallback-02", 
      text: "In the middle of difficulty lies opportunity.",
      author: "Albert Einstein",
      source: "Public domain"
    }
  ];
}

// Utility to format quote for display
export function formatQuote(quote: Quote): string {
  return `${quote.text} — ${quote.author}`;
}
