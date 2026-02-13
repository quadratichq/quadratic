import type { Response } from 'express';
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from 'plaid';
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
  body: z.object({}),
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
async function handler(req: RequestWithUser, res: Response<{ linkToken: string }>) {
  const {
    user: { id: userId },
  } = req;
  const {
    params: { uuid },
  } = parseRequest(req, schema);

  const {
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

    // Create user in Plaid if it doesn't exist.
    // This is needed to only get billed once per user.
    const userCreateRequest = { client_user_id: userId.toString() };
    const userCreateResponse = await plaidClient.userCreate(userCreateRequest, true);
    const plaidUserId = userCreateResponse.data.user_id;

    // Create link token with all products we want to support, and require if supported products
    const createLinkTokenRequest = {
      user: {
        client_user_id: userId.toString(),
      },
      user_id: plaidUserId,
      client_name: 'Quadratic',
      products: [Products.Transactions],
      required_if_supported_products: [Products.Investments, Products.Liabilities],
      country_codes: [CountryCode.Us],
      language: 'en',
      transactions: {
        days_requested: 730,
      },
    };

    const createLinkTokenResponse = await plaidClient.linkTokenCreate(createLinkTokenRequest);
    const linkToken = createLinkTokenResponse.data.link_token;

    return res.status(200).json({ linkToken });
  } catch (error) {
    console.error('Error creating Plaid link token:', error);
    throw new ApiError(500, 'Failed to create Plaid link token');
  }
}
