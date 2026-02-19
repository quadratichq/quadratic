import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import type { Connection } from 'quadratic-shared/typesAndSchemasConnections';
import { CONNECTION_DEMO, CONNECTION_FINANCIAL_DATA } from '../env-vars';
import logger from '../utils/logger';

/**
 * At a high level, the way this works is:
 * - We defined the details of a hard-coded connection in the env var
 * - If that value is present in the env AND the user's team has the setting to
 *   show the demo connection enabled, a demo connection will be available
 * - If that value isn't present (or malformed), no demo connection will be available
 * - When available, the demo connection is returned from the server for:
 *   - Display in the UI purposes (list of available connections)
 *   - Connection service queries (a file has a cell with a connection, the
 *     connection service can query that hard-coded connection uuid)
 */
export let connectionDemo: Connection | undefined;
try {
  connectionDemo = ApiSchemas['/v0/teams/:uuid/connections/:connectionUuid.GET.response'].parse({
    // Sensitive data in the env var
    ...JSON.parse(CONNECTION_DEMO.replace(/\\"/g, '"')),

    // Stuff we hard-code (these don't really matter for the UI)
    createdDate: '2022-01-01T00:00:00.000Z',
    updatedDate: '2022-01-01T00:00:00.000Z',
    isDemo: true,
  });
} catch (error) {
  logger.warn('CONNECTION_DEMO env var is missing or malformed. No demo connection will be available.', error);
}

/**
 * Financial Market Data — a platform-provided, read-only connection
 * backed by Intrinio stock price data stored as Parquet files on S3.
 * Follows the same pattern as the demo connection above.
 */
export let connectionFinancialData: Connection | undefined;
try {
  connectionFinancialData = ApiSchemas['/v0/teams/:uuid/connections/:connectionUuid.GET.response'].parse({
    ...JSON.parse(CONNECTION_FINANCIAL_DATA.replace(/\\"/g, '"')),

    createdDate: '2022-01-01T00:00:00.000Z',
    updatedDate: '2022-01-01T00:00:00.000Z',
    isDemo: true,
  });
} catch (error) {
  logger.warn(
    'CONNECTION_FINANCIAL_DATA env var is missing or malformed. No financial data connection will be available.',
    error
  );
}
