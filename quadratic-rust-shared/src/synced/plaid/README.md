# Plaid Integration

This module provides integration with Plaid's API for accessing financial data, specifically transaction data from linked bank accounts.

## Overview

The Plaid integration follows a three-step flow:

1. **Create Link Token** - Server generates a token for the client to initialize Plaid Link
2. **User Links Account** - User authenticates via Plaid Link UI (frontend) and receives a public token
3. **Exchange Public Token** - Server exchanges the public token for an access token
4. **Fetch Data** - Server uses the access token to fetch transaction data

## Usage Flow

### 1. Initialize the Client

```rust
use quadratic_rust_shared::synced::plaid::client::{PlaidClient, PlaidEnvironment};

let client = PlaidClient::new(
    "your_client_id",
    "your_secret",
    PlaidEnvironment::Sandbox,
);
```

### 2. Create a Link Token (Server-side)

```rust
use plaid::model::Products;

// Specify which products you need consent for
let products = vec![
    Products::Transactions,
    Products::Investments,
    Products::Liabilities,
];

// This token is sent to the frontend to initialize Plaid Link
let link_token = client.create_link_token(
    "user_123",           // Your internal user ID
    "Your App Name",      // App name shown in Plaid Link
    products,             // Products to request consent for
).await?;

// Send link_token to frontend
```

### 3. User Links Account (Frontend)

On the frontend (TypeScript/React), use the link token to open Plaid Link:

```typescript
import { usePlaidLink } from 'react-plaid-link';

const { open } = usePlaidLink({
  token: linkToken,
  onSuccess: (publicToken, metadata) => {
    // Send publicToken to your backend
    sendToBackend(publicToken);
  },
});

// Open Plaid Link when user clicks a button
open();
```

### 4. Exchange Public Token (Server-side)

```rust
// Receive public_token from frontend
let access_token = client.exchange_public_token(&public_token).await?;

// Store access_token securely for future API calls
// The client now has the access_token set internally
```

## Testing with Sandbox

Plaid provides sandbox credentials for testing without real bank accounts.

### Sandbox Credentials

- **Username**: `user_good`
- **Password**: `pass_good`
- **MFA Code**: `1234` (if prompted)

### Test Institution

Use "First Platypus Bank" (`ins_109508`) for testing - it's a non-OAuth institution that supports all test credentials.

### Error Testing

You can test error scenarios by using special passwords:

- `error_ITEM_LOCKED` - Simulates a locked account
- `error_INVALID_CREDENTIALS` - Simulates invalid credentials
- `error_INSTITUTION_DOWN` - Simulates institution downtime

See [Plaid Sandbox Test Credentials](https://plaid.com/docs/sandbox/test-credentials/) for more.

## Environment Variables

When using environment variables for configuration:

```bash
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox  # or 'development', 'production'
```

## Access Token Management

### Token Validity

**Access tokens do not expire** - Plaid access tokens are long-lived and remain valid indefinitely by default.

However, **user consent** to access financial data can expire based on institution policies:

- **US Institutions**: 
  - Most institutions: No expiration
  - American Express, Capital One, Citibank: 12 months
  - Brex: 3 months
- **European Institutions**: Typically 180 days (PSD2 regulations)
- **UK Institutions**: Typically 180 days

### Monitoring Consent Expiration

Implement monitoring to handle consent expiration:

```rust
// Check consent expiration time
let item_response = client.item_get(&access_token).await?;
if let Some(expiration) = item_response.consent_expiration_time {
    println!("Consent expires: {}", expiration);
}
```

### Webhooks for Consent Expiration

Plaid sends webhooks 1 week before consent expires:
- `PENDING_DISCONNECT` - US/CA items
- `PENDING_EXPIRATION` - UK/EU items

When consent is about to expire, send the user through Plaid Link's update mode to refresh consent.

## Resources

- [Plaid API Documentation](https://plaid.com/docs/)
- [plaid-rs GitHub Repository](https://github.com/kurtbuilds/plaid-rs)
- [Plaid Link Web Guide](https://plaid.com/docs/link/web/)
- [Plaid Sandbox Test Credentials](https://plaid.com/docs/sandbox/test-credentials/)
- [Plaid Quickstart](https://plaid.com/docs/quickstart/)

## Security Considerations

1. **Never expose secrets**: Client ID and secret should only be used server-side
2. **Secure token storage**: Access tokens should be encrypted at rest
3. **HTTPS only**: All API calls must use HTTPS
4. **Consent refresh**: Monitor consent expiration and refresh proactively
5. **Audit logging**: Log all Plaid API interactions for security auditing
6. **Token revocation**: Implement ability to revoke access tokens when users disconnect

