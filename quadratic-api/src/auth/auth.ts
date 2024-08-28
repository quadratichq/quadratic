import { AUTH_TYPE } from '../env-vars';

let { getUsersFromAuth0, jwtConfigAuth0, lookupUsersFromAuth0ByEmail } = {} as any;
let { getUsersFromOry, getUsersFromOryByEmail, jwtConfigOry } = {} as any;

switch (AUTH_TYPE) {
  case 'auth0':
    ({ getUsersFromAuth0, jwtConfigAuth0, lookupUsersFromAuth0ByEmail } = require('./auth0'));
    break;
  case 'ory':
    ({ getUsersFromOry, getUsersFromOryByEmail, jwtConfigOry } = require('./ory'));
    break;
  default:
    throw new Error(`Unsupported auth type in auth.ts: ${AUTH_TYPE}`);
}

export type UsersRequest = {
  id: number;
  auth0Id: string;
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
