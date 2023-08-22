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
export const GetFilesResSchema = z.array(
  z.object({
    ...fileMeta,
  })
);
export type GetFilesRes = z.infer<typeof GetFilesResSchema>;

// GET /file/:uuid
export const GetFileResSchema = z.object({
  file: z.object({
    ...fileMeta,
    contents: z.string(), // Stringified Gridfile
    version: z.string(), // TODO one of: ...
  }),
  permission: z.enum(['OWNER', 'READONLY', 'EDIT', 'NOT_SHARED']),
});
export type GetFileRes = z.infer<typeof GetFileResSchema>;

// DELETE /file/:uuid
export const DeleteFileResSchema = z.object({
  message: z.string(),
});
export type DeleteFileRes = z.infer<typeof DeleteFileResSchema>;

// POST /files/:uuid
export const PostFileContentsReqSchema = z.object({
  contents: z.string(),
  version: GridFileSchema.shape.version,
});
export type PostFileContentsReq = z.infer<typeof PostFileContentsReqSchema>;
export const PostFileNameReqSchema = z.object({
  name: z.string(),
});
export type PostFileNameReq = z.infer<typeof PostFileNameReqSchema>;
export const PostFileResSchema = z.object({
  message: z.string(),
});
export type PostFileRes = z.infer<typeof PostFileResSchema>;

// POST /files
const PostFilesReqSchema = z
  .object({
    name: z.string(),
    contents: z.string(),
    version: z.string(),
  })
  .optional();
export type PostFilesReq = z.infer<typeof PostFilesReqSchema>;
export const PostFilesResSchema = z.object(fileMeta);
export type PostFilesRes = z.infer<typeof PostFilesResSchema>;

// POST /feedback
export const PostFeedbackReqSchema = z.object({
  feedback: z.string(),
  userEmail: z.string().optional(),
});
export type PostFeedbackReq = z.infer<typeof PostFeedbackReqSchema>;
export const PostFeedbackResSchema = z.object({
  message: z.string(),
});
export type PostFeedbackRes = z.infer<typeof PostFeedbackResSchema>;
