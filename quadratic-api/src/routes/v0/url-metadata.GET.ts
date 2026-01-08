import type { Request, Response } from 'express';
import he from 'he';
import { z } from 'zod';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';

// Cache configuration
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Fetch configuration
const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 50 * 1024; // 50KB

export default [validateAccessToken, validateSchema, handler];

/**
 * Simple LRU cache with TTL for URL metadata
 */
class LRUCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    // Delete first to update position if exists
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }
}

const metadataCache = new LRUCache<{ title?: string }>(CACHE_MAX_SIZE, CACHE_TTL_MS);

const schema = z.object({
  query: z.object({
    url: z.string().url(),
  }),
});

function validateSchema(req: Request, res: Response, next: () => void) {
  return validateRequestSchema(schema)(req, res, next);
}

async function handler(req: Request, res: Response) {
  const { url } = req.query as { url: string };

  // Check cache first
  const cached = metadataCache.get(url);
  if (cached !== undefined) {
    return res.status(200).json(cached);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Quadratic-Bot/1.0 (https://quadratichq.com)',
        Accept: 'text/html',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const result = { title: undefined };
      metadataCache.set(url, result);
      return res.status(200).json(result);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const result = { title: undefined };
      metadataCache.set(url, result);
      return res.status(200).json(result);
    }

    let html = '';
    const decoder = new TextDecoder();
    let bytesRead = 0;

    while (bytesRead < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.length;
      html += decoder.decode(value, { stream: true });

      // Check if we have enough to find a title
      if (html.includes('</title>') || html.includes('</head>')) {
        break;
      }
    }
    reader.cancel();

    const title = extractTitle(html);
    const result = { title };
    metadataCache.set(url, result);
    return res.status(200).json(result);
  } catch {
    // Return empty result on any error (timeout, network, etc.)
    const result = { title: undefined };
    metadataCache.set(url, result);
    return res.status(200).json(result);
  }
}

/**
 * Extract title from HTML, preferring og:title over <title>
 */
function extractTitle(html: string): string | undefined {
  // Try og:title first (more descriptive for shared links)
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch?.[1]) {
    return he.decode(ogTitleMatch[1].trim());
  }

  // Also check for content before property (attribute order can vary)
  const ogTitleMatchAlt = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogTitleMatchAlt?.[1]) {
    return he.decode(ogTitleMatchAlt[1].trim());
  }

  // Fall back to <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    return he.decode(titleMatch[1].trim());
  }

  return undefined;
}
