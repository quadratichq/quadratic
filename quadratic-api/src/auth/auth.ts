import { AUTH_TYPE } from '../env-vars';
import { getUsersFromAuth0 } from './auth0';

export type UsersRequest = {
  id: number;
  auth0Id: string;
};

export const getUsers = async (users: UsersRequest[]) => {
  switch (AUTH_TYPE) {
    case 'auth0':
      return await getUsersFromAuth0(users);
    default:
      throw new Error(`Unsupported auth type in getUsers(): ${AUTH_TYPE}`);
  }
};
