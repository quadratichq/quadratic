import z from 'zod';
import { GridFileSchema } from '../schemas';

// TODO share these with the API

// Shared types
const publicLinkAccessSchema = z.enum(['EDIT', 'READONLY', 'NOT_SHARED']);

const fileMeta = {
  uuid: z.string().uuid(),
  name: z.string(),
  created_date: z.string().datetime(),
  updated_date: z.string().datetime(),
  public_link_access: publicLinkAccessSchema,
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
      // A string-ified version of `GridFile`
      contents: z.string(),
      // We could derive this to be one of the defined types for `version` from
      // our set of schemas, but it’s possible this is a _new_ version from
      // the server and the app needs to refresh to use it. So we just allow a
      // general string here.
      version: z.string(),
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
  }),
  '/v0/files/:uuid.POST.response': z.object({
    message: z.string(),
  }),

  // File sharing
  '/v0/files/:uuid/sharing.GET.response': z.object({
    owner: z.object({
      name: z.string(),
      picture: z.string().url(),
      // This will give back an email if logged in but null if not.
      // For now we don't need it so we ignore it
      // email: z.string().email() | z.null()
    }),
    public_link_access: publicLinkAccessSchema,
    // These come, but we'll leave them off for now because we don't care about them
    // users: z.array(z.any()),
    // teams: z.array(z.any()),
  }),
  '/v0/files/:uuid/sharing.POST.request': z.object({ public_link_access: publicLinkAccessSchema }),
  '/v0/files/:uuid/sharing.POST.response': z.object({ message: z.string() }),

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

  '/v0/files/:uuid/sharing.GET.response': z.infer<(typeof apiSchemas)['/v0/files/:uuid/sharing.GET.response']>;
  '/v0/files/:uuid/sharing.POST.request': z.infer<(typeof apiSchemas)['/v0/files/:uuid/sharing.POST.request']>;
  '/v0/files/:uuid/sharing.POST.response': z.infer<(typeof apiSchemas)['/v0/files/:uuid/sharing.POST.response']>;

  '/v0/feedback.POST.request': z.infer<(typeof apiSchemas)['/v0/feedback.POST.request']>;
  '/v0/feedback.POST.response': z.infer<(typeof apiSchemas)['/v0/feedback.POST.response']>;
};
