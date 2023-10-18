import z from 'zod';

export const RoleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);
export type Role = z.infer<typeof RoleSchema>;

export const AccessSchema = z.enum([
  'FILE_EDIT',
  'FILE_DELETE',
  'FILE_VIEW',
  'TEAM_EDIT',
  'TEAM_DELETE',
  'TEAM_VIEW',
  'TEAM_BILLING_EDIT',
]);
export type Access = z.infer<typeof AccessSchema>;

export const hasAccess = (userAccess: Access[], accessType: Access) => userAccess.includes(accessType);

// export const hasFileEditAccess(access: z.infer<typeof FileAccessSchema>[]): boolean {
//   return access.includes(FileAccessSchema.enum.EDIT);
// }
// export const hasFileViewAccess(access: z.infer<typeof FileAccessSchema>[]): boolean {
//   return access.includes(FileAccessSchema.enum.VIEW);
// }
