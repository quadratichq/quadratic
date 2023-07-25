import z from 'zod';
import { GridFileSchema } from '../schemas';

// TODO share these with the API

// Shared types
const fileMeta = {
  uuid: z.string().uuid(),
  name: z.string(),
  created_date: z.string().datetime(),
  updated_date: z.string().datetime(),
};

// GET /files
const GetFilesResSchema = z
  .array(
    z.object({
      ...fileMeta,
    })
  )
  .optional();
export type GetFilesRes = z.infer<typeof GetFilesResSchema>;

// GET /files/:uuid
const GetFileResSchema = z
  .object({
    file: z.object({
      ...fileMeta,
      contents: z.string(), // Stringified Gridfile
      version: z.string(), // TODO one of: ...
    }),
    permission: z.string(), // TODO one of:
  })
  .optional();
export type GetFileRes = z.infer<typeof GetFileResSchema>;

// TODO rename to FileContext
const GetFileClientResSchema = z.object({
  ...fileMeta,
  contents: GridFileSchema,
  permission: z.string(), // TODO one of:
});
export type GetFileClientRes = z.infer<typeof GetFileClientResSchema>;

// POST /files/:uuid
const PostFileReqSchema = z.object({
  name: z.string().optional(),
  contents: z.string().optional(),
});
export type PostFileReq = z.infer<typeof PostFileReqSchema>;
