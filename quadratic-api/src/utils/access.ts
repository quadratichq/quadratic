// TODO write tests for this
import {
  FileAccess,
  FileAccessSchema,
  PublicLinkAccess,
  TeamAccessSchema,
  UserRoleFile,
  UserRoleFileSchema,
  UserRoleTeam,
  UserRoleTeamSchema,
} from 'quadratic-shared/typesAndSchemas';

export const getTeamAccess = (role: UserRoleTeam) => {
  const { TEAM_EDIT, TEAM_DELETE, TEAM_BILLING_EDIT, TEAM_VIEW } = TeamAccessSchema.enum;
  const { OWNER, EDITOR, VIEWER } = UserRoleFileSchema.enum;
  switch (role) {
    case OWNER:
      return [TEAM_EDIT, TEAM_VIEW, TEAM_DELETE, TEAM_BILLING_EDIT];
    case EDITOR:
      return [TEAM_EDIT, TEAM_VIEW];
    case VIEWER:
      return [TEAM_VIEW];
    default:
      return [];
  }
};

/**
 * Derive a user's access to a file based on a variety of inputs that may or may
 * not be applicable for any given file.
 */
export const getFileAccess = ({
  roleFile,
  roleTeam,
  publicLinkAccess,
}: {
  roleFile?: UserRoleFile;
  roleTeam?: UserRoleTeam;
  publicLinkAccess: PublicLinkAccess;
}) => {
  const { FILE_VIEW, FILE_EDIT, FILE_DELETE } = FileAccessSchema.enum;
  const access = new Set<FileAccess>();

  // Assign access based on public link access
  if (publicLinkAccess === 'EDIT') {
    access.add(FILE_EDIT).add(FILE_VIEW);
  } else if (publicLinkAccess === 'READONLY') {
    access.add(FILE_VIEW);
  }

  // Assign access based on user's explicitly-assigned role in the file's team (if applicable)
  if (roleTeam) {
    if (roleTeam === UserRoleTeamSchema.enum.OWNER || roleTeam === UserRoleTeamSchema.enum.EDITOR) {
      access.add(FILE_VIEW).add(FILE_EDIT).add(FILE_DELETE);
    } else {
      access.add(FILE_VIEW);
    }
  }

  // Assign access based on user's explicitly-assigned role on the file (if applicable)
  if (roleFile) {
    if (roleFile === UserRoleFileSchema.enum.OWNER) {
      access.add(FILE_VIEW).add(FILE_EDIT).add(FILE_DELETE);
    } else if (roleFile === UserRoleFileSchema.enum.EDITOR) {
      access.add(FILE_EDIT).add(FILE_VIEW);
    } else {
      access.add(FILE_VIEW);
    }
  }

  const out = Array.from(access);

  if (out.length === 0) {
    console.error('No file access controls found for user. This should never happen.');
  }

  return out;
};

export const firstRoleIsHigherThanSecond = (
  firstRole: UserRoleTeam | UserRoleFile,
  secondRole: UserRoleTeam | UserRoleFile
) => {
  switch (secondRole) {
    case 'OWNER':
      return false;
    case 'EDITOR':
      return firstRole === 'OWNER';
    case 'VIEWER':
      return firstRole === 'OWNER' || firstRole === 'EDITOR';
    default:
      // TODO: log error to sentry because we should never reach this
      return false;
  }
};
