import { AUTH_TYPE } from '../env-vars';
import { getUsersFromAuth0, jwtConfigAuth0, lookupUsersFromAuth0ByEmail } from './auth0';
import { getUsersFromOry, getUsersFromOryByEmail, jwtConfigOry } from './ory';

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
  picture?: string | undefined;
};

export type ByEmailUser = {
  user_id?: string;
};

export const getUsers = async (users: UsersRequest[]): Promise<Record<number, User>> => {
  switch (AUTH_TYPE) {
    case 'auth0':
      return await getUsersFromAuth0(users);
    case 'ory':
      return await getUsersFromOry(users);
    default:
      throw new Error(`Unsupported auth type in getUsers(): ${AUTH_TYPE}`);
  }
};

export const getUsersByEmail = async (email: string): Promise<ByEmailUser[]> => {
  switch (AUTH_TYPE) {
    case 'auth0':
      return await lookupUsersFromAuth0ByEmail(email);
    case 'ory':
      return await getUsersFromOryByEmail(email);
    default:
      throw new Error(`Unsupported auth type in getUsersByEmail(): ${AUTH_TYPE}`);
  }
};

export const jwtConfig = () => {
  switch (AUTH_TYPE) {
    case 'auth0':
      return jwtConfigAuth0;
    case 'ory':
      return jwtConfigOry;
    default:
      throw new Error(`Unsupported auth type in jwtConfig(): ${AUTH_TYPE}`);
  }
};
