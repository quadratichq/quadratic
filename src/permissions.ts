import z from 'zod';

export const RoleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);
export const AccessSchema = z.enum([
  'FILE_EDIT',
  'FILE_DELETE',
  'FILE_VIEW',
  'TEAM_EDIT',
  'TEAM_DELETE',
  'TEAM_VIEW',
  'BILLING_EDIT',
]);
export const PermissionsSchema = z.object({
  role: RoleSchema,
  access: AccessSchema.array(),
  status: z.enum(['INVITE_PENDING', 'INVITE_SENT', 'JOINED']).optional(),
});

export type Permissions = z.infer<typeof PermissionsSchema>;

// export const hasFileEditAccess(access: z.infer<typeof FileAccessSchema>[]): boolean {
//   return access.includes(FileAccessSchema.enum.EDIT);
// }
// export const hasFileViewAccess(access: z.infer<typeof FileAccessSchema>[]): boolean {
//   return access.includes(FileAccessSchema.enum.VIEW);
// }
