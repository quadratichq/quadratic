import * as Sentry from '@sentry/node';
import { WorkOS, type AuthenticationResponse } from '@workos-inc/node';
import type { Algorithm } from 'jsonwebtoken';
import JwksRsa, { type GetVerificationKey } from 'jwks-rsa';
import { WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_JWKS_URI } from '../env-vars';
import type { ByEmailUser, User } from './auth';

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

export const authenticateWithRefreshTokenWorkos = async (args: {
  refreshToken: string;
  organizationId?: string;
}): Promise<AuthenticationResponse> => {
  return await getWorkos().userManagement.authenticateWithRefreshToken({
    clientId: WORKOS_CLIENT_ID,
    refreshToken: args.refreshToken,
    organizationId: args.organizationId,
  });
};

export const logoutSessionWorkos = async ({ sessionId }: { sessionId: string }) => {
  return await getWorkos().userManagement.revokeSession({
    sessionId,
  });
};

export const loginWithPasswordWorkos = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<{ refreshToken: string }> => {
  const { user, refreshToken } = await getWorkos().userManagement.authenticateWithPassword({
    clientId: WORKOS_CLIENT_ID,
    email,
    password,
  });

  if (!user.emailVerified) {
    await getWorkos().userManagement.updateUser({
      userId: user.id,
      emailVerified: true,
    });
  }

  return { refreshToken };
};

export const signupWithPasswordWorkos = async ({
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
  await getWorkos().userManagement.createUser({
    email,
    password,
    firstName,
    lastName,
    emailVerified: true,
  });

  return loginWithPasswordWorkos({ email, password });
};

export const authenticateWithCodeWorkos = async (code: string): Promise<{ refreshToken: string }> => {
  const { refreshToken, user } = await getWorkos().userManagement.authenticateWithCode({
    clientId: WORKOS_CLIENT_ID,
    code,
  });

  if (!user.emailVerified) {
    await getWorkos().userManagement.updateUser({
      userId: user.id,
      emailVerified: true,
    });
  }

  return { refreshToken };
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
