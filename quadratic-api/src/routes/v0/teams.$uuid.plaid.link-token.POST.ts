import type { Response } from 'express';
import { z } from 'zod';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: z.object({
    environment: z.enum(['sandbox', 'development', 'production']).default('sandbox'),
  }),
  params: z.object({ uuid: z.string().uuid() }),
});

/**
 * Create a Plaid Link token
 * 
 * This endpoint creates a link token that the frontend uses to initialize
 * Plaid Link, allowing users to search for and connect their bank accounts.
 * 
 * POST /v0/teams/:uuid/plaid/link-token
 */
async function handler(
  req: RequestWithUser,
  res: Response<{ linkToken: string }>
) {
  const {
    user: { id: userId },
  } = req;
  const {
    body: { environment },
    params: { uuid },
  } = parseRequest(req, schema);

  const {
    team: { id: teamId },
    userMakingRequest: { permissions },
  } = await getTeam({ uuid, userId });

  // Check permissions
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You don't have access to create connections for this team');
  }

  // Verify environment variables are set
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    console.error('Plaid credentials not configured');
    throw new ApiError(500, 'Plaid integration not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET environment variables.');
  }

  try {
    // TODO: Implement actual Plaid client integration
    // 
    // const plaidClient = new PlaidClient(
    //   clientId,
    //   secret,
    //   environment
    // );
    // 
    // const linkToken = await plaidClient.create_link_token(
    //   userId.toString(),
    //   'Quadratic'
    // );
    //
    // return res.status(200).json({ linkToken });

    // For now, return a placeholder
    // This will be replaced once the PlaidClient implementation is complete
    throw new ApiError(
      501,
      'Plaid integration not yet implemented. Please complete the PlaidClient implementation in quadratic-rust-shared.'
    );
  } catch (error) {
    console.error('Error creating Plaid link token:', error);
    throw new ApiError(500, 'Failed to create Plaid link token');
  }
}

