import type { Request } from 'express';
import { z } from 'zod';
import { parseRequest } from './validateRequestSchema';

describe('parseRequest()', () => {
  describe('parsing body', () => {
    const schema = z.object({
      body: z.object({
        foo: z.string(),
      }),
    });

    it('throws with an invalid body', async () => {
      const req = { body: { foo: 1 } } as Request;
      expect(() => parseRequest(req, schema)).toThrow();
    });

    it('successfully parses request', async () => {
      const result = parseRequest({ body: { foo: 'bar' } } as Request, schema);
      expect(result.body.foo).toBe('bar');
    });
  });

  describe('parsing params', () => {
    const schema = z.object({
      params: z.object({
        uuid: z.string().uuid(),
        userId: z.coerce.number(),
      }),
    });

    it('throws with an invalid UUID', async () => {
      // @ts-expect-error
      const req = { params: { uuid: 'foo', userId: '1' } } as Request;
      expect(() => parseRequest(req, schema)).toThrow();
    });

    it('throws with an invalid userId', async () => {
      // @ts-expect-error
      const req = { params: { uuid: '10000000-0000-0000-0000-000000000000', userId: 'foo' } } as Request;
      expect(() => parseRequest(req, schema)).toThrow();
    });

    it('successfully parses UUID and userId', async () => {
      // @ts-expect-error
      const req = { params: { uuid: '10000000-0000-0000-0000-000000000000', userId: '1' } } as Request;
      const result = parseRequest(req, schema);
      expect(result.params.uuid).toBe('10000000-0000-0000-0000-000000000000');
      expect(result.params.userId).toBe(1);
    });
  });

  describe('parsing params', () => {
    const schema = z.object({
      query: z.object({
        foo: z.string(),
      }),
    });

    it('throws with an invalid query', async () => {
      // @ts-expect-error
      const req = { query: { bar: 'foo' } } as Request;
      expect(() => parseRequest(req, schema)).toThrow();
    });

    it('successfully parses query', async () => {
      // @ts-expect-error
      const result = parseRequest({ query: { foo: 'bar' } } as Request, schema);
      expect(result.query.foo).toBe('bar');
    });
  });
});
