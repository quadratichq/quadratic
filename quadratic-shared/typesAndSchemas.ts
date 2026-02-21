import { z } from 'zod';
import {
  AILanguagePreferencesSchema,
  AIMessagePromptSchema,
  AIRequestBodySchema,
  AIUsageSchema,
} from './typesAndSchemasAI';
import { ApiSchemasConnections, ConnectionListSchema } from './typesAndSchemasConnections';
import { ApiSchemasScheduledTasks } from './typesAndSchemasScheduledTasks';

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
  // Manage a team, like turn on/off preferences, manage billing, and delete the team
  'TEAM_MANAGE',
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
  timezone: z.string().nullable(),
  hasScheduledTasks: z.boolean(),
});

const TeamPrivateFileSchema = FileSchema.pick({
  uuid: true,
  name: true,
  createdDate: true,
  updatedDate: true,
  publicLinkAccess: true,
  thumbnail: true,
  hasScheduledTasks: true,
});
const TeamPublicFileSchema = TeamPrivateFileSchema.extend({
  creatorId: z.number(),
});
const TeamUserMakingRequestSchema = z.object({
  filePermissions: z.array(FilePermissionSchema),
  /**
   * Whether this file has edit restrictions due to billing limits (soft file limit for free teams).
   *
   * IMPORTANT: This is distinct from permission-based "View only" access:
   * - "View only" (permission-based): User doesn't have FILE_EDIT permission due to sharing settings
   * - "Upgrade to edit" (billing-based): User would have FILE_EDIT permission, but it's restricted
   *   because the team is on a free plan and this file exceeds the editable file limit
   *
   * When true, the UI should show "Upgrade to edit" messaging rather than "View only"
   */
  requiresUpgradeToEdit: z.boolean().optional(),
});

export const TeamClientDataKvSchema = z.record(z.any());

// Use this to store client-specific data that will be validated whenever it
// is delivered to or received from the client. When the client no longer needs
// pieces of this data, they can be removed from the schema and they'll be
// removed from the stored data as the user continues to use the app and the
// data is validated as it goes and comes over the network.
export const UserClientDataKvSchema = z
  .object({
    knowsAboutModelPicker: z.boolean().optional(),
    lastSeenChangelogVersion: z.string().optional(),
    featureWalkthroughCompleted: z.boolean().optional(),
  })
  .strip();
export type UserClientDataKv = z.infer<typeof UserClientDataKvSchema>;

const TeamSettingsSchema = z.object({
  analyticsAi: z.boolean(),
  aiRules: z.string().nullable().optional(),
});
export type TeamSettings = z.infer<typeof TeamSettingsSchema>;

export const LicenseSchema = z.object({
  limits: z.object({
    seats: z.number(),
  }),
  status: z.enum(['active', 'exceeded', 'revoked']),
});

const passwordSchema = z
  .string()
  .min(8, { message: 'Must be at least 8 characters.' })
  .refine((password) => /[A-Z]/.test(password), { message: 'Must contain at least one uppercase letter.' })
  .refine((password) => /[a-z]/.test(password), { message: 'Must contain at least one lowercase letter.' })
  .refine((password) => /[\\!"#$%&'()+,\-./:;<=>?@[\]^_`{|}~]/.test(password), {
    message: 'Must contain at least one special character.',
  });

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
      timezone: true,
      hasScheduledTasks: true,
    })
  ),
  '/v0/files.POST.request': z.object({
    name: FileSchema.shape.name,
    contents: z.string().optional(),
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
    team: TeamSchema.pick({ uuid: true, name: true }).extend({
      isOnPaidPlan: z.boolean(),
      planType: z.enum(['FREE', 'PRO', 'BUSINESS']).optional(),
      settings: TeamSettingsSchema,
      sshPublicKey: z.string(),
    }),
    userMakingRequest: z.object({
      clientDataKv: UserClientDataKvSchema.optional(),
      id: BaseUserSchema.shape.id.optional(),
      filePermissions: z.array(FilePermissionSchema),
      fileTeamPrivacy: z.enum(['PRIVATE_TO_ME', 'PRIVATE_TO_SOMEONE_ELSE', 'PUBLIC_TO_TEAM']).optional(),
      fileRole: UserFileRoleSchema.optional(),
      teamPermissions: z.array(TeamPermissionSchema).optional(),
      teamRole: UserTeamRoleSchema.optional(),
      restrictedModel: z.boolean(),
      /**
       * Whether this file has edit restrictions due to billing limits (soft file limit for free teams).
       *
       * IMPORTANT: This is distinct from permission-based "View only" access:
       * - "View only" (permission-based): User doesn't have FILE_EDIT permission due to sharing settings
       * - "Upgrade to edit" (billing-based): User would have FILE_EDIT permission, but it's restricted
       *   because the team is on a free plan and this file exceeds the editable file limit
       *
       * When true, the UI should show "Upgrade to edit" messaging rather than "View only"
       */
      requiresUpgradeToEdit: z.boolean().optional(),
    }),
    license: LicenseSchema,
  }),
  '/v0/files/:uuid.DELETE.response': z.object({
    message: z.string(),
  }),
  '/v0/files/:uuid.PATCH.request': z.object({
    name: FileSchema.shape.name.optional(),
    ownerUserId: BaseUserSchema.shape.id.or(z.null()).optional(),
    timezone: FileSchema.shape.timezone.optional(),
  }),
  '/v0/files/:uuid.PATCH.response': z.object({
    name: FileSchema.shape.name.optional(),
    ownerUserId: BaseUserSchema.shape.id.optional(),
    timezone: FileSchema.shape.timezone.optional(),
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
    team: TeamSchema.pick({ name: true, uuid: true }),
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
    users: z.array(FileUserSchema.extend({ isTeamMember: z.boolean() })),
    invites: z.array(
      z.object({ email: emailSchema, role: UserFileRoleSchema, id: z.number(), isTeamMember: z.boolean() })
    ),
  }),
  '/v0/files/:uuid/sharing.PATCH.request': z.object({
    publicLinkAccess: PublicLinkAccessSchema,
  }),
  '/v0/files/:uuid/sharing.PATCH.response': z.object({ publicLinkAccess: PublicLinkAccessSchema }),

  /**
   * File checkpoints
   */
  '/v0/files/:uuid/checkpoints.GET.response': z.object({
    file: FileSchema.pick({ name: true }),
    team: TeamSchema.pick({ uuid: true }),
    checkpoints: z.array(
      z.object({
        dataUrl: z.string().url(),
        sequenceNumber: z.number(),
        timestamp: z.string().datetime(),
        version: z.string(),
      })
    ),
    userMakingRequest: z.object({
      id: BaseUserSchema.shape.id,
      filePermissions: z.array(FilePermissionSchema),
      teamPermissions: z.array(TeamPermissionSchema),
    }),
  }),
  '/v0/files/:uuid/checkpoints/sequences/:sequenceNumber.GET.response': z.object({
    dataUrl: z.string().url(),
    sequenceNumber: z.number(),
    timestamp: z.string().datetime(),
    version: z.string(),
  }),

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
    context: z.string(),
  }),
  '/v0/feedback.POST.response': z.object({
    message: z.string(),
  }),

  /**
   * ===========================================================================
   * Examples
   * Given the publicly-accessible URL of a (example) file in production,
   * duplicate it to the user's account.
   *
   * TODO: rename to `templates` one day. Used to call these "examples" but now
   * we call them "templates".
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
        team: TeamSchema.pick({ id: true, uuid: true, name: true }),
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
    team: TeamSchema.pick({ id: true, uuid: true, name: true }).merge(
      z.object({ settings: TeamSettingsSchema, sshPublicKey: z.string(), onboardingComplete: z.boolean() })
    ),
    userMakingRequest: z.object({
      id: TeamUserSchema.shape.id,
      teamPermissions: z.array(TeamPermissionSchema),
      teamRole: UserTeamRoleSchema,
    }),
    billing: z.object({
      status: TeamSubscriptionStatusSchema.optional(),
      currentPeriodEnd: z.string().optional(),
      planType: z.enum(['FREE', 'PRO', 'BUSINESS']).optional(),
      usage: z.array(
        z.object({
          month: z.string(),
          ai_messages: z.number(),
        })
      ),
    }),
    files: z.array(
      z.object({
        file: TeamPublicFileSchema,
        userMakingRequest: TeamUserMakingRequestSchema,
      })
    ),
    filesPrivate: z.array(
      z.object({
        file: TeamPrivateFileSchema,
        userMakingRequest: TeamUserMakingRequestSchema,
      })
    ),
    users: z.array(TeamUserSchema),
    invites: z.array(z.object({ email: emailSchema, role: UserTeamRoleSchema, id: z.number() })),
    license: LicenseSchema,
    connections: ConnectionListSchema,
    clientDataKv: TeamClientDataKvSchema,
    fileLimit: z.object({
      isOverLimit: z.boolean(),
      totalFiles: z.number(),
      maxEditableFiles: z.number().optional(),
    }),
  }),
  '/v0/teams/:uuid.PATCH.request': z
    .object({
      name: TeamSchema.shape.name.optional(),
      clientDataKv: TeamClientDataKvSchema.optional(),
      settings: TeamSettingsSchema.extend({
        showConnectionDemo: z.boolean().optional(),
        aiRules: z.string().nullable().optional(),
      })
        .partial()
        .optional(),
      onboardingResponses: z
        .object({
          __version: z.number(),
          __createdAt: z.string().datetime(),
        })
        .catchall(z.any())
        .optional(),
    })
    .refine(
      (data) => {
        const keys = Object.keys(data) as Array<keyof typeof data>;
        return keys.some((key) => data[key] !== undefined);
      },
      {
        message: 'At least one supported field must be provided for the update.',
        path: [],
      }
    ),
  '/v0/teams/:uuid.PATCH.response': z.object({
    name: TeamSchema.shape.name,
    clientDataKv: TeamClientDataKvSchema,
    settings: TeamSettingsSchema.extend({ showConnectionDemo: z.boolean(), aiRules: z.string().nullable().optional() }),
  }),
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
  '/v0/teams/:uuid/users/:userId/budget.PATCH.response': z.object({
    monthlyBudgetLimit: z.number().nullable(),
  }),
  '/v0/teams/:uuid/billing/portal/session.GET.response': z.object({ url: z.string() }),
  '/v0/teams/:uuid/billing/checkout/session.GET.response': z.object({ url: z.string() }),
  '/v0/teams/:uuid/billing/retention-discount.GET.response': z.object({
    isEligible: z.boolean(),
  }),
  '/v0/teams/:uuid/billing/retention-discount.POST.response': z.object({
    message: z.string(),
  }),
  '/v0/teams/:uuid/file-limit.GET.response': z.object({
    // Backward compatible field - indicates if creating another file would exceed the editable limit
    hasReachedLimit: z.boolean(),
    // New fields for soft limit behavior
    isOverLimit: z.boolean(),
    totalFiles: z.number(),
    // Maximum editable files for free teams, undefined for paid teams
    maxEditableFiles: z.number().optional(),
    isPaidPlan: z.boolean(),
  }),

  /**
   * Connections (which are all under `/v0/teams/:uuid/connections/*`)
   */
  ...ApiSchemasConnections,

  /**
   * Scheduled Tasks (which are all under `/v0/files/:uuid/scheduled-tasks/*`)
   */
  ...ApiSchemasScheduledTasks,

  /**
   * ===========================================================================
   * User
   * ===========================================================================
   */
  '/v0/user/acknowledge.GET.response': z.object({ message: z.string(), userCreated: z.boolean() }),
  // TODO: this is considered deprecated as we moved onboarding to be part of the team
  // Once that ships, we can remove this from the schema and the API
  '/v0/user.POST.request': z.object({
    onboardingResponses: z
      .object({
        __version: z.number(),
      })
      .catchall(z.any()),
  }),
  '/v0/user.POST.response': z.object({ message: z.string() }),
  '/v0/user/client-data-kv.POST.request': UserClientDataKvSchema,
  '/v0/user/client-data-kv.POST.response': UserClientDataKvSchema,
  '/v0/user/client-data-kv.GET.response': z.object({
    clientDataKv: UserClientDataKvSchema.optional(),
  }),
  '/v0/user/ai-rules.PATCH.request': z.object({
    aiRules: z.string().nullable(),
  }),
  '/v0/user/ai-rules.PATCH.response': z.object({
    aiRules: z.string().nullable(),
  }),
  '/v0/user/ai-rules.GET.response': z.object({
    aiRules: z.string().nullable(),
  }),
  '/v0/user/ai-languages.PATCH.request': z.object({
    aiLanguages: AILanguagePreferencesSchema,
  }),
  '/v0/user/ai-languages.PATCH.response': z.object({
    aiLanguages: AILanguagePreferencesSchema,
  }),
  '/v0/user/ai-languages.GET.response': z.object({
    aiLanguages: AILanguagePreferencesSchema,
  }),

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

  /**
   * AI
   */
  '/v0/ai/chat.POST.request': AIRequestBodySchema,
  '/v0/ai/chat.POST.response': z.intersection(
    AIMessagePromptSchema,
    z.object({
      isOnPaidPlan: z.boolean(),
      exceededBillingLimit: z.boolean(),
      planType: z.enum(['FREE', 'PRO', 'BUSINESS']).optional(),
      allowOveragePayments: z.boolean().optional(),
      error: z.boolean().optional(),
      usage: AIUsageSchema.optional(),
      errorType: z.enum(['context_length', 'general']).optional(),
    })
  ),

  // AI Plan generation (for creating new files, no existing file required)
  '/v0/ai/plan.POST.request': z.object({
    teamUuid: z.string().uuid(),
    prompt: z.string().min(1),
    context: z
      .object({
        files: z
          .array(
            z.object({
              name: z.string(),
              type: z.string(),
              content: z.string().optional(),
            })
          )
          .optional(),
        connectionName: z.string().optional(),
        connectionType: z.string().optional(),
      })
      .optional(),
  }),
  '/v0/ai/plan.POST.response': z.object({
    plan: z.string(),
    isOnPaidPlan: z.boolean(),
    exceededBillingLimit: z.boolean(),
  }),

  // AI Suggestions generation (for creating new files, no existing file required)
  '/v0/ai/suggestions.POST.request': z.object({
    teamUuid: z.string().uuid(),
    context: z.object({
      files: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
            content: z.string().optional(),
            contentEncoding: z.enum(['text', 'base64']).optional(),
          })
        )
        .optional(),
      connectionName: z.string().optional(),
      connectionType: z.string().optional(),
    }),
  }),
  '/v0/ai/suggestions.POST.response': z.object({
    suggestions: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        prompt: z.string(),
      })
    ),
    isOnPaidPlan: z.boolean(),
    exceededBillingLimit: z.boolean(),
  }),

  '/v0/ai/feedback.PATCH.request': z.object({
    chatId: z.string().uuid(),
    messageIndex: z.number(),
    like: z.boolean().nullable(),
  }),
  '/v0/ai/feedback.PATCH.response': z.object({
    message: z.string(),
  }),

  '/v0/ai/codeRunError.PATCH.request': z.object({
    chatId: z.string().uuid(),
    messageIndex: z.number(),
    codeRunError: z.string(),
  }),
  '/v0/ai/codeRunError.PATCH.response': z.object({
    message: z.string(),
  }),

  '/v0/teams/:uuid/billing/ai/usage.GET.response': z.object({
    exceededBillingLimit: z.boolean(),
    billingLimit: z.number().nullable().optional(),
    currentPeriodUsage: z.number().nullable().optional(),
    planType: z.string().optional(),
    currentMonthAiCost: z.number().nullable().optional(),
    monthlyAiAllowance: z.number().nullable().optional(),
    remainingAllowance: z.number().nullable().optional(),
    teamMonthlyBudgetLimit: z.number().nullable().optional(),
    teamCurrentMonthOverageCost: z.number().nullable().optional(),
    teamCurrentMonthMessages: z.number().nullable().optional(),
    teamMessageLimit: z.number().nullable().optional(),
    userMonthlyBudgetLimit: z.number().nullable().optional(),
    userCurrentMonthCost: z.number().nullable().optional(),
    allowOveragePayments: z.boolean().optional(),
    billingPeriodStart: z.string().nullable().optional(),
    billingPeriodEnd: z.string().nullable().optional(),
  }),

  '/v0/teams/:uuid/billing/ai/usage/users.GET.response': z.object({
    users: z.array(
      z.object({
        userId: z.number(),
        planType: z.enum(['FREE', 'PRO', 'BUSINESS']),
        currentPeriodUsage: z.number().nullable(),
        billingLimit: z.number().nullable(),
        currentMonthAiCost: z.number().nullable(),
        monthlyAiAllowance: z.number().nullable(),
        userMonthlyBudgetLimit: z.number().nullable(),
        billedOverageCost: z.number().nullable(),
      })
    ),
  }),

  '/v0/teams/:uuid/billing/ai/usage/daily.GET.response': z.object({
    dailyCosts: z.array(
      z.object({
        date: z.string(),
        userId: z.number(),
        value: z.number(),
        billedOverageCost: z.number(),
      })
    ),
    monthlyAiAllowance: z.number().nullable(),
    billingPeriodStart: z.string(),
    billingPeriodEnd: z.string(),
    planType: z.string(),
  }),

  '/v0/teams/:uuid/billing/budget.PATCH.response': z.object({
    teamMonthlyBudgetLimit: z.number().nullable(),
  }),

  '/v0/teams/:uuid/billing/overage.PATCH.response': z.object({
    allowOveragePayments: z.boolean(),
  }),

  '/v0/billing/config.GET.response': z.object({
    proAiAllowance: z.number(),
    businessAiAllowance: z.number(),
  }),

  /**
   * ===========================================================================
   * Team Files
   * ===========================================================================
   */
  '/v0/teams/:uuid/files/deleted.GET.response': z.array(
    z.object({
      uuid: z.string().uuid(),
      name: z.string(),
      deletedDate: z.string().datetime(),
      ownerUserId: z.number().nullable(),
      thumbnail: z.string().url().nullable(),
    })
  ),
  '/v0/files/:uuid/restore.POST.response': z.object({
    message: z.string(),
    file: z.object({
      uuid: z.string().uuid(),
      name: z.string(),
      deleted: z.boolean(),
      deletedDate: z.string().datetime().nullable(),
    }),
  }),

  '/v0/auth/login-with-password.POST.request': z.object({
    email: z.string().email('Must be a valid email address.'),
    password: z.string(),
  }),
  '/v0/auth/login-with-password.POST.response': z.object({
    message: z.string(),
    pendingAuthenticationToken: z.string().optional(),
  }),

  '/v0/auth/signup-with-password.POST.request': z.object({
    email: z.string().email('Must be a valid email address.'),
    password: passwordSchema,
    firstName: z.string().min(1, { message: 'Must be at least 1 character.' }),
    lastName: z.string().min(1, { message: 'Must be at least 1 character.' }),
  }),
  '/v0/auth/signup-with-password.POST.response': z.object({
    message: z.string(),
    pendingAuthenticationToken: z.string().optional(),
  }),

  '/v0/auth/authenticate-with-code.POST.request': z.object({
    code: z.string(),
  }),
  '/v0/auth/authenticate-with-code.POST.response': z.object({
    message: z.string(),
    pendingAuthenticationToken: z.string().optional(),
  }),

  '/v0/auth/send-reset-password.POST.request': z.object({
    email: z.string().email('Must be a valid email address.'),
  }),
  '/v0/auth/send-reset-password.POST.response': z.object({
    message: z.string(),
  }),

  '/v0/auth/verify-email.POST.request': z.object({
    pendingAuthenticationToken: z.string(),
    code: z.string(),
  }),
  '/v0/auth/verify-email.POST.response': z.object({
    message: z.string(),
  }),

  '/v0/auth/reset-password.POST.request': z.object({
    token: z.string(),
    password: passwordSchema,
  }),
  '/v0/auth/reset-password.POST.response': z.object({
    message: z.string(),
  }),

  /**
   * ===========================================================================
   * URL Metadata
   * ===========================================================================
   */
  '/v0/url-metadata.GET.response': z.object({
    title: z.string().optional(),
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
