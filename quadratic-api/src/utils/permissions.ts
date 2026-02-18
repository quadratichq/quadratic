import * as Sentry from '@sentry/node';
import type {
  FilePermission,
  PublicLinkAccess,
  TeamPermission,
  UserFileRole,
  UserTeamRole,
} from 'quadratic-shared/typesAndSchemas';
import {
  FilePermissionSchema,
  TeamPermissionSchema,
  UserFileRoleSchema,
  UserTeamRoleSchema,
} from 'quadratic-shared/typesAndSchemas';
import logger from './logger';

const { TEAM_EDIT, TEAM_VIEW, TEAM_MANAGE } = TeamPermissionSchema.enum;
const { FILE_VIEW, FILE_EDIT, FILE_MOVE, FILE_DELETE } = FilePermissionSchema.enum;

/**
 * Derive a user’s permissions for a team (and its contents) based on their role.
 */
export const getTeamPermissions = (role: UserTeamRole): TeamPermission[] => {
  const { OWNER, EDITOR, VIEWER } = UserTeamRoleSchema.enum;
  switch (role) {
    case OWNER:
      return [TEAM_EDIT, TEAM_VIEW, TEAM_MANAGE];
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
  // prettier-ignore
  userFileRelationship:
    // Not logged in
    | undefined
    // Logged in + file is on a team + it's private to me
    | { context: 'private-to-me', teamRole: UserTeamRole | undefined }
    // Logged in + file is on a team + it's private to another user + it was shared with me
    | { context: 'private-to-someone-else'; fileRole: UserFileRole | undefined }
    // Logged in + file is public to team
    | { context: 'public-to-team'; teamRole: UserTeamRole | undefined; fileRole: UserFileRole | undefined };
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

  // 2. Is the file private to the current user?
  if (userFileRelationship.context === 'private-to-me') {
    // Access depends on their role in the team
    if (
      userFileRelationship.teamRole === UserTeamRoleSchema.enum.OWNER ||
      userFileRelationship.teamRole === UserTeamRoleSchema.enum.EDITOR
    ) {
      permissions.add(FILE_VIEW).add(FILE_EDIT).add(FILE_DELETE).add(FILE_MOVE);
    } else if (userFileRelationship.teamRole === UserTeamRoleSchema.enum.VIEWER) {
      permissions.add(FILE_VIEW).add(FILE_EDIT).add(FILE_DELETE);
    }
    return Array.from(permissions);
  }

  // 3. Is the file private to someone else?
  if (userFileRelationship.context === 'private-to-someone-else') {
    const { fileRole } = userFileRelationship;
    // Check for any explicitly-defined role in the file
    if (fileRole === UserFileRoleSchema.enum.EDITOR) {
      permissions.add(FILE_VIEW).add(FILE_EDIT).add(FILE_MOVE);
    } else if (fileRole === UserFileRoleSchema.enum.VIEWER) {
      permissions.add(FILE_VIEW);
    }
    return Array.from(permissions);
  }

  // 4. Is the file public to the team?
  if (userFileRelationship.context === 'public-to-team') {
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
    } else if (fileRole === UserFileRoleSchema.enum.VIEWER) {
      permissions.add(FILE_VIEW);
    }
    return Array.from(permissions);
  }

  // Note: we should never reach here
  logger.warn('This code path should never be reached');
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
