// Quote loading and management utilities

export interface Quote {
  id: string;
  text: string;
  author: string;
  source?: string;
}

let quotesCache: Quote[] | null = null;

const loadClientQuotes = async (): Promise<Quote[]> => {
  const response = await fetch('/quotes.json');
  if (!response.ok) {
    throw new Error(`Failed to load quotes: ${response.status}`);
  }
  return await response.json() as Quote[];
};

export async function loadQuotes(): Promise<Quote[]> {
  // Return cached quotes if available
  if (quotesCache) {
    return quotesCache;
  }

  try {
    let arr: Quote[];
    if (import.meta.env.SSR) {
      const { loadServerQuotes } = await import('./quotes.server.js');
      arr = await loadServerQuotes();
    } else {
      arr = await loadClientQuotes();
    }
    quotesCache = arr;
    return arr;
  } catch (error) {
    console.error('Error loading quotes:', error);
    // Return fallback quotes if fetch fails
    return getFallbackQuotes();
  }
}

export function getRandomQuote(quotes: Quote[]): Quote {
  if (quotes.length === 0) {
    const fallbacks = getFallbackQuotes();
    return fallbacks[0] ?? { id: 'fallback', text: 'The journey of a thousand miles begins with one step.', author: 'Lao Tzu' };
  }
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const quote = quotes[randomIndex];
  return quote ?? quotes[0] ?? { id: 'fallback', text: 'The journey of a thousand miles begins with one step.', author: 'Lao Tzu' };
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
