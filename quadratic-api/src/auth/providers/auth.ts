import { AUTH_TYPE } from '../../env-vars';
import { getUsersFromOry, jwtConfigOry } from './ory';
import { getUsersFromWorkos, jwtConfigWorkos } from './workos';

export type UsersRequest = {
  id: number;
  auth0Id: string;
  email: string;
};

export type User = {
  id: number;
  auth0Id: string;
  email: string;
  name?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  picture?: string | undefined;
};

export type ByEmailUser = {
  user_id?: string;
};

export const getUsers = async (users: UsersRequest[]): Promise<Record<number, User>> => {
  switch (AUTH_TYPE) {
    case 'ory':
      return await getUsersFromOry(users);
    case 'workos':
      return await getUsersFromWorkos(users);
    default:
      throw new Error(`Unsupported auth type in getUsers(): ${AUTH_TYPE}`);
  }
};

export const jwtConfig = () => {
  switch (AUTH_TYPE) {
    case 'ory':
      return jwtConfigOry;
    case 'workos':
      return jwtConfigWorkos;
    default:
      throw new Error(`Unsupported auth type in jwtConfig(): ${AUTH_TYPE}`);
  }
};
