import { describe, expect, it } from 'vitest';
import { parseDomain } from './auth';

describe('auth', () => {
  it('parses domains', () => {
    const localhostWithPort = parseDomain('localhost:3000');
    expect(localhostWithPort).toBe('localhost');

    const hasSubdomain = parseDomain('app.quadratichq.com');
    expect(hasSubdomain).toBe('quadratichq.com');

    const ipAddress = parseDomain('35.161.33.29');
    expect(ipAddress).toBe('35.161.33.29');
  });
});
