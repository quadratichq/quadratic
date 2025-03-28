// Cache object to store documentation with timestamps
interface CachedDoc {
  content: string;
  timestamp: number;
}

const docsCache = new Map<string, CachedDoc>();
const CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

// Get documentation with caching
export function getDocs(type: string, fallback: string): string {
  const cached = docsCache.get(type);

  // If cache is valid, return immediately
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }

  // Cache the fallback content
  docsCache.set(type, {
    content: fallback,
    timestamp: Date.now(),
  });

  return fallback;
}
