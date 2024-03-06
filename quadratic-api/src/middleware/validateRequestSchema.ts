import { NextFunction, Request, Response } from 'express';
import { infer as ZodInfer, ZodObject, ZodTypeAny } from 'zod';
import { ResponseError } from '../types/Response';
import { ApiError } from '../utils/ApiError';

type RequestSchema = ZodObject<{
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}>;

/**
 * Takes a Zod schema and validates the request `body`, `query`, and `params` against it.
 * TODO: deprecate this in favor of `parseRequest`
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
export const validateRequestSchema =
  (schema: RequestSchema) => async (req: Request, res: Response<ResponseError>, next: NextFunction) => {
    try {
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

/**
 * Takes a Zod schema and parses it against the request `body`, `query`, and `params`.
 * It returns the values after they’ve been transformed as specified by the schema.
 * It should be used as the first function in a route handler.
 *
 * Example:
 *
 * ```
 * export handler = async (req: Request, res: Response) => {
 *   const { body, params, query } = parse(
 *     z.object({
 *       body: z.object({ ... }),
 *       query: z.object({ ... }),
 *       params: z.object({ ... })
 *     })
 *   );
 * }
 * ```
 */
export const parseRequest = <S extends RequestSchema>(req: Request, schema: S): ZodInfer<S> => {
  try {
    const data = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    return data;
  } catch (error) {
    throw new ApiError(400, 'Bad request. Schema validation failed', error);
  }
};
