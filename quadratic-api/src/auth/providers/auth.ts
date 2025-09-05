import type { Request, Response } from 'express';
import { AUTH_TYPE } from '../../env-vars';
import { getUsersFromOry, getUsersFromOryByEmail, jwtConfigOry } from './ory';
import {
  authenticateWithCodeWorkos,
  authenticateWithMagicCodeWorkos,
  authenticateWithRefreshTokenWorkos,
  clearCookiesWorkos,
  getUsersFromWorkos,
  getUsersFromWorkosByEmail,
  jwtConfigWorkos,
  loginWithPasswordWorkos,
  logoutSessionWorkos,
  resetPasswordWorkos,
  sendMagicAuthCodeWorkos,
  sendResetPasswordWorkos,
  signupWithPasswordWorkos,
  verifyEmailWorkos,
} from './workos';

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
    case 'ory':
      return jwtConfigOry;
    case 'workos':
      return jwtConfigWorkos;
    default:
      throw new Error(`Unsupported auth type in jwtConfig(): ${AUTH_TYPE}`);
  }
};

export const loginWithPassword = async (args: { email: string; password: string; res: Response }) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await loginWithPasswordWorkos(args);
    default:
      throw new Error(`Unsupported auth type in loginWithPassword(): ${AUTH_TYPE}`);
  }
};

export const signupWithPassword = async (args: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  res: Response;
}) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await signupWithPasswordWorkos(args);
    default:
      throw new Error(`Unsupported auth type in signupWithPassword(): ${AUTH_TYPE}`);
  }
};

export const authenticateWithCode = async (args: { code: string; res: Response }) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await authenticateWithCodeWorkos(args);
    default:
      throw new Error(`Unsupported auth type in authenticateWithCode(): ${AUTH_TYPE}`);
  }
};

export const authenticateWithRefreshToken = async (args: { req: Request; res: Response }) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await authenticateWithRefreshTokenWorkos(args);
    default:
      throw new Error(`Unsupported auth type in authenticateWithRefreshToken(): ${AUTH_TYPE}`);
  }
};

export const verifyEmail = async (args: { pendingAuthenticationToken: string; code: string; res: Response }) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await verifyEmailWorkos(args);
    default:
      throw new Error(`Unsupported auth type in verifyEmail(): ${AUTH_TYPE}`);
  }
};

export const logoutSession = async (args: { sessionId: string; res: Response }) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await logoutSessionWorkos(args);
    default:
      throw new Error(`Unsupported auth type in logout(): ${AUTH_TYPE}`);
  }
};

export const sendResetPassword = async (args: { email: string; res: Response }) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await sendResetPasswordWorkos(args);
    default:
      throw new Error(`Unsupported auth type in sendResetPassword(): ${AUTH_TYPE}`);
  }
};

export const resetPassword = async (args: { token: string; password: string; res: Response }) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await resetPasswordWorkos(args);
    default:
      throw new Error(`Unsupported auth type in resetPassword(): ${AUTH_TYPE}`);
  }
};

export const sendMagicAuthCode = async (args: { email: string; res: Response }) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await sendMagicAuthCodeWorkos(args);
    default:
      throw new Error(`Unsupported auth type in sendMagicAuthCode(): ${AUTH_TYPE}`);
  }
};

export const authenticateWithMagicCode = async (args: { email: string; code: string; res: Response }) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return await authenticateWithMagicCodeWorkos(args);
    default:
      throw new Error(`Unsupported auth type in authenticateWithMagicCode(): ${AUTH_TYPE}`);
  }
};

export const clearCookies = (args: { res: Response }) => {
  switch (AUTH_TYPE) {
    case 'workos':
      return clearCookiesWorkos(args);
    default:
      throw new Error(`Unsupported auth type in clearCookies(): ${AUTH_TYPE}`);
  }
};
