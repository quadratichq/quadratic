import * as Sentry from '@sentry/node';
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
const { FILE_VIEW, FILE_EDIT, FILE_MOVE, FILE_DELETE } = FilePermissionSchema.enum;

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
      Sentry.captureEvent({
        message: 'Invalid role deriving team permissions. This could should never be reached.',
        extra: { role },
      });
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
  publicLinkAccess,
  userFileRelationship,
}: {
  publicLinkAccess: PublicLinkAccess;
  userFileRelationship:
    | undefined
    | { owner: 'me' }
    | { owner: 'another-user'; fileRole?: UserFileRole }
    | { owner: 'team'; teamRole: UserTeamRole; fileRole?: UserFileRole };
}) => {
  const permissions = new Set<FilePermission>();
  const isLoggedIn = userFileRelationship !== undefined;

  // First look at the file's public link and set permissions, which override
  // any explicitly-assigned permissions.
  if (publicLinkAccess === 'EDIT') {
    permissions.add(FILE_VIEW);
    if (isLoggedIn) {
      // Only allow editting if they are logged in
      permissions.add(FILE_EDIT);
    }
  } else if (publicLinkAccess === 'READONLY') {
    permissions.add(FILE_VIEW);
  }

  // From here, based on the user's relationship to the file, 1 of 4 things
  // will happen, all of which are _in addition to_ any permissions derived
  // from the file's public link:

  // 1. If they're not logged in, we're done.
  if (!isLoggedIn) {
    return Array.from(permissions);
  }

  // Otherwise, they are logged in, so:

  // 2. Do they own the file? Give 'em full permissions
  if (userFileRelationship.owner === 'me') {
    permissions.add(FILE_VIEW).add(FILE_EDIT).add(FILE_DELETE).add(FILE_MOVE);
    return Array.from(permissions);
  }

  // 3. Does another user own the file?
  if (userFileRelationship.owner === 'another-user') {
    const { fileRole } = userFileRelationship;
    // Check for any explicitly-defined role in the file
    if (fileRole === UserFileRoleSchema.enum.EDITOR) {
      permissions.add(FILE_EDIT).add(FILE_VIEW);
    } else if (fileRole === UserFileRoleSchema.enum.VIEWER) {
      permissions.add(FILE_VIEW);
    }
    return Array.from(permissions);
  }

  // 4. Does a team own the file?
  if (userFileRelationship.owner === 'team') {
    const { teamRole, fileRole } = userFileRelationship;

    // Look at the team role
    if (teamRole === UserTeamRoleSchema.enum.OWNER || teamRole === UserTeamRoleSchema.enum.EDITOR) {
      permissions.add(FILE_VIEW).add(FILE_EDIT).add(FILE_MOVE).add(FILE_DELETE);
    } else if (teamRole === UserTeamRoleSchema.enum.VIEWER) {
      permissions.add(FILE_VIEW);
    }

    // Check for a file role (which can override the team role)
    if (fileRole === UserFileRoleSchema.enum.EDITOR) {
      permissions.add(FILE_EDIT).add(FILE_VIEW);
    } else {
      permissions.add(FILE_VIEW);
    }
    return Array.from(permissions);
  }

  // Note: we should never reach here
  console.warn('This code path should never be reached');
  Sentry.captureEvent({
    message: 'Invalid combination of arguments to `getFilePermissions`. This code path should never be reached.',
    extra: { publicLinkAccess, userFileRelationship },
  });
  return [];
};

/**
 * Determine whether a given role is higher than another role.
 * Sometimes a role is not assigned for a user<->file relationship, so we
 * permit `undefined`
 */
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
      // If it's undefined, than any value for the first role is higher
      // (unless it's also undefined)
      return Boolean(firstRole);
  }
};
