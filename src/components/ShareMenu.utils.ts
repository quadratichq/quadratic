import { RoleSchema, hasAccess } from '../permissions';
const { OWNER, EDITOR, VIEWER } = RoleSchema.enum;

type Label = 'Owner' | 'Can edit' | 'Can view' | 'Leave' | 'Remove';

export function getUserShareOptions({ users, user, loggedInUser }: /* TODO */ any) {
  let options: Label[] = [];

  const userIsOwner = user.role === OWNER;
  const userIsEditor = user.role === EDITOR;
  // const userIsViewer = user.role === VIEWER;

  const isLoggedInUser = loggedInUser.email === user.email;

  // TODO
  // if (hasAccess(loggedInUser.access, 'TEAM_EDIT') || hasAccess(loggedInUser.access, 'FILE_EDIT')) {
  //   if (userIsOwner) {
  //     if (teamHasMoreThanOneOwner) {
  //       options.push('Owner', 'Can edit', 'Can view');
  //     } else {
  //       options.push('Owner');
  //     }
  //   } else if (userIsEditor) {
  //     options.push('Can edit', 'Can view');
  //   } else {
  //     options.push('Can view');
  //   }
  //   options.push(isLoggedInUser ? 'Leave' : 'Remove');
  // } else {
  //   if (userIsOwner) {
  //     options.push('Owner');
  //   } else if (userIsEditor) {
  //     options.push('Can edit');
  //   } else {
  //     options.push('Can view');
  //   }
  //   if (isLoggedInUser) {
  //     options.push('Leave');
  //   }
  // }
  // return options;

  if (isLoggedInUser) {
    if (hasAccess(loggedInUser.access, 'TEAM_EDIT') || hasAccess(loggedInUser.access, 'FILE_EDIT')) {
      if (loggedInUser.role === OWNER) {
        if (users.filter((usr: any) => usr.role === OWNER).length > 1) {
          options.push('Owner', 'Can edit', 'Can view', 'Leave');
        } else {
          options.push('Owner');
        }
      } else if (loggedInUser.role === EDITOR) {
        options.push('Can edit', 'Can view', 'Leave');
      }
    } else {
      options.push('Can view', 'Leave');
    }
    // User being displayed is some other user in the system
  } else {
    if (loggedInUser.role === OWNER) {
      options.push('Owner', 'Can edit', 'Can view', 'Remove');
    } else if (loggedInUser.role === EDITOR) {
      if (userIsOwner) {
        options.push('Owner');
      } else {
        options.push('Can edit', 'Can view', 'Remove');
      }
    } else if (loggedInUser.role === VIEWER) {
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
