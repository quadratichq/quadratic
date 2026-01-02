import type { Response } from 'express';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { z } from 'zod';
import { PLAID_CLIENT_ID, PLAID_ENVIRONMENT, PLAID_SECRET } from '../../env-vars';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: z.object({
    publicToken: z.string().min(1),
  }),
  params: z.object({ uuid: z.string().uuid() }),
});

/**
 * Exchange Plaid public token for access token
 *
 * This endpoint receives the public token from Plaid Link (after user
 * successfully connects their account) and exchanges it for an access token
 * that can be used to fetch transaction data.
 *
 * POST /v0/teams/:uuid/plaid/exchange-token
 */
async function handler(req: RequestWithUser, res: Response<{ accessToken: string; itemId: string }>) {
  const {
    user: { id: userId },
  } = req;
  const {
    body: { publicToken },
    params: { uuid },
  } = parseRequest(req, schema);

  const {
    team: { id: teamId },
    userMakingRequest: { permissions },
  } = await getTeam({ uuid, userId });

  // Check permissions
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, "You don't have access to create connections for this team");
  }

  try {
    // Configure Plaid client with environment-specific settings
    const configuration = new Configuration({
      basePath: PlaidEnvironments[PLAID_ENVIRONMENT],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
          'PLAID-SECRET': PLAID_SECRET,
        },
      },
    });

    const plaidClient = new PlaidApi(configuration);

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    return res.status(200).json({
      accessToken,
      itemId,
    });
  } catch (error) {
    console.error('Error exchanging Plaid public token:', error);
    throw new ApiError(500, 'Failed to exchange Plaid public token');
  }
}
