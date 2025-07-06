import * as Sentry from '@sentry/node';
import { WorkOS, type UserRegistrationActionResponseData } from '@workos-inc/node';
import type { Request, Response } from 'express';
import type { Algorithm } from 'jsonwebtoken';
import JwksRsa, { type GetVerificationKey } from 'jwks-rsa';
import { WORKOS_ACTIONS_SECRET, WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_JWKS_URI } from '../env-vars';
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

export const jwtConfigWorkos = {
  secret: JwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: WORKOS_JWKS_URI,
  }) as GetVerificationKey,
  algorithms: ['RS256'] as Algorithm[],
};

export const signupCallbackWorkos = async (req: Request, res: Response) => {
  let responsePayload: UserRegistrationActionResponseData = {
    type: 'user_registration',
    verdict: 'Deny',
  };

  try {
    const payload = req.body;
    console.log(payload);
    const sigHeader = req.headers['workos-signature'];
    console.log(sigHeader);

    if (!!sigHeader && typeof sigHeader === 'string') {
      const action = await getWorkos().actions.constructAction({
        payload: payload,
        sigHeader: sigHeader,
        secret: WORKOS_ACTIONS_SECRET,
      });
      console.log(action);
      console.log(action.id);
      console.log(action.object);
      if (action.object === 'user_registration_action_context') {
        console.log(action.userData);
      }

      await getWorkos().userManagement.updateUser({
        userId: action.id,
        emailVerified: true,
      });

      responsePayload = {
        type: 'user_registration',
        verdict: 'Allow',
      };
    }
  } catch (error) {
    console.error(error);
    Sentry.captureException({
      message: '[signupCallbackWorkos] error: ',
      level: 'error',
      extra: {
        error,
      },
    });
  }

  const response = await getWorkos().actions.signResponse(responsePayload, WORKOS_ACTIONS_SECRET);

  res.json(response);
};
