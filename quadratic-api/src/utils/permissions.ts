import {
  Permission,
  PermissionSchema,
  PublicLinkAccess,
  UserRoleFile,
  UserRoleFileSchema,
  UserRoleTeam,
  UserRoleTeamSchema,
} from 'quadratic-shared/typesAndSchemas';
const { TEAM_EDIT, TEAM_DELETE, TEAM_BILLING_EDIT, TEAM_VIEW, FILE_VIEW, FILE_EDIT, FILE_DELETE } =
  PermissionSchema.enum;

/**
 * Derive a user’s permissions for a team (and its contents) based on their role.
 */
export const getTeamPermissions = (role: UserRoleTeam) => {
  const { OWNER, EDITOR, VIEWER } = UserRoleFileSchema.enum;
  switch (role) {
    case OWNER:
      return [TEAM_EDIT, TEAM_VIEW, TEAM_DELETE, TEAM_BILLING_EDIT, FILE_VIEW, FILE_EDIT, FILE_DELETE];
    case EDITOR:
      return [TEAM_EDIT, TEAM_VIEW, FILE_VIEW, FILE_EDIT, FILE_DELETE];
    case VIEWER:
      return [TEAM_VIEW, FILE_VIEW];
    default:
      console.error('Invalid role. This could should never be reached.');
      return [];
  }
};

/**
 * Derive a user's access to a file based on a variety of inputs that may or may
 * not be applicable for any given file.
 *
 * The idea is you can get access from different places. Highest assigned access wins.
 */
export const getFilePermissions = ({
  roleFile,
  roleTeam,
  publicLinkAccess,
}: {
  roleFile?: UserRoleFile;
  roleTeam?: UserRoleTeam;
  publicLinkAccess: PublicLinkAccess;
}) => {
  const permissions = new Set<Permission>();

  // Assign access based on public link access
  if (publicLinkAccess === 'EDIT') {
    permissions.add(FILE_EDIT).add(FILE_VIEW);
  } else if (publicLinkAccess === 'READONLY') {
    permissions.add(FILE_VIEW);
  }

  // Assign access based on user's explicitly-assigned role in the file's team (if applicable)
  if (roleTeam) {
    if (roleTeam === UserRoleTeamSchema.enum.OWNER || roleTeam === UserRoleTeamSchema.enum.EDITOR) {
      permissions.add(FILE_VIEW).add(FILE_EDIT).add(FILE_DELETE);
    } else {
      permissions.add(FILE_VIEW);
    }
  }

  // Assign access based on user's explicitly-assigned role on the file (if applicable)
  if (roleFile) {
    if (roleFile === UserRoleFileSchema.enum.OWNER) {
      permissions.add(FILE_VIEW).add(FILE_EDIT).add(FILE_DELETE);
    } else if (roleFile === UserRoleFileSchema.enum.EDITOR) {
      permissions.add(FILE_EDIT).add(FILE_VIEW);
    } else {
      permissions.add(FILE_VIEW);
    }
  }

  // Note: it's possible there are 0 permissions
  const out = Array.from(permissions);

  return out;
};

export const firstRoleIsHigherThanSecond = (
  firstRole: UserRoleTeam | UserRoleFile | undefined,
  secondRole: UserRoleTeam | UserRoleFile | undefined
) => {
  switch (secondRole) {
    case 'OWNER':
      return false;
    case 'EDITOR':
      return firstRole === 'OWNER';
    case 'VIEWER':
      return firstRole === 'OWNER' || firstRole === 'EDITOR';
    default:
      // If it's undefined, it's not higher than anything
      return false;
  }
};
