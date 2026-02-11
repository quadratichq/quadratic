import { deriveSyncStateFromConnectionList, type SyncState } from '@/app/atoms/useSyncedConnection';
import { connectionClient, type SqlSchemaResponse } from '@/shared/api/connectionClient';
import { GET_SCHEMA_TIMEOUT } from '@/shared/constants/connectionsConstant';
import { isSyncedConnectionType, type ConnectionList } from 'quadratic-shared/typesAndSchemasConnections';

export interface ConnectionInfo {
  connectionId: string;
  connectionName: string;
  connectionType: string;
  semanticDescription: string | undefined;
  schema: SqlSchemaResponse | null;
  error: string | undefined;
  isSyncedConnection: boolean;
  syncState: SyncState | null;
}

export const getConnectionTableInfo = async (
  connection: ConnectionList[number],
  teamUuid: string
): Promise<ConnectionInfo> => {
  const isSynced = isSyncedConnectionType(connection.type);
  const syncState = isSynced
    ? deriveSyncStateFromConnectionList({
        syncedConnectionPercentCompleted: connection.syncedConnectionPercentCompleted,
        syncedConnectionLatestLogStatus: connection.syncedConnectionLatestLogStatus,
      })
    : null;

  const connectionDetailsShared = {
    connectionId: connection.uuid,
    connectionName: connection.name,
    connectionType: connection.type,
    semanticDescription: connection.semanticDescription,
    isSyncedConnection: isSynced,
    syncState,
  };

  try {
    const schema = await connectionClient.schemas.get(
      connection.type,
      connection.uuid,
      teamUuid,
      true,
      GET_SCHEMA_TIMEOUT
    );

    if (!schema) {
      return {
        ...connectionDetailsShared,
        schema: null,
        error: 'No schema data returned from connection service',
      };
    }

    return {
      ...connectionDetailsShared,
      schema,
      error: undefined,
    };
  } catch (error) {
    // Expected for stale/invalid connections - don't log Error object to avoid Sentry capture
    console.warn(
      `[getConnectionTableInfo] Failed to get schema for connection ${connection.uuid}: ${error instanceof Error ? error.message : String(error)}`
    );
    return {
      ...connectionDetailsShared,
      schema: null,
      error: `Failed to retrieve schema: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};

export const getConnectionMarkdown = (connectionInfo: ConnectionInfo): string => {
  const tableNames = connectionInfo.schema?.tables?.map((table) => table.name) || [];
  const tablesText = tableNames.length > 0 ? tableNames.join(', ') : 'No tables found';

  // Add sync state information for synced connections
  let syncStateText = '';
  if (connectionInfo.isSyncedConnection && connectionInfo.syncState) {
    switch (connectionInfo.syncState) {
      case 'not_synced':
        syncStateText =
          '\nsyncStatus: NOT_SYNCED (Initial sync has not started. This connection cannot be queried yet.)';
        break;
      case 'syncing':
        syncStateText =
          '\nsyncStatus: SYNCING (Data is currently being synced. This connection may have partial data or may not be queryable.)';
        break;
      case 'synced':
        syncStateText = '\nsyncStatus: SYNCED (Data sync is complete. This connection is ready to query.)';
        break;
      case 'failed':
        syncStateText =
          '\nsyncStatus: FAILED (The last sync failed. This connection may have stale or incomplete data.)';
        break;
    }
  }

  return `
## Connection
${connectionInfo.connectionName}

### Information
type: ${connectionInfo.connectionType}
id: ${connectionInfo.connectionId}
semanticDescription: ${connectionInfo.semanticDescription}${syncStateText}

### Database
${connectionInfo.schema?.database || 'Unknown'}

#### Tables
${tablesText}

`;
};

export const getConnectionSchemaMarkdown = (connectionInfo: ConnectionInfo): string => {
  // Add sync state information for synced connections
  let syncStateInfo = '';
  if (connectionInfo.isSyncedConnection && connectionInfo.syncState) {
    switch (connectionInfo.syncState) {
      case 'not_synced':
        syncStateInfo =
          'Sync Status: NOT_SYNCED (Initial sync has not started. This connection cannot be queried yet.)\n';
        break;
      case 'syncing':
        syncStateInfo =
          'Sync Status: SYNCING (Data is currently being synced. This connection may have partial data or may not be queryable.)\n';
        break;
      case 'synced':
        syncStateInfo = 'Sync Status: SYNCED (Data sync is complete. This connection is ready to query.)\n';
        break;
      case 'failed':
        syncStateInfo =
          'Sync Status: FAILED (The last sync failed. This connection may have stale or incomplete data.)\n';
        break;
    }
  }

  if (connectionInfo.error) {
    return `Connection: ${connectionInfo.connectionName} (${connectionInfo.connectionType})\nID: ${connectionInfo.connectionId}\n${syncStateInfo}Error: ${connectionInfo.error}\n`;
  }

  const tablesInfo =
    connectionInfo.schema?.tables
      ?.map((table: any) => {
        const columnsInfo =
          table.columns
            ?.map((col: any) => `  - ${col.name}: ${col.type}${col.is_nullable ? ' (nullable)' : ''}`)
            .join('\n') || '  No columns found';
        return `Table: ${table.name} (Schema: ${table.schema || 'public'})\n${columnsInfo}`;
      })
      .join('\n\n') || 'No tables found';

  return `Connection: ${connectionInfo.connectionName} (${connectionInfo.connectionType})\nID: ${connectionInfo.connectionId}\n${syncStateInfo}Database: ${connectionInfo.schema?.database || 'Unknown'}\n\n${tablesInfo}\n`;
};

export const PlaidDocs = `# Plaid Connection Schema Documentation

The following describes the tables and columns available in a Plaid connection. Use this information to write accurate SQL queries against Plaid data. Plaid connections use Apache DataFusion SQL dialect.

### 1. transactions — Bank & credit card transaction history
- Data type: Time-series, one row per transaction, grouped by the transaction's date field
- Sync behavior: Backfilled historically from the connection's start date.
- Key columns (after 2-level flattening):
  - account_id — Plaid account identifier
  - transaction_id — unique transaction identifier
  - date — transaction date (YYYY-MM-DD)
  - authorized_date, datetime, authorized_datetime — additional timing
  - amount — transaction amount (positive = debit, negative = credit)
  - iso_currency_code, unofficial_currency_code
  - name — transaction description from institution
  - original_description — raw description (enabled via option)
  - merchant_name, merchant_entity_id
  - payment_channel — online, in store, or other
  - pending — whether transaction is still pending
  - pending_transaction_id
  - transaction_type, transaction_code
  - category, category_id — legacy categorization
  - personal_finance_category_primary — broad category (e.g., "FOOD_AND_DRINK")
  - personal_finance_category_detailed — specific category (e.g., "FOOD_AND_DRINK_RESTAURANTS")
  - personal_finance_category_confidence_level
  - personal_finance_category_icon_url
  - location_address, location_city, location_region, location_postal_code, location_country, location_lat, location_lon, location_store_number
  - payment_meta_by_order_of, payment_meta_payee, payment_meta_payer, payment_meta_payment_method, payment_meta_payment_processor, payment_meta_ppd_id, payment_meta_reason, payment_meta_reference_number
  - counterparties — serialized as JSON string (array, beyond 2-level depth)
  - check_number

### 2. investments — Investment account transaction history
- Data type: Time-series, one row per investment transaction, grouped by the transaction's date field
- Sync behavior: Backfilled historically. Returns None if the account doesn't support investments.
- Key columns:
  - account_id — Plaid account identifier
  - investment_transaction_id — unique identifier
  - date — transaction date (YYYY-MM-DD)
  - name — description of the transaction
  - amount — dollar amount
  - price — price per unit
  - quantity — number of units
  - fees — fees associated with the transaction
  - type — buy, sell, cash, fee, transfer, etc.
  - subtype — more specific type
  - security_id — identifier for the security
  - iso_currency_code, unofficial_currency_code
  - cancel_transaction_id

### 3. liabilities — Credit cards, mortgages, and student loans
- Data type: Point-in-time snapshot, only fetched when syncing today's date (historical backfills skipped)
- Sync behavior: Returns an object keyed by type (credit, mortgage, student), each containing an array. The code adds a liability_type column to distinguish them.
- Key columns:
  - date — snapshot date (added by processing code)
  - liability_type — credit, mortgage, or student (added by processing code)
  - Credit card fields: account_id, aprs (serialized JSON), is_overdue, last_payment_amount, last_payment_date, last_statement_issue_date, last_statement_balance, minimum_payment_amount, next_payment_due_date
  - Mortgage fields: account_id, account_number, current_late_fee, escrow_balance, has_pmi, has_prepayment_penalty, interest_rate_percentage, interest_rate_type, last_payment_amount, last_payment_date, loan_type_description, loan_term, maturity_date, next_monthly_payment, next_payment_due_date, origination_date, origination_principal_amount, past_due_amount, property_address_* (flattened), ytd_interest_paid, ytd_principal_paid
  - Student loan fields: account_id, account_number, disbursement_dates, expected_payoff_date, guarantor, interest_rate_percentage, is_overdue, last_payment_amount, last_payment_date, last_statement_issue_date, last_statement_balance, loan_name, loan_status_* (flattened), minimum_payment_amount, next_payment_due_date, origination_date, origination_principal_amount, outstanding_interest_amount, payment_reference_number, pslf_status_* (flattened), repayment_plan_* (flattened), sequence_number, servicer_address_* (flattened), ytd_interest_paid, ytd_principal_paid

### 4. balances — Current account balances
- Data type: Point-in-time snapshot, only fetched when syncing today's date (historical backfills skipped)
- Sync behavior: Returns a flat array of all linked accounts with their current balances. Non-paginated.
- Key columns (after 2-level flattening):
  - date — snapshot date (added by processing code)
  - account_id — Plaid account identifier
  - name — account name (e.g., "Plaid Checking")
  - official_name — official institution account name
  - type — depository, credit, loan, investment, etc.
  - subtype — checking, savings, credit card, mortgage, etc.
  - mask — last 4 digits of the account number
  - persistent_account_id
  - balances_available — available balance (amount that can be spent)
  - balances_current — current balance (total amount in account)
  - balances_limit — credit limit (for credit accounts)
  - balances_iso_currency_code
  - balances_unofficial_currency_code
`;
