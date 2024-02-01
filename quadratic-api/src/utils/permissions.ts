import {
  FilePermission,
  FilePermissionSchema,
  PublicLinkAccess,
  TeamPermission,
  TeamPermissionSchema,
  UserFileRole,
  UserFileRoleSchema,
  UserTeamRole,
  UserTeamRoleSchema,
} from 'quadratic-shared/typesAndSchemas';
const { TEAM_EDIT, TEAM_DELETE, TEAM_BILLING_EDIT, TEAM_VIEW } = TeamPermissionSchema.enum;
const { FILE_VIEW, FILE_EDIT, FILE_DELETE } = FilePermissionSchema.enum;

/**
 * Derive a user’s permissions for a team (and its contents) based on their role.
 */
export const getTeamPermissions = (role: UserTeamRole): TeamPermission[] => {
  const { OWNER, EDITOR, VIEWER } = UserTeamRoleSchema.enum;
  switch (role) {
    case OWNER:
      return [TEAM_EDIT, TEAM_VIEW, TEAM_DELETE, TEAM_BILLING_EDIT];
    case EDITOR:
      return [TEAM_EDIT, TEAM_VIEW];
    case VIEWER:
      return [TEAM_VIEW];
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
  fileRole,
  teamRole,
  publicLinkAccess,
  isFileOwner,
  isLoggedIn,
}: {
  fileRole?: UserFileRole;
  teamRole?: UserTeamRole;
  publicLinkAccess: PublicLinkAccess;
  isFileOwner: boolean;
  isLoggedIn: boolean;
}) => {
  const permissions = new Set<FilePermission>();

  // First look at public link access
  if (publicLinkAccess === 'EDIT') {
    permissions.add(FILE_VIEW);
    // Only allow them to edit if they are logged in
    if (isLoggedIn) {
      permissions.add(FILE_EDIT);
    }
  } else if (publicLinkAccess === 'READONLY') {
    permissions.add(FILE_VIEW);
  }

  // If they're not logged in, we're done. Nothing else applies.
  if (!isLoggedIn) {
    return Array.from(permissions);
  }

  // Are they personal owner of the file? We'll return early cause they get full permissions
  if (isFileOwner) {
    permissions.add(FILE_VIEW).add(FILE_EDIT).add(FILE_DELETE);
    return Array.from(permissions);
  }

  // Based on user's explicitly-assigned role in the file's team (if applicable)
  if (teamRole) {
    if (teamRole === UserTeamRoleSchema.enum.OWNER || teamRole === UserTeamRoleSchema.enum.EDITOR) {
      permissions.add(FILE_VIEW).add(FILE_EDIT).add(FILE_DELETE);
      // Return because they already have full access now
      return Array.from(permissions);
    } else if (teamRole === UserTeamRoleSchema.enum.VIEWER) {
      permissions.add(FILE_VIEW);
    }
  }

  // Based on user's explicitly-assigned role in the file (if applicable)
  if (fileRole) {
    if (fileRole === UserFileRoleSchema.enum.EDITOR) {
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
  firstRole: UserTeamRole | UserFileRole | undefined,
  secondRole: UserTeamRole | UserFileRole | undefined
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
