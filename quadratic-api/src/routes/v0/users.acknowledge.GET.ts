import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

/**
 * Some context:
 * This function gets called when the user is redirected from auth0 back to
 * the application on the client. It is useful because the userMiddleware has to
 * run some code the first time a new user logs into the app, so running the user
 * middleware on endpoint ensures that the first-time user logic gets run separate
 * from any other API calls.
 *
 * If we don't do that, then a user could login for the first time and see bad data
 * because multiple API calls are made in parallel on the client when the user hasn't
 * been created yet or associated with teams and/or files.
 */
async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/users/acknowledge.GET.response']>) {
  return res.status(200).json({ message: 'acknowledged', userCreated: req.userCreated });
}
