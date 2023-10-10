import { PermissionSchema } from '../api/types';
import { isEditorOrAbove, isOwner } from '../permissions';

type Label = 'Owner' | 'Can edit' | 'Can view' | 'Leave' | 'Remove';

export function getUserShareOptions({ users, user, loggedInUser }: any /* TODO */) {
  let options: Label[] = [];

  const userIsOwner = isOwner(user.permission);
  const userIsEditorOrAbove = isEditorOrAbove(user.permission);

  // User being displayed is the logged in user
  if (loggedInUser.email === user.email) {
    if (userIsOwner) {
      if (users.filter((usr: any) => usr.permission === PermissionSchema.enum.OWNER).length > 1) {
        options.push('Owner', 'Can edit', 'Can view', 'Leave');
      } else {
        options.push('Owner');
      }
    } else if (userIsEditorOrAbove) {
      options.push('Can edit', 'Can view', 'Leave');
    } else {
      options.push('Can view', 'Leave');
    }
    // User being displayed is some other user in the system
  } else {
    if (isOwner(loggedInUser.permission)) {
      options.push('Owner', 'Can edit', 'Can view', 'Remove');
    } else if (isEditorOrAbove(loggedInUser.permission)) {
      if (userIsOwner) {
        options.push('Owner');
      } else {
        options.push('Can edit', 'Can view', 'Remove');
      }
    } else {
      if (userIsOwner) {
        options.push('Owner');
      } else if (userIsEditorOrAbove) {
        options.push('Can edit');
      } else {
        options.push('Can view');
      }
    }
  }

  // const label = userIsOwner ? 'Owner' : userIsEditorOrAbove ? 'Can edit' : 'Can view';

  return options;
}
