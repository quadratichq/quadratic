import { ConnectionType } from '@prisma/client';
import type { Response } from 'express';
import express from 'express';
import { query, validationResult } from 'express-validator';
import { OAuth2Client } from 'google-auth-library';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { ConnectionTypeDetails } from 'quadratic-shared/typesAndSchemasConnections';
import { ConnectionTypeDetailsSchema, ConnectionTypeSchema } from 'quadratic-shared/typesAndSchemasConnections';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } from '../../env-vars';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import type { Request } from '../../types/Request';
import { decryptFromEnv, encryptFromEnv } from '../../utils/crypto';
import logger from '../../utils/logger';

// validate the type is a valid connection type
export const validateType = () => query('type').optional().isString().isIn(Object.values(ConnectionType));

export const SyncedConnectionSchema = z.object({
  id: z.number(),
  connectionId: z.number(),
  percentCompleted: z.number(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DELETED']),
  updatedDate: z.string().datetime(),
  type: ConnectionTypeSchema,
  typeDetails: ConnectionTypeDetailsSchema,
  uuid: z.string().uuid(),
});

// Token refresh buffer: refresh tokens that expire within 10 minutes
const TOKEN_REFRESH_BUFFER_MS = 10 * 60 * 1000;

/**
 * Check if a Google Analytics OAuth token is expired or about to expire.
 * Returns true if the token should be refreshed.
 */
function isGoogleOAuthTokenExpired(typeDetails: ConnectionTypeDetails): boolean {
  if (!typeDetails.access_token || !typeDetails.refresh_token || !typeDetails.token_expires_at) {
    return false; // Not an OAuth connection (likely service account)
  }

  const expiresAt = new Date(typeDetails.token_expires_at as string).getTime();
  return expiresAt <= Date.now() + TOKEN_REFRESH_BUFFER_MS;
}

/**
 * Refresh a Google Analytics OAuth token and update the connection in the database.
 * Returns the updated typeDetails with the new access token and expiration.
 */
async function refreshGoogleOAuthToken(
  connectionId: number,
  typeDetails: ConnectionTypeDetails
): Promise<ConnectionTypeDetails> {
  const refreshToken = typeDetails.refresh_token as string;

  try {
    const oauth2Client = new OAuth2Client(
      GOOGLE_OAUTH_CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET,
      GOOGLE_OAUTH_REDIRECT_URI
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      logger.error(`Failed to refresh Google OAuth token for connection ${connectionId}: no access token returned`);
      return typeDetails;
    }

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    const updatedTypeDetails = {
      ...typeDetails,
      access_token: credentials.access_token,
      token_expires_at: expiresAt,
    };

    // Update the connection in the database with the refreshed token
    await dbClient.connection.update({
      where: { id: connectionId },
      data: {
        typeDetails: Buffer.from(encryptFromEnv(JSON.stringify(updatedTypeDetails))),
        updatedDate: new Date(),
      },
    });

    logger.info(`Refreshed Google OAuth token for connection ${connectionId}, new expiry: ${expiresAt}`);

    return updatedTypeDetails;
  } catch (error) {
    logger.error(`Failed to refresh Google OAuth token for connection ${connectionId}:`, error);
    // Return original typeDetails so the caller can still try (and get a proper expired-token error)
    return typeDetails;
  }
}

const router = express.Router();

router.get(
  '/synced-connection',
  validateM2MAuth(),
  validateType(),
  async (req: Request, res: Response<ApiTypes['/v0/internal/synced-connection.GET.response'][]>) => {
    const {
      query: { type },
    } = req;

    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).end();
    }

    // Get the synced connections
    // If no type is provided, get all synced connections
    // Only return active synced connections with non-archived parent connections
    const syncedConnections = await dbClient.syncedConnection.findMany({
      where: {
        status: 'ACTIVE',
        connection: {
          archived: null,
          ...(type ? { type: type as ConnectionType } : {}),
        },
      },
      include: {
        connection: {
          select: {
            id: true,
            type: true,
            uuid: true,
            typeDetails: true,
          },
        },
      },
    });

    const data = await Promise.all(
      syncedConnections.map(async (syncedConnection) => {
        let typeDetails: ConnectionTypeDetails = JSON.parse(
          decryptFromEnv(Buffer.from(syncedConnection.connection.typeDetails).toString('utf-8'))
        );

        // Automatically refresh expired Google Analytics OAuth tokens
        if (syncedConnection.connection.type === 'GOOGLE_ANALYTICS' && isGoogleOAuthTokenExpired(typeDetails)) {
          typeDetails = await refreshGoogleOAuthToken(syncedConnection.connectionId, typeDetails);
        }

        return {
          id: syncedConnection.id,
          uuid: syncedConnection.connection.uuid,
          connectionId: syncedConnection.connectionId,
          percentCompleted: syncedConnection.percentCompleted,
          status: syncedConnection.status,
          updatedDate: syncedConnection.updatedDate.toISOString(),
          type: syncedConnection.connection.type,
          typeDetails,
        };
      })
    );

    return res.status(200).json(data);
  }
);

export default router;
