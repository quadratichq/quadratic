import { workosMock } from '../../tests/workosMock';
jest.mock('@workos-inc/node', () =>
  workosMock([
    {
      id: 'testUser',
      email: 'test@example.com',
    },
  ])
);

import request from 'supertest';
import { app } from '../../app';

// Helper to create a mock readable stream from a string
function createMockReadableStream(content: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  let position = 0;

  return {
    getReader: () => ({
      read: async () => {
        if (position >= data.length) {
          return { done: true, value: undefined };
        }
        const chunk = data.slice(position, position + 1024);
        position += 1024;
        return { done: false, value: chunk };
      },
      cancel: jest.fn(),
    }),
  };
}

// Store original fetch
const originalFetch = global.fetch;

// Use unique URLs per test to avoid cache interference
let testUrlCounter = 0;
function uniqueUrl(base: string): string {
  return `${base}?testId=${++testUrlCounter}`;
}

afterAll(() => {
  global.fetch = originalFetch;
});

describe('GET /v0/url-metadata', () => {
  describe('authentication', () => {
    it('requires authentication', async () => {
      await request(app).get('/v0/url-metadata?url=https://example.com').expect(401);
    });
  });

  describe('validation', () => {
    it('rejects missing url parameter', async () => {
      await request(app)
        .get('/v0/url-metadata')
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(400);
    });

    it('rejects invalid url', async () => {
      await request(app)
        .get('/v0/url-metadata?url=not-a-valid-url')
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(400);
    });
  });

  describe('title extraction', () => {
    it('extracts title from <title> tag', async () => {
      const testUrl = uniqueUrl('https://example.com/title-tag');
      const html = '<html><head><title>Test Page Title</title></head><body></body></html>';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: createMockReadableStream(html),
      });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBe('Test Page Title');
    });

    it('prefers og:title over <title>', async () => {
      const testUrl = uniqueUrl('https://example.com/og-title');
      const html = `
        <html>
          <head>
            <title>Regular Title</title>
            <meta property="og:title" content="Open Graph Title">
          </head>
          <body></body>
        </html>
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: createMockReadableStream(html),
      });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBe('Open Graph Title');
    });

    it('handles og:title with content before property', async () => {
      const testUrl = uniqueUrl('https://example.com/og-title-alt');
      const html = `<html><head><meta content="Alt Order Title" property="og:title"></head></html>`;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: createMockReadableStream(html),
      });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBe('Alt Order Title');
    });

    it('decodes HTML entities in title', async () => {
      const testUrl = uniqueUrl('https://example.com/entities');
      const html = '<html><head><title>Tom &amp; Jerry &lt;3</title></head></html>';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: createMockReadableStream(html),
      });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBe('Tom & Jerry <3');
    });

    it('decodes numeric HTML entities', async () => {
      const testUrl = uniqueUrl('https://example.com/numeric-entities');
      const html = '<html><head><title>Quote: &#34;Hello&#34;</title></head></html>';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: createMockReadableStream(html),
      });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBe('Quote: "Hello"');
    });
  });

  describe('error handling', () => {
    it('returns undefined title for non-ok response', async () => {
      const testUrl = uniqueUrl('https://example.com/404');

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBeUndefined();
    });

    it('returns undefined title for fetch error', async () => {
      const testUrl = uniqueUrl('https://example.com/error');

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBeUndefined();
    });

    it('returns undefined title when no title found', async () => {
      const testUrl = uniqueUrl('https://example.com/no-title');
      const html = '<html><head></head><body>No title here</body></html>';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: createMockReadableStream(html),
      });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBeUndefined();
    });
  });

  describe('caching', () => {
    it('caches successful results', async () => {
      const testUrl = uniqueUrl('https://example.com/cached');
      const html = '<html><head><title>Cached Title</title></head></html>';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: createMockReadableStream(html),
      });

      // First request
      const res1 = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res1.body.title).toBe('Cached Title');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second request should use cache
      const res2 = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res2.body.title).toBe('Cached Title');
      // fetch should not be called again
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('caches error results', async () => {
      const testUrl = uniqueUrl('https://example.com/error-cached');

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // First request
      await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second request should use cache
      await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(testUrl)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      // fetch should not be called again
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
