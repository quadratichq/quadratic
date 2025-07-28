import { AUTH_TYPE } from '../env-vars';
import { getUsersFromAuth0, getUsersFromAuth0ByEmail, jwtConfigAuth0 } from './auth0';
import { getUsersFromOry, getUsersFromOryByEmail, jwtConfigOry } from './ory';
import {
  authenticateWithCodeWorkos,
  authenticateWithRefreshTokenWorkos,
  getUsersFromWorkos,
  getUsersFromWorkosByEmail,
  jwtConfigWorkos,
  loginWithPasswordWorkos,
  signupWithPasswordWorkos,
} from './workos';

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
    case 'workos':
      return await getUsersFromWorkos(users);
    default:
      throw new Error(`Unsupported auth type in getUsers(): ${AUTH_TYPE}`);
  }
};

export const getUsersByEmail = async (email: string): Promise<ByEmailUser[]> => {
  switch (AUTH_TYPE) {
    case 'auth0':
      return await getUsersFromAuth0ByEmail(email);
    case 'ory':
      return await getUsersFromOryByEmail(email);
    case 'workos':
      return await getUsersFromWorkosByEmail(email);
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
    case 'workos':
      return jwtConfigWorkos;
    default:
      throw new Error(`Unsupported auth type in jwtConfig(): ${AUTH_TYPE}`);
  }
};

export const authenticateWithRefreshToken = async ({ refreshToken }: { refreshToken: string }) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await authenticateWithRefreshTokenWorkos({ refreshToken });
    default:
      throw new Error(`Unsupported auth type in authenticateWithRefreshToken(): ${AUTH_TYPE}`);
  }
};

export const loginWithPassword = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<{ refreshToken: string }> => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await loginWithPasswordWorkos({ email, password });
    default:
      throw new Error(`Unsupported auth type in loginWithPassword(): ${AUTH_TYPE}`);
  }
};

export const signupWithPassword = async ({
  email,
  password,
  firstName,
  lastName,
}: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ refreshToken: string }> => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await signupWithPasswordWorkos({ email, password, firstName, lastName });
    default:
      throw new Error(`Unsupported auth type in signupWithPassword(): ${AUTH_TYPE}`);
  }
};

export const authenticateWithCode = async (code: string): Promise<{ refreshToken: string }> => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await authenticateWithCodeWorkos(code);
    default:
      throw new Error(`Unsupported auth type in authenticateWithCode(): ${AUTH_TYPE}`);
  }
};
