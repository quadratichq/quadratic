import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';
import { ResponseError } from '../types/Response';

/**
 * Takes a Zod schema and validates the request `body`, `query`, and `params` against it.
 *
 * Example:
 *
 * ```
 * validateZodSchema(
 *   z.object({
 *     body: z.object(...),
 *     query: z.object(...),
 *     params: z.object(...}
 *   })
 * )
 * ```
 * @param schema
 * @returns
 */
export const validateZodSchema =
  (schema: AnyZodObject) => async (req: Request, res: Response<ResponseError>, next: NextFunction) => {
    try {
      // TODO maybe just .parse
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      return res.status(400).json({ error: { message: 'Bad request. Schema validation failed', meta: error } });
    }
  };
