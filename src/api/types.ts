import z from 'zod';
import { GridFileSchema } from '../schemas';

// TODO share these with the API

// Shared types
const fileMeta = {
  uuid: z.string().uuid(),
  name: z.string(),
  created_date: z.string().datetime(),
  updated_date: z.string().datetime(),
  public_link_access: z.enum(['EDIT', 'READONLY', 'NOT_SHARED']),
};
export const permissionSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER', 'ANONYMOUS']);
export type Permission = z.infer<typeof permissionSchema>;

// Zod schemas for API endpoints
export const apiSchemas = {
  // Files
  '/v0/files.GET.response': z.array(
    z.object({
      ...fileMeta,
    })
  ),
  '/v0/files.POST.request': z
    .object({
      name: z.string(),
      contents: z.string(),
      version: z.string(),
    })
    .optional(),
  '/v0/files.POST.response': z.object(fileMeta),

  // File
  '/v0/files/:uuid.GET.response': z.object({
    file: z.object({
      ...fileMeta,
      contents: z.string(), // Stringified Gridfile
      version: z.string(), // TODO one of: ...
    }),
    permission: permissionSchema,
  }),
  '/v0/files/:uuid.DELETE.response': z.object({
    message: z.string(),
  }),
  '/v0/files/:uuid.POST.request': z.object({
    // You can post any of these, but if you post `contents` you have to also send `version`
    contents: z.string().optional(),
    version: GridFileSchema.shape.version.optional(),
    name: z.string().optional(),
    public_link_access: fileMeta.public_link_access.optional(),
  }),
  '/v0/files/:uuid.POST.response': z.object({
    message: z.string(),
  }),

  // Feedback
  '/v0/feedback.POST.request': z.object({
    feedback: z.string(),
    userEmail: z.string().optional(),
  }),
  '/v0/feedback.POST.response': z.object({
    message: z.string(),
  }),
};

// Types for API endpoitns
export type ApiTypes = {
  '/v0/files.GET.response': z.infer<(typeof apiSchemas)['/v0/files.GET.response']>;
  '/v0/files.POST.request': z.infer<(typeof apiSchemas)['/v0/files.POST.request']>;
  '/v0/files.POST.response': z.infer<(typeof apiSchemas)['/v0/files.POST.response']>;

  '/v0/files/:uuid.GET.response': z.infer<(typeof apiSchemas)['/v0/files/:uuid.GET.response']>;
  '/v0/files/:uuid.DELETE.response': z.infer<(typeof apiSchemas)['/v0/files/:uuid.DELETE.response']>;
  '/v0/files/:uuid.POST.request': z.infer<(typeof apiSchemas)['/v0/files/:uuid.POST.request']>;
  '/v0/files/:uuid.POST.response': z.infer<(typeof apiSchemas)['/v0/files/:uuid.POST.response']>;

  '/v0/feedback.POST.request': z.infer<(typeof apiSchemas)['/v0/feedback.POST.request']>;
  '/v0/feedback.POST.response': z.infer<(typeof apiSchemas)['/v0/feedback.POST.response']>;
};
