import { MultiplayerUser } from '@/multiplayer/multiplayerTypes';
import { User } from '@auth0/auth0-spa-js';

export const convertName = (user: User | MultiplayerUser | undefined, you: boolean): string => {
  let name = '';
  if (user) {
    const firstName = (user as MultiplayerUser)?.first_name || (user as User)?.given_name;
    const lastName = (user as MultiplayerUser)?.last_name || (user as User)?.family_name;
    if (firstName || lastName) {
      if (firstName) {
        name += firstName + (lastName ? ' ' : '');
      }
      if (lastName) {
        name += lastName;
      }
    } else if (user.email) {
      name = user.email;
    } else {
      name = 'User ' + (user.index ? user.index + 1 : '0');
    }
  } else {
    name = 'User';
  }
  if (you) {
    name += ' (You)';
  }
  return name;
};

export const convertInitial = (user: User | MultiplayerUser | undefined): string => {
  if (user) {
    const firstName = (user as MultiplayerUser)?.first_name || (user as User)?.given_name;
    const lastName = (user as MultiplayerUser)?.last_name || (user as User)?.family_name;
    if (firstName || lastName) {
      return (firstName ? firstName[0] : '') + (lastName ? lastName[0] : '');
    } else if (user.email) {
      return user.email[0];
    }
  }
  return user?.index ? user.index + 1 : '0';
};

// const getDeviceName = (): string => {
//   let parser = new UAParser(window.navigator.userAgent);
//   let result = parser.getResult();
//   return result.device?.model || result.device?.type || '';
// }
