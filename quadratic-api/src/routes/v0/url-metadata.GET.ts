import type { Request, Response } from 'express';
import { unfurl } from 'unfurl.js';
import { z } from 'zod';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';

// Cache configuration
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Fetch configuration
const FETCH_TIMEOUT_MS = 5000;

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
    const metadata = await unfurl(url, {
      timeout: FETCH_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Quadratic-Bot/1.0 (https://quadratichq.com)',
      },
    });

    // Prefer og:title, then twitter:title, then page title
    const title = metadata.open_graph?.title ?? metadata.twitter_card?.title ?? metadata.title;
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
