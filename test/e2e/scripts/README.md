# E2E Test Scripts

## createUser.js

Creates a validated user in QA and/or Staging WorkOS environments.

### Prerequisites

1. Set up environment variables in a `.env` file in the `test/e2e` directory (or export them in your shell):

```env
# QA environment
WORKOS_QA_API_KEY=your_qa_api_key
WORKOS_QA_CLIENT_ID=your_qa_client_id

# Staging environment
WORKOS_STAGING_API_KEY=your_staging_api_key
WORKOS_STAGING_CLIENT_ID=your_staging_client_id
```

2. Install dependencies (from `test/e2e` directory):

```bash
npm install
```

### Usage

**Important:** When using `npm run`, you must add `--` before the arguments!

```bash
# From test/e2e directory (note the -- before arguments)
npm run create-user -- --email <email> [options]

# Or run directly (no -- needed)
node scripts/createUser.js --email <email> [options]
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--email` | `-e` | User email address (required) | - |
| `--password` | `-p` | User password | `E2E_test` |
| `--firstName` | `-f` | User first name | `E2E` |
| `--lastName` | `-l` | User last name | `Test` |
| `--env` | - | Target environment: `qa`, `staging`, or `all` | `all` |
| `--help` | `-h` | Show help message | - |

### Examples

```bash
# Create user in both QA and Staging (default)
npm run create-user -- --email test@example.com --password SecurePass123

# Create user in QA only
npm run create-user -- --email test@example.com --env qa

# Create user in Staging only
npm run create-user -- --email test@example.com --env staging

# Create user with custom name
npm run create-user -- --email test@example.com --firstName John --lastName Doe
```

### What it does

1. Checks if the user already exists in the specified environment(s)
2. If user exists: ensures their email is marked as verified
3. If user doesn't exist: creates them with `emailVerified: true`
4. Provides progress feedback and a summary report

### Programmatic Usage

You can also import and use the `createUser` function in your own scripts:

```javascript
import { createUser } from './scripts/createUser.js';

const results = await createUser({
  email: 'test@example.com',
  password: 'SecurePass123',
  firstName: 'Test',
  lastName: 'User',
}, 'all'); // 'qa', 'staging', or 'all'

results.forEach(result => {
  console.log(`${result.environment}: ${result.created ? 'Created' : 'Exists'}`);
});
```
