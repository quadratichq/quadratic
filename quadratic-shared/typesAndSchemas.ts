import z from 'zod';

// =============================================================================
// Previously: src/permissions.ts

export const UserRoleFileSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);
export type UserRoleFile = z.infer<typeof UserRoleFileSchema>;

export const UserRoleTeamSchema = z.enum(['OWNER', /*'ADMIN',*/ 'EDITOR', 'VIEWER']);
export type UserRoleTeam = z.infer<typeof UserRoleTeamSchema>;

export const FileAccessSchema = z.enum(['FILE_VIEW', 'FILE_EDIT', 'FILE_DELETE']);
export type FileAccess = z.infer<typeof FileAccessSchema>;

export const TeamAccessSchema = z.enum([
  // View a team, including its members and files
  'TEAM_VIEW',
  // Edit attributes of a team, like name/picture, as well as its members and files
  'TEAM_EDIT',
  // Delete a team
  'TEAM_DELETE',
  // Edit the billing info on a team
  'TEAM_BILLING_EDIT',
]);
export type TeamAccess = z.infer<typeof TeamAccessSchema>;

// =============================================================================
// TODO share these with the API

export const emailSchema = z.string().email();

const user = {
  id: z.number(),
  email: emailSchema,
  name: z.string().optional(),
  picture: z.string().url().optional(),
};
const TeamUserSchema = z.object({
  ...user,
  role: UserRoleTeamSchema,
});
export type TeamUser = z.infer<typeof TeamUserSchema>;
const FileUserSchema = z.object({
  ...user,
  role: UserRoleFileSchema,
});
export type FileUser = z.infer<typeof FileUserSchema>;

export const TeamSchema = z.object({
  uuid: z.string(),
  name: z
    .string()
    .min(1, { message: 'Must be at least 1 character.' })
    .max(140, { message: 'Cannot be longer than 140 characters.' }),
  picture: z.string().url().optional(),
  users: z.array(TeamUserSchema), // TODO not optional
  invites: z.array(z.object({ email: emailSchema, role: UserRoleTeamSchema, id: z.number() })),
  // files: z.any(), // TODO
  // TODO billing
});

// Shared types
const PublicLinkAccessSchema = z.enum(['EDIT', 'READONLY', 'NOT_SHARED']);
export type PublicLinkAccess = z.infer<typeof PublicLinkAccessSchema>;

const FileSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  created_date: z.string().datetime(),
  updated_date: z.string().datetime(),
  thumbnail: z.string().url().nullable(),
  // A string-ified version of `GridFile`
  contents: z.string(),
  // We could derive this to be one of the defined types for `version` from
  // our set of schemas, but it’s possible this is a _new_ version from
  // the server and the app needs to refresh to use it. So we just allow a
  // general string here.
  version: z.string(),
});

// TODO: remove this entirely, which means removing it from the API and changing client code
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
    FileSchema.pick({ uuid: true, name: true, created_date: true, updated_date: true, thumbnail: true }).extend({
      publicLinkAccess: PublicLinkAccessSchema,
    })
  ),
  '/v0/files.POST.request': z
    .object({
      name: z.string(),
      contents: z.string(),
      version: z.string(),
    })
    .optional(),
  '/v0/files.POST.response': FileSchema.pick({ uuid: true, name: true, created_date: true, updated_date: true }),

  /**
   *
   * File
   *
   */
  '/v0/files/:uuid.GET.response': z.object({
    file: FileSchema.extend({
      publicLinkAccess: PublicLinkAccessSchema,
    }),
    user: z.object({
      role: UserRoleFileSchema.optional(),
      access: z.array(FileAccessSchema),
      id: FileUserSchema.shape.id,
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
  '/v0/files/:uuid/thumbnail.POST.response': z.object({
    message: z.string(),
  }),

  // File sharing
  '/v0/files/:uuid/sharing.GET.response': z.object({
    file: z.object({
      // TODO: how, if at all, do we want to handle email visibility in the UI?
      // e.g. should this not return emails if you're not logged in?
      users: z.array(FileUserSchema),
      invites: z.array(z.object({ email: emailSchema, role: UserRoleFileSchema, id: z.number() })),
      publicLinkAccess: PublicLinkAccessSchema,
    }),
    user: z.object({
      access: z.array(FileAccessSchema),
      id: FileUserSchema.shape.id.optional(),
      role: UserRoleFileSchema.optional(),
    }),
    team: TeamSchema.pick({ uuid: true, name: true }).optional(),
  }),
  '/v0/files/:uuid/sharing.POST.request': z.object({
    publicLinkAccess: PublicLinkAccessSchema,
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
  '/v0/teams.GET.response': z.array(TeamSchema.pick({ uuid: true, name: true, picture: true })),
  '/v0/teams.POST.request': TeamSchema.pick({
    name: true,
    picture: true,
    // TODO billing
  }),
  '/v0/teams.POST.response': TeamSchema.pick({ uuid: true, name: true, picture: true }),
  '/v0/teams/:uuid.GET.response': z.object({
    team: TeamSchema,
    user: z.object({
      role: UserRoleTeamSchema,
      access: TeamAccessSchema.array(),
      id: z.number(),
    }),

    // TODO
    // files: []
    // TODO
    // billing: z.any().optional(),
  }),
  '/v0/teams/:uuid.POST.request': z.object({
    name: TeamSchema.shape.name.optional(),
    picture: TeamSchema.shape.picture,
    // TODO files, billing
  }),
  '/v0/teams/:uuid.POST.response': TeamSchema.pick({ uuid: true, name: true, picture: true }),

  // TODO equivalent for /files/:uuid/sharing
  '/v0/teams/:uuid/invites.POST.request': TeamUserSchema.pick({ email: true, role: true }),
  '/v0/teams/:uuid/invites.POST.response': TeamUserSchema.pick({ email: true, role: true }).extend({
    id: TeamUserSchema.shape.id,
  }),
  '/v0/teams/:uuid/invites/:inviteId.DELETE.response': z.object({ message: z.string() }),
  // Update a user's sharing role
  '/v0/teams/:uuid/users/:userId.POST.request': TeamUserSchema.pick({ role: true }),
  '/v0/teams/:uuid/users/:userId.POST.response': z.object({
    role: UserRoleTeamSchema,
  }),
  // Delete a user from a team
  '/v0/teams/:uuid/users/:userId.DELETE.response': z.object({
    message: z.string(),
  }),
};

type ApiKeys = keyof typeof ApiSchemas;
export type ApiTypes = {
  [key in ApiKeys]: z.infer<(typeof ApiSchemas)[key]>;
};
