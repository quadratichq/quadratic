import * as Sentry from '@sentry/node';
import { WorkOS, type UserResponse } from '@workos-inc/node';
import type { Request, Response } from 'express';
import type { Algorithm } from 'jsonwebtoken';
import JwksRsa, { type GetVerificationKey } from 'jwks-rsa';
import { WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_JWKS_URI } from '../../env-vars';
import type { ByEmailUser, User } from './auth';

const WORKOS_REFRESH_TOKEN_COOKIE_NAME = 'refresh-token';
const WORKOS_HAS_SESSION_COOKIE_NAME = 'workos-has-session';

let workos: WorkOS | undefined;
const getWorkos = (): WorkOS => {
  if (!workos) {
    workos = new WorkOS(WORKOS_API_KEY, {
      clientId: WORKOS_CLIENT_ID,
    });
  }
  return workos;
};

export const getUsersFromWorkos = async (users: { id: number; auth0Id: string }[]): Promise<Record<number, User>> => {
  // If we got nothing, we return an empty object
  if (users.length === 0) return {};

  // Map the users we found by their Quadratic ID
  const usersById: Record<number, User> = {};

  const promises = users.map(async ({ id, auth0Id }) => {
    try {
      const workosUser = await getWorkos().userManagement.getUser(auth0Id);

      usersById[id] = {
        id,
        auth0Id,
        email: workosUser.email,
        name: `${workosUser.firstName ?? ''} ${workosUser.lastName ?? ''}`.trim(),
        picture: workosUser.profilePictureUrl ?? undefined,
      };
    } catch (e) {
      // if user is not found, log the error
      console.error(e);
      Sentry.captureException({
        message: 'Failed to retrieve users from Workos',
        level: 'error',
        extra: {
          auth0IdInOurDb: auth0Id,
          workosError: e,
        },
      });

      // and throw an error back to exit from the request
      throw new Error('Failed to retrieve all users from Workos');
    }
  });

  await Promise.all(promises);

  return usersById;
};

export const getUsersFromWorkosByEmail = async (email: string): Promise<ByEmailUser[]> => {
  let identities;

  try {
    identities = (await getWorkos().userManagement.listUsers({ email })).data;
  } catch (e) {
    console.error(e);
    return [];
  }

  return identities.map(({ id }) => ({ user_id: id }));
};

export const authenticateWithRefreshTokenWorkos = async ({
  req,
  res,
  organizationId,
}: {
  req: Request;
  res: Response;
  organizationId?: string;
}) => {
  const refreshToken = req.cookies?.[WORKOS_REFRESH_TOKEN_COOKIE_NAME];
  if (!refreshToken) {
    throw new Error('No refresh token found');
  }

  const {
    user,
    accessToken,
    refreshToken: newRefreshToken,
  } = await getWorkos().userManagement.authenticateWithRefreshToken({
    clientId: WORKOS_CLIENT_ID,
    refreshToken: refreshToken,
    organizationId: organizationId,
  });

  setCookiesWorkos({ res, refreshToken: newRefreshToken });

  const userResponse: UserResponse = {
    object: user.object,
    id: user.id,
    email: user.email,
    email_verified: user.emailVerified,
    profile_picture_url: user.profilePictureUrl,
    first_name: user.firstName,
    last_name: user.lastName,
    last_sign_in_at: user.lastSignInAt,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    external_id: user.externalId ?? undefined,
    metadata: user.metadata ?? undefined,
  };
  return {
    user: userResponse,
    access_token: accessToken,
    refresh_token: refreshToken,
  };
};

export const logoutSessionWorkos = async ({ sessionId, res }: { sessionId: string; res: Response }) => {
  clearCookiesWorkos({ res });

  return await getWorkos().userManagement.revokeSession({
    sessionId,
  });
};

export const loginWithPasswordWorkos = async ({
  email,
  password,
  res,
}: {
  email: string;
  password: string;
  res: Response;
}) => {
  const { user, refreshToken } = await getWorkos().userManagement.authenticateWithPassword({
    clientId: WORKOS_CLIENT_ID,
    email,
    password,
  });

  setCookiesWorkos({ res, refreshToken });

  if (!user.emailVerified) {
    await getWorkos().userManagement.updateUser({
      userId: user.id,
      emailVerified: true,
    });
  }
};

export const signupWithPasswordWorkos = async ({
  email,
  password,
  firstName,
  lastName,
  res,
}: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  res: Response;
}) => {
  await getWorkos().userManagement.createUser({
    email,
    password,
    firstName,
    lastName,
    emailVerified: true,
  });

  const { refreshToken } = await getWorkos().userManagement.authenticateWithPassword({
    clientId: WORKOS_CLIENT_ID,
    email,
    password,
  });

  setCookiesWorkos({ res, refreshToken });
};

export const authenticateWithCodeWorkos = async (args: { code: string; res: Response }) => {
  const { res, code } = args;

  const { refreshToken, user } = await getWorkos().userManagement.authenticateWithCode({
    clientId: WORKOS_CLIENT_ID,
    code,
  });

  setCookiesWorkos({ res, refreshToken });

  if (!user.emailVerified) {
    await getWorkos().userManagement.updateUser({
      userId: user.id,
      emailVerified: true,
    });
  }
};

export const jwtConfigWorkos = {
  secret: JwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: WORKOS_JWKS_URI,
  }) as GetVerificationKey,
  algorithms: ['RS256'] as Algorithm[],
};

export const clearCookiesWorkos = ({ res }: { res: Response }) => {
  res.clearCookie(WORKOS_REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });
  res.clearCookie(WORKOS_HAS_SESSION_COOKIE_NAME, {
    secure: true,
    sameSite: 'none',
  });
};

const setCookiesWorkos = ({ res, refreshToken }: { res: Response; refreshToken: string }) => {
  res.cookie(WORKOS_REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  });
  res.cookie(WORKOS_HAS_SESSION_COOKIE_NAME, 'true', {
    secure: true,
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  });
};
