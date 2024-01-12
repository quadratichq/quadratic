import { UserTeamRole, UserTeamRoleSchema } from 'quadratic-shared/typesAndSchemas';
import { RoleSchema, hasAccess } from '../permissions';

const DELETE = 'DELETE';

type Label = 'Owner' | 'Can edit' | 'Can view' | 'Leave' | 'Remove';

type TeamUserOption = UserTeamRole | typeof DELETE;

// function canDeleteInviteInTeam({ }) {

// }
// function canDeleteUserInTeam({ loggedInUser, user }) {
//   if (loggedInUser.hasAccess('TEAM_EDIT') || loggedInUser.hasAccess('FILE_EDIT') && ) {
//     if (loggedInUser.role === 'OWNER') {

//     }
//     if (loggedInUser.role === )
//   }

//   return false;
// }

export function getAvailableRolesForLoggedInUserInTeam({ role, numberOfOwners }: any) {
  const { OWNER, EDITOR, VIEWER } = UserTeamRoleSchema.enum;

  if (role === OWNER) {
    if (numberOfOwners > 1) {
      return [OWNER, EDITOR, VIEWER];
    } else {
      return [OWNER];
    }
  }
  if (role === EDITOR) {
    return [EDITOR, VIEWER];
  }
  return [VIEWER];
}
export function getAvailableRolesForUserInTeam({ loggedInUserRole, userRole }: any) {
  const { OWNER, EDITOR, VIEWER } = UserTeamRoleSchema.enum;

  if (loggedInUserRole === OWNER) {
    return [OWNER, EDITOR, VIEWER];
  }

  if (loggedInUserRole === EDITOR) {
    if (userRole === OWNER) {
      return [OWNER];
    } else {
      return [EDITOR, VIEWER];
    }
  }

  if (loggedInUserRole === VIEWER) {
    if (loggedInUserRole === OWNER) {
      return [OWNER];
    } else if (loggedInUserRole === EDITOR) {
      return [EDITOR];
    } else {
      return [VIEWER];
    }
  }

  console.error('Unexpected code path reached');
  return [VIEWER];
}

export function getTeamUserOption({ numberOfOwners, user, loggedInUser }: any) {
  let options: TeamUserOption[] = [];
  const { OWNER, EDITOR, VIEWER } = UserTeamRoleSchema.enum;

  const userIsOwner = user.role === OWNER;
  const userIsEditor = user.role === EDITOR;
  // const userIsViewer = user.role === VIEWER;
  const isLoggedInUser = loggedInUser.id === user.id;

  if (isLoggedInUser) {
    if (hasAccess(loggedInUser.access, 'TEAM_EDIT') || hasAccess(loggedInUser.access, 'FILE_EDIT')) {
      if (loggedInUser.role === OWNER) {
        if (numberOfOwners > 1) {
          options.push(OWNER, EDITOR, VIEWER, 'DELETE');
        } else {
          options.push(OWNER);
        }
      } else if (loggedInUser.role === EDITOR) {
        options.push(EDITOR, VIEWER, DELETE);
      }
    } else {
      options.push(VIEWER, DELETE);
    }
    // User being displayed is some other user in the system
  } else {
    if (loggedInUser.role === OWNER) {
      options.push(OWNER, EDITOR, VIEWER, DELETE);
    } else if (loggedInUser.role === EDITOR) {
      if (userIsOwner) {
        options.push(OWNER);
      } else {
        options.push(EDITOR, VIEWER, DELETE);
      }
    } else if (loggedInUser.role === VIEWER) {
      if (userIsOwner) {
        options.push(OWNER);
      } else if (userIsEditor) {
        options.push(EDITOR);
      } else {
        options.push(VIEWER);
      }
    }
  }

  // We should never reach this, but if we do the user gets VIEW ONLY access and we'll tell sentry about it
  if (options.length === 0) {
    options.push(VIEWER);
    // TODO log to sentry
  }

  return options;
}

const { OWNER, EDITOR, VIEWER } = RoleSchema.enum;

export function getUserShareOptions({ numberOfOwners, user, loggedInUser }: /* TODO */ any) {
  let options: Label[] = [];

  const userIsOwner = user.role === OWNER;
  const userIsEditor = user.role === EDITOR;
  // const userIsViewer = user.role === VIEWER;

  const isLoggedInUser = loggedInUser.id === user.id;

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
        if (numberOfOwners > 1) {
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
