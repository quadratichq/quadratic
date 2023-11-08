import z from 'zod';

// TODO share these with the API

// Shared types
const PublicLinkAccessSchema = z.enum(['EDIT', 'READONLY', 'NOT_SHARED']);
export type PublicLinkAccess = z.infer<typeof PublicLinkAccessSchema>;

const fileMeta = {
  uuid: z.string().uuid(),
  name: z.string(),
  created_date: z.string().datetime(),
  updated_date: z.string().datetime(),
};

export const PermissionSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER', 'ANONYMOUS']);
export type Permission = z.infer<typeof PermissionSchema>;

const connection = z.object({
  uuid: z.string(),
  name: z.string(),
  host: z.string(),
  port: z.string(),
  database: z.string(),
  username: z.string(),
  password: z.string().optional(),
});

// TODO: duplicated with API
export const connectionFieldZ = z.object({
  name: z.string(),
  description: z.string(),
  type: z.string(),
  sensitive: z.enum(['AWS_SECRET', 'ENCRYPTED', 'PLAINTEXT']),
  required: z.boolean(),
  default: z.string().optional(),
});

// TODO: duplicated with API
export const connectionConfigurationZ = z.object({
  name: z.string(),
  type: z.enum(['POSTGRES']),
  description: z.string(),
  connectionFields: z.array(connectionFieldZ),
  cellLevelInput: z.enum(['SINGLE_QUERY_EDITOR']),
});

// Zod schemas for API endpoints
export const ApiSchemas = {
  // Files
  '/v0/files.GET.response': z.array(
    z.object({
      ...fileMeta,
      public_link_access: PublicLinkAccessSchema,
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
    permission: PermissionSchema,
  }),
  '/v0/files/:uuid.DELETE.response': z.object({
    message: z.string(),
  }),
  '/v0/files/:uuid.POST.request': z.object({
    // You can post any of these, but if you post `contents` you have to also send `version`
    contents: z.string().optional(),
    version: z.string().optional(), // GridFileSchema.shape.version.optional(), -- version # is pulled from rust
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
    public_link_access: PublicLinkAccessSchema,
    // These come, but we'll leave them off for now because we don't care about them
    // users: z.array(z.any()),
    // teams: z.array(z.any()),
  }),
  '/v0/files/:uuid/sharing.POST.request': z.object({ public_link_access: PublicLinkAccessSchema }),
  '/v0/files/:uuid/sharing.POST.response': z.object({ message: z.string() }),

  // Feedback
  '/v0/feedback.POST.request': z.object({
    feedback: z.string(),
    userEmail: z.string().optional(),
  }),
  '/v0/feedback.POST.response': z.object({
    message: z.string(),
  }),

  // Connections
  '/v0/connections/supported.GET.response': z.array(connectionConfigurationZ),
  '/v0/connections.GET.response': z.array(
    z.object({
      uuid: z.string(),
      name: z.string(),
      created_date: z.string().datetime(),
      updated_date: z.string().datetime(),
      type: z.enum(['POSTGRES']),
      database: z.string(),
    })
  ),
  '/v0/connections.POST.request': connection.omit({ uuid: true }),
  '/v0/connections.POST.response': z.any(), // TODO:
  '/v0/connections/:uuid/run.POST.request': z.object({}), // TODO:
  '/v0/connections/:uuid/run.POST.response': z.any(), // TODO:
};

// Types for API endpoitns
export type ApiTypes = {
  '/v0/files.GET.response': z.infer<(typeof ApiSchemas)['/v0/files.GET.response']>;
  '/v0/files.POST.request': z.infer<(typeof ApiSchemas)['/v0/files.POST.request']>;
  '/v0/files.POST.response': z.infer<(typeof ApiSchemas)['/v0/files.POST.response']>;

  '/v0/files/:uuid.GET.response': z.infer<(typeof ApiSchemas)['/v0/files/:uuid.GET.response']>;
  '/v0/files/:uuid.DELETE.response': z.infer<(typeof ApiSchemas)['/v0/files/:uuid.DELETE.response']>;
  '/v0/files/:uuid.POST.request': z.infer<(typeof ApiSchemas)['/v0/files/:uuid.POST.request']>;
  '/v0/files/:uuid.POST.response': z.infer<(typeof ApiSchemas)['/v0/files/:uuid.POST.response']>;

  '/v0/files/:uuid/sharing.GET.response': z.infer<(typeof ApiSchemas)['/v0/files/:uuid/sharing.GET.response']>;
  '/v0/files/:uuid/sharing.POST.request': z.infer<(typeof ApiSchemas)['/v0/files/:uuid/sharing.POST.request']>;
  '/v0/files/:uuid/sharing.POST.response': z.infer<(typeof ApiSchemas)['/v0/files/:uuid/sharing.POST.response']>;

  '/v0/feedback.POST.request': z.infer<(typeof ApiSchemas)['/v0/feedback.POST.request']>;
  '/v0/feedback.POST.response': z.infer<(typeof ApiSchemas)['/v0/feedback.POST.response']>;

  '/v0/connections.GET.response': z.infer<(typeof ApiSchemas)['/v0/connections.GET.response']>;
  '/v0/connections/supported.GET.response': z.infer<(typeof ApiSchemas)['/v0/connections/supported.GET.response']>;
  '/v0/connections.POST.request': z.infer<(typeof ApiSchemas)['/v0/connections.POST.request']>;
  '/v0/connections.POST.response': z.infer<(typeof ApiSchemas)['/v0/connections.POST.response']>;
  '/v0/connections/:uuid/run.POST.request': z.infer<(typeof ApiSchemas)['/v0/connections/:uuid/run.POST.request']>;
};
