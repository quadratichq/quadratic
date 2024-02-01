import * as z from 'zod';

// =============================================================================
// Previously: src/permissions.ts

export const UserFileRoleSchema = z.enum(['EDITOR', 'VIEWER']);
export type UserFileRole = z.infer<typeof UserFileRoleSchema>;

export const UserTeamRoleSchema = z.enum(['OWNER', /*'ADMIN',*/ 'EDITOR', 'VIEWER']);
export type UserTeamRole = z.infer<typeof UserTeamRoleSchema>;

export const FilePermissionSchema = z.enum(['FILE_VIEW', 'FILE_EDIT', 'FILE_DELETE']);
export type FilePermission = z.infer<typeof FilePermissionSchema>;

export const TeamPermissionSchema = z.enum([
  // View a team, including its members and files
  'TEAM_VIEW',
  // Edit attributes of a team, like name/picture, as well as its share users and files
  'TEAM_EDIT',
  // Delete a team
  'TEAM_DELETE',
  // Edit the billing info on a team
  'TEAM_BILLING_EDIT',
]);
export type TeamPermission = z.infer<typeof TeamPermissionSchema>;

// =============================================================================
// TODO share these with the API

export const emailSchema = z
  .string()
  .email()
  .transform((v) => v.toLowerCase());

const BaseUserSchema = z.object({
  id: z.number(),
  email: emailSchema,
  name: z.string().optional(),
  picture: z.string().url().optional(),
});
const TeamUserSchema = BaseUserSchema.extend({
  role: UserTeamRoleSchema,
});
export type TeamUser = z.infer<typeof TeamUserSchema>;
const FileUserSchema = BaseUserSchema.extend({
  role: UserFileRoleSchema,
});
export type FileUser = z.infer<typeof FileUserSchema>;

export const TeamSchema = z.object({
  uuid: z.string(),
  name: z
    .string()
    .min(1, { message: 'Must be at least 1 character.' })
    .max(140, { message: 'Cannot be longer than 140 characters.' }),
  picture: z.string().url().optional(),
  // TODO billing
});

// Shared types
const PublicLinkAccessSchema = z.enum(['EDIT', 'READONLY', 'NOT_SHARED']);
export type PublicLinkAccess = z.infer<typeof PublicLinkAccessSchema>;

const FileSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  createdDate: z.string().datetime(),
  updatedDate: z.string().datetime(),
  lastCheckpointSequenceNumber: z.number(),
  lastCheckpointVersion: z.string(),
  lastCheckpointDataUrl: z.string().url(),
  publicLinkAccess: PublicLinkAccessSchema,
  thumbnail: z.string().url().nullable(),
});

// Zod schemas for API endpoints
export const ApiSchemas = {
  /**
   *
   * Files
   * Note: these are all files the user owns, so permissions are implicit
   *
   */
  '/v0/files.GET.response': z.array(
    FileSchema.pick({
      uuid: true,
      name: true,
      createdDate: true,
      updatedDate: true,
      publicLinkAccess: true,
      thumbnail: true,
    })
  ),
  '/v0/files.POST.request': FileSchema.pick({
    name: true,
  })
    .extend({
      contents: z.string(),
      version: z.string(),
    })
    .optional(),
  '/v0/files.POST.response': FileSchema.pick({ uuid: true, name: true, createdDate: true, updatedDate: true }),

  /**
   *
   * File
   * Note: GET `/files/:uuid` may not have an authenticated user. All other
   * requests to this endpoint (or nested under it) require authentication
   *
   */
  '/v0/files/:uuid.GET.response': z.object({
    file: FileSchema,
    team: TeamSchema.pick({ uuid: true, name: true }).optional(),
    userMakingRequest: z.object({
      filePermissions: z.array(FilePermissionSchema),
      isFileOwner: z.boolean(),
      fileRole: UserFileRoleSchema.optional(),
    }),
  }),
  '/v0/files/:uuid.DELETE.response': z.object({
    message: z.string(),
  }),
  '/v0/files/:uuid.PATCH.request': FileSchema.pick({ name: true }),
  '/v0/files/:uuid.PATCH.response': FileSchema.pick({ name: true }),
  '/v0/files/:uuid/thumbnail.POST.response': z.object({
    message: z.string(),
  }),

  /**
   * File sharing
   */
  '/v0/files/:uuid/sharing.GET.response': z.object({
    file: FileSchema.pick({
      publicLinkAccess: true,
    }),
    userMakingRequest: z.object({
      id: FileUserSchema.shape.id,
      filePermissions: z.array(FilePermissionSchema),
      // User may or may not have explicitly-defined role on the file (or its team)
      fileRole: UserFileRoleSchema.optional(),
      teamRole: UserTeamRoleSchema.optional(),
    }),
    owner: z.discriminatedUnion('type', [
      BaseUserSchema.extend({
        type: z.literal('user'),
      }),
      TeamSchema.pick({ name: true, picture: true }).extend({
        type: z.literal('team'),
      }),
    ]),
    // TODO: how, if at all, do we want to handle email visibility in the UI?
    // e.g. should this not return emails if you're not logged in?
    users: z.array(FileUserSchema),
    invites: z.array(z.object({ email: emailSchema, role: UserFileRoleSchema, id: z.number() })),
  }),
  '/v0/files/:uuid/sharing.PATCH.request': z.object({
    publicLinkAccess: PublicLinkAccessSchema,
  }),
  '/v0/files/:uuid/sharing.PATCH.response': z.object({ publicLinkAccess: PublicLinkAccessSchema }),

  /**
   * File users
   */
  '/v0/files/:uuid/users/:userId.PATCH.request': FileUserSchema.pick({ role: true }),
  '/v0/files/:uuid/users/:userId.PATCH.response': FileUserSchema.pick({ role: true }),
  '/v0/files/:uuid/users/:userId.DELETE.response': z.object({
    id: FileUserSchema.shape.id,
    redirect: z.boolean().optional(),
  }),

  /**
   * File invites
   */
  '/v0/files/:uuid/invites.POST.request': FileUserSchema.pick({ email: true, role: true }),
  // Responds with either an invite or a user
  '/v0/files/:uuid/invites.POST.response': z
    .object({
      email: emailSchema,
      id: z.number(),
      role: UserFileRoleSchema,
    })
    .or(
      z.object({
        userId: FileUserSchema.shape.id,
        id: z.number(),
        role: UserFileRoleSchema,
      })
    ),
  '/v0/files/:uuid/invites/:inviteId.DELETE.response': z.object({ message: z.string() }),

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
  }),
  '/v0/teams.POST.response': TeamSchema.pick({ uuid: true, name: true, picture: true }),
  '/v0/teams/:uuid.GET.response': z.object({
    team: TeamSchema,
    userMakingRequest: z.object({
      id: TeamUserSchema.shape.id,
      teamPermissions: z.array(TeamPermissionSchema),
      teamRole: UserTeamRoleSchema,
    }),
    // TODO: still need this data
    // billing: z.any(),
    // files: z.array(
    //   z.object({
    //     file: FileSchema,
    //     userMakingRequest: z.object({
    //       filePermissions: z.array(FilePermissionSchema),
    //     }),
    //   })
    // ),
    users: z.array(TeamUserSchema),
    invites: z.array(z.object({ email: emailSchema, role: UserTeamRoleSchema, id: z.number() })),
  }),
  '/v0/teams/:uuid.POST.request': TeamSchema.pick({ name: true, picture: true }),
  '/v0/teams/:uuid.POST.response': TeamSchema.pick({ name: true, picture: true }),

  // TODO equivalent for /files/:uuid/sharing
  '/v0/teams/:uuid/invites.POST.request': TeamUserSchema.pick({ email: true, role: true }),
  '/v0/teams/:uuid/invites.POST.response': TeamUserSchema.pick({ email: true, role: true }).extend({
    id: TeamUserSchema.shape.id,
  }),
  '/v0/teams/:uuid/invites/:inviteId.DELETE.response': z.object({ message: z.string() }),
  // Update a user's sharing role
  '/v0/teams/:uuid/users/:userId.POST.request': TeamUserSchema.pick({ role: true }),
  '/v0/teams/:uuid/users/:userId.POST.response': z.object({
    role: UserTeamRoleSchema,
  }),
  // Delete a user from a team
  '/v0/teams/:uuid/users/:userId.DELETE.response': z.object({
    message: z.string(),
    redirect: z.boolean().optional(),
  }),
};

type ApiKeys = keyof typeof ApiSchemas;
export type ApiTypes = {
  [key in ApiKeys]: z.infer<(typeof ApiSchemas)[key]>;
};
