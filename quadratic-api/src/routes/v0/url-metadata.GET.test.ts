import { workosMock } from '../../tests/workosMock';
jest.mock('@workos-inc/node', () =>
  workosMock([
    {
      id: 'testUser',
      email: 'test@example.com',
    },
  ])
);

import nock from 'nock';
import request from 'supertest';
import { app } from '../../app';

// Use unique URLs per test to avoid cache interference
let testUrlCounter = 0;
function uniqueUrl(path: string): string {
  return `${path}-${++testUrlCounter}`;
}

beforeEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.restore();
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
    it('extracts title from page title', async () => {
      const path = uniqueUrl('/title-tag');
      const html = '<html><head><title>Test Page Title</title></head><body></body></html>';

      nock('https://example.com').get(path).reply(200, html, { 'Content-Type': 'text/html' });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(`https://example.com${path}`)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBe('Test Page Title');
    });

    it('prefers og:title over page title', async () => {
      const path = uniqueUrl('/og-title');
      const html = `
        <html>
          <head>
            <title>Regular Title</title>
            <meta property="og:title" content="Open Graph Title">
          </head>
          <body></body>
        </html>
      `;

      nock('https://example.com').get(path).reply(200, html, { 'Content-Type': 'text/html' });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(`https://example.com${path}`)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBe('Open Graph Title');
    });

    it('falls back to twitter:title when og:title is not available', async () => {
      const path = uniqueUrl('/twitter-title');
      const html = `
        <html>
          <head>
            <title>Regular Title</title>
            <meta name="twitter:title" content="Twitter Card Title">
          </head>
          <body></body>
        </html>
      `;

      nock('https://example.com').get(path).reply(200, html, { 'Content-Type': 'text/html' });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(`https://example.com${path}`)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBe('Twitter Card Title');
    });

    it('decodes HTML entities in title', async () => {
      const path = uniqueUrl('/entities');
      const html = '<html><head><title>Tom &amp; Jerry &lt;3</title></head><body></body></html>';

      nock('https://example.com').get(path).reply(200, html, { 'Content-Type': 'text/html' });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(`https://example.com${path}`)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBe('Tom & Jerry <3');
    });
  });

  describe('error handling', () => {
    it('returns undefined title for HTTP error', async () => {
      const path = uniqueUrl('/404');

      nock('https://example.com').get(path).reply(404);

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(`https://example.com${path}`)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBeUndefined();
    });

    it('returns undefined title for network error', async () => {
      const path = uniqueUrl('/error');

      nock('https://example.com').get(path).replyWithError('Network error');

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(`https://example.com${path}`)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBeUndefined();
    });

    it('returns undefined title when no title found', async () => {
      const path = uniqueUrl('/no-title');
      const html = '<html><head></head><body>No title here</body></html>';

      nock('https://example.com').get(path).reply(200, html, { 'Content-Type': 'text/html' });

      const res = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(`https://example.com${path}`)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res.body.title).toBeUndefined();
    });
  });

  describe('caching', () => {
    it('caches successful results', async () => {
      const path = uniqueUrl('/cached');
      const html = '<html><head><title>Cached Title</title></head></html>';

      // Only set up one mock response - second request should use cache
      nock('https://example.com').get(path).once().reply(200, html, { 'Content-Type': 'text/html' });

      // First request
      const res1 = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(`https://example.com${path}`)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res1.body.title).toBe('Cached Title');

      // Second request should use cache (nock would fail if it tried to make another request)
      const res2 = await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(`https://example.com${path}`)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      expect(res2.body.title).toBe('Cached Title');
    });

    it('caches error results', async () => {
      const path = uniqueUrl('/error-cached');

      // Only set up one mock error - second request should use cache
      nock('https://example.com').get(path).once().replyWithError('Network error');

      // First request
      await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(`https://example.com${path}`)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);

      // Second request should use cache (nock would fail if it tried to make another request)
      await request(app)
        .get(`/v0/url-metadata?url=${encodeURIComponent(`https://example.com${path}`)}`)
        .set('Authorization', 'Bearer ValidToken testUser test@example.com')
        .expect(200);
    });
  });
});
