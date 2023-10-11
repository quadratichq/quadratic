import { AccessSchema, RoleSchema } from '../permissions';
const { OWNER, EDITOR, VIEWER } = RoleSchema.enum;

type Label = 'Owner' | 'Can edit' | 'Can view' | 'Leave' | 'Remove';

export function getUserShareOptions({ users, user, loggedInUser }: /* TODO */ any) {
  let options: Label[] = [];

  const userIsOwner = user.permissions.role === OWNER;
  const userIsEditor = user.permissions.role === EDITOR;
  // const userIsViewer = user.role === VIEWER;

  const isLoggedInUser = loggedInUser.email === user.email;

  // User being displayed is the logged in user
  if (isLoggedInUser) {
    if (
      user.permissions.access.includes(AccessSchema.enum.TEAM_EDIT) ||
      user.permissions.access.includes(AccessSchema.enum.FILE_EDIT)
    ) {
      if (loggedInUser.permissions.role === OWNER) {
        if (users.filter((usr: any) => usr.permissions.role === OWNER).length > 1) {
          options.push('Owner', 'Can edit', 'Can view', 'Leave');
        } else {
          options.push('Owner');
        }
      } else if (loggedInUser.permissions.role === EDITOR) {
        options.push('Can edit', 'Can view', 'Leave');
      }
    } else {
      options.push('Can view', 'Leave');
    }
    // User being displayed is some other user in the system
  } else {
    if (loggedInUser.permissions.role === OWNER) {
      options.push('Owner', 'Can edit', 'Can view', 'Remove');
    } else if (loggedInUser.permissions.role === EDITOR) {
      if (userIsOwner) {
        options.push('Owner');
      } else {
        options.push('Can edit', 'Can view', 'Remove');
      }
    } else if (loggedInUser.permissions.role === VIEWER) {
      if (userIsOwner) {
        options.push('Owner');
      } else if (userIsEditor) {
        options.push('Can edit');
      } else {
        options.push('Can view');
      }
    }
  }

  // We should never reach this, but if we do the user gets VIEW ONLY access and we'll tell sentry about it
  if (options.length === 0) {
    options.push('Can view');
    // TODO log to sentry
  }

  return options;
}
