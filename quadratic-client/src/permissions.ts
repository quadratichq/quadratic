import z from 'zod';

export const RoleSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);
export type Role = z.infer<typeof RoleSchema>;

export const UserRoleFileSchema = z.enum(['OWNER', 'EDITOR', 'VIEWER']);
export type UserRoleFile = z.infer<typeof UserRoleFileSchema>;

export const UserRoleTeamSchema = z.enum(['OWNER', /*'ADMIN',*/ 'EDITOR', 'VIEWER']);
export type UserRoleTeam = z.infer<typeof UserRoleTeamSchema>;

export const AccessSchema = z.enum([
  'FILE_VIEW',
  'FILE_EDIT',
  'FILE_DELETE',

  // View a team, including its members and files
  'TEAM_VIEW',
  // Edit attributes of a team, like name/picture, as well as its members and files
  'TEAM_EDIT',
  // Delete a team
  'TEAM_DELETE',
  // Edit the billing info on a team
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
