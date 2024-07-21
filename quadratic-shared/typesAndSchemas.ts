import * as z from 'zod';
import { ApiSchemasConnections } from './typesAndSchemasConnections';

export const UserFileRoleSchema = z.enum(['EDITOR', 'VIEWER']);
export type UserFileRole = z.infer<typeof UserFileRoleSchema>;

export const UserTeamRoleSchema = z.enum(['OWNER', /*'ADMIN',*/ 'EDITOR', 'VIEWER']);
export type UserTeamRole = z.infer<typeof UserTeamRoleSchema>;

export const FilePermissionSchema = z.enum(['FILE_VIEW', 'FILE_EDIT', 'FILE_MOVE', 'FILE_DELETE']);
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

export const TeamSubscriptionStatusSchema = z.enum([
  'TRIALING',
  'ACTIVE',
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'PAUSED',
]);
export type TeamSubscriptionStatus = z.infer<typeof TeamSubscriptionStatusSchema>;

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
  id: z.number(),
  uuid: z.string(),
  name: z
    .string()
    .min(1, { message: 'Must be at least 1 character.' })
    .max(140, { message: 'Cannot be longer than 140 characters.' }),
  activated: z.boolean(),
  // picture: z.string().url().optional(),
  // TODO billing
});

// Shared types
const PublicLinkAccessSchema = z.enum(['EDIT', 'READONLY', 'NOT_SHARED']);
export type PublicLinkAccess = z.infer<typeof PublicLinkAccessSchema>;
const EduStatusSchema = z.enum([
  'INELIGIBLE',
  // 'ELIGIBLE',
  'ENROLLED',
  // 'NOT_ENROLLED'
]);

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

const TeamFilesSchema = z.array(
  z.object({
    file: FileSchema.pick({
      uuid: true,
      name: true,
      createdDate: true,
      updatedDate: true,
      publicLinkAccess: true,
      thumbnail: true,
    }),
    userMakingRequest: z.object({
      filePermissions: z.array(FilePermissionSchema),
    }),
  })
);

// Zod schemas for API endpoints
export const ApiSchemas = {
  /**
   * ===========================================================================
   * Files
   * Note: these are all files the user owns, so permissions are implicit
   * ===========================================================================
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
  '/v0/files.POST.request': z.object({
    name: FileSchema.shape.name,
    contents: z.string(),
    version: z.string(),
    teamUuid: TeamSchema.shape.uuid,
    isPrivate: z.boolean().optional(),
  }),
  '/v0/files.POST.response': z.object({
    file: FileSchema.pick({ uuid: true, name: true }),
    team: TeamSchema.pick({ uuid: true }),
  }),

  /**
   * ===========================================================================
   * File
   * Note: GET `/files/:uuid` may not have an authenticated user. All other
   * requests to this endpoint (or nested under it) require authentication
   * ===========================================================================
   */
  '/v0/files/:uuid.GET.response': z.object({
    file: FileSchema.extend({
      ownerUserId: BaseUserSchema.shape.id.optional(),
    }),
    team: TeamSchema.pick({ uuid: true, name: true }),
    userMakingRequest: z.object({
      id: BaseUserSchema.shape.id.optional(),
      filePermissions: z.array(FilePermissionSchema),
      fileTeamPrivacy: z.enum(['PRIVATE_TO_ME', 'PRIVATE_TO_SOMEONE_ELSE', 'PUBLIC_TO_TEAM']).optional(),
      fileRole: UserFileRoleSchema.optional(),
      teamPermissions: z.array(TeamPermissionSchema).optional(),
      teamRole: UserTeamRoleSchema.optional(),
    }),
  }),
  '/v0/files/:uuid.DELETE.response': z.object({
    message: z.string(),
  }),
  '/v0/files/:uuid.PATCH.request': z.object({
    name: FileSchema.shape.name.optional(),
    ownerUserId: BaseUserSchema.shape.id.or(z.null()).optional(),
  }),
  '/v0/files/:uuid.PATCH.response': z.object({
    name: FileSchema.shape.name.optional(),
    ownerUserId: BaseUserSchema.shape.id.optional(),
  }),
  '/v0/files/:uuid/thumbnail.POST.response': z.object({
    message: z.string(),
  }),
  '/v0/files/:uuid/move.POST.request': z.discriminatedUnion('owner', [
    z.object({ owner: z.literal('user') }),
    z.object({ owner: z.literal('team'), uuid: TeamSchema.shape.uuid }),
  ]),
  '/v0/files/:uuid/move.POST.response': z.object({
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
      TeamSchema.pick({ name: true }).extend({
        type: z.literal('team'),
      }),
    ]),
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
   * ===========================================================================
   * Feedback
   * ===========================================================================
   */
  '/v0/feedback.POST.request': z.object({
    feedback: z.string(),
    userEmail: z.string().optional(),
  }),
  '/v0/feedback.POST.response': z.object({
    message: z.string(),
  }),

  /**
   * ===========================================================================
   * Examples
   * Given the publicly-accessible URL of a (example) file in production,
   * duplicate it to the user's account.
   * ===========================================================================
   */
  '/v0/examples.POST.request': z.object({
    teamUuid: TeamSchema.shape.uuid,
    isPrivate: z.boolean(),
    publicFileUrlInProduction: z
      .string()
      .url()
      .refine((url) => url.startsWith('https://app.quadratichq.com/file/'), {
        message: 'Must be a URL for a file in production',
      })
      .refine(
        (url) => {
          const uuid = url.split('/').pop();
          const result = z.string().uuid().safeParse(uuid);
          return result.success;
        },
        { message: 'Must be a file UUID. Should match pattern: https://app.quadratichq.com/files/:fileUuid' }
      ),
  }),
  '/v0/examples.POST.response': FileSchema.pick({ name: true, uuid: true }),

  /**
   * ===========================================================================
   * Teams
   * ===========================================================================
   */
  '/v0/teams.GET.response': z.object({
    teams: z.array(
      z.object({
        team: TeamSchema.pick({ id: true, uuid: true, name: true, activated: true }),
        users: z.number(),
        userMakingRequest: z.object({
          teamPermissions: z.array(TeamPermissionSchema),
        }),
      })
    ),
    userMakingRequest: z.object({
      id: BaseUserSchema.shape.id,
    }),
  }),
  '/v0/teams.POST.request': TeamSchema.pick({
    name: true,
  }),
  '/v0/teams.POST.response': TeamSchema.pick({ uuid: true, name: true }),
  '/v0/teams/:uuid.GET.response': z.object({
    team: TeamSchema.pick({ id: true, uuid: true, name: true }),
    userMakingRequest: z.object({
      id: TeamUserSchema.shape.id,
      teamPermissions: z.array(TeamPermissionSchema),
      teamRole: UserTeamRoleSchema,
    }),
    billing: z.object({
      status: TeamSubscriptionStatusSchema.optional(),
      currentPeriodEnd: z.string().optional(),
    }),
    files: TeamFilesSchema,
    filesPrivate: TeamFilesSchema,
    users: z.array(TeamUserSchema),
    invites: z.array(z.object({ email: emailSchema, role: UserTeamRoleSchema, id: z.number() })),
  }),
  '/v0/teams/:uuid.PATCH.request': TeamSchema.pick({ name: true }),
  '/v0/teams/:uuid.PATCH.response': TeamSchema.pick({ name: true }),

  '/v0/teams/:uuid/invites.POST.request': TeamUserSchema.pick({ email: true, role: true }),
  '/v0/teams/:uuid/invites.POST.response': z
    .object({
      email: emailSchema,
      id: z.number(),
      role: UserTeamRoleSchema,
    })
    .or(
      z.object({
        userId: TeamUserSchema.shape.id,
        id: z.number(),
        role: UserTeamRoleSchema,
      })
    ),
  '/v0/teams/:uuid/invites/:inviteId.DELETE.response': z.object({ message: z.string() }),

  '/v0/teams/:uuid/users/:userId.PATCH.request': TeamUserSchema.pick({ role: true }),
  '/v0/teams/:uuid/users/:userId.PATCH.response': z.object({
    role: UserTeamRoleSchema,
  }),
  '/v0/teams/:uuid/users/:userId.DELETE.response': z.object({
    message: z.string(),
    redirect: z.boolean().optional(),
  }),
  '/v0/teams/:uuid/billing/portal/session.GET.response': z.object({ url: z.string() }),
  '/v0/teams/:uuid/billing/checkout/session.GET.response': z.object({ url: z.string() }),

  /**
   * ===========================================================================
   * Users
   * ===========================================================================
   */
  '/v0/users/acknowledge.GET.response': z.object({ message: z.string() }),

  /**
   * ===========================================================================
   * Connections
   * ===========================================================================
   */
  ...ApiSchemasConnections,

  /**
   *
   * Education
   *
   */
  '/v0/education.POST.response': z.object({
    eduStatus: EduStatusSchema,
  }),
  '/v0/education.GET.response': z.object({
    eduStatus: EduStatusSchema.optional(),
  }),
};

/**
 * ===========================================================================
 * Dynamically export the types
 * ===========================================================================
 */
type ApiKeys = keyof typeof ApiSchemas;
export type ApiTypes = {
  [key in ApiKeys]: z.infer<(typeof ApiSchemas)[key]>;
};
