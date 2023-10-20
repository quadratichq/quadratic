import z from 'zod';
import { AccessSchema, RoleSchema } from '../permissions';

// TODO share these with the API

const UserShareSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  role: RoleSchema,
  // Users in the share list don't need access
  // access: AccessSchema.array(),
  hasAccount: z.boolean(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});
export type UserShare = z.infer<typeof UserShareSchema>;

const TeamSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  picture: z.string().url().optional(),
  users: z.array(UserShareSchema),
  files: z.any(), // TODO
  // TODO billing
});

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

// Zod schemas for API endpoints
export const ApiSchemas = {
  /**
   *
   * Files
   *
   */
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

  /**
   *
   * File
   *
   */
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

    // TODO needs to return current user's role/access to determine whether these can be modified
  }),
  '/v0/files/:uuid/sharing.POST.request': z.object({
    public_link_access: PublicLinkAccessSchema,
    // newUser: z.object({}), TODO
  }),
  '/v0/files/:uuid/sharing.POST.response': z.object({ message: z.string() }),
  // TODO
  // '/v0/files/:uuid/sharing/:userId.POST.request': z.object({ permission }),
  // '/v0/files/:uuid/sharing/:userId.DELETE.request': z.object({ permission }),

  /**
   *
   * Feedback
   *
   */
  '/v0/feedback.POST.request': z.object({
    feedback: z.string(),
    userEmail: z.string().optional(),
  }),
  '/v0/feedback.POST.response': z.object({
    message: z.string(),
  }),

  /**
   *
   * Teams
   *
   */
  '/v0/teams.GET.response': z.array(TeamSchema.pick({ uuid: true, name: true /* TODO picture: true */ })),
  '/v0/teams.POST.request': TeamSchema.pick({ name: true, picture: true /* billing? */ }),
  '/v0/teams.POST.response': z.object({
    message: z.string(),
  }),
  '/v0/teams/:uuid.GET.response': z.object({
    team: TeamSchema,
    role: RoleSchema,
    access: AccessSchema.array(),
  }),
  '/v0/teams/:uuid.POST.request': TeamSchema.pick({ name: true, picture: true /* TODO files? */ }),
  '/v0/teams/:uuid.POST.response': z.object({
    message: z.string(),
  }),
  // TODO equivalent for /files/:uuid/sharing
  '/v0/teams/:uuid/sharing.POST.request': UserShareSchema.pick({ email: true, role: true }),
  '/v0/teams/:uuid/sharing.POST.response': z.object({
    message: z.string(),
  }),
  // TODO DELETE for user
  '/v0/teams/:uuid/sharing/:userId.POST.request': UserShareSchema.pick({ role: true }),
  '/v0/teams/:uuid/sharing/:userId.POST.response': z.object({
    message: z.string(),
  }),
};

type ApiKeys = keyof typeof ApiSchemas;
export type ApiTypes = {
  [key in ApiKeys]: z.infer<(typeof ApiSchemas)[key]>;
};
