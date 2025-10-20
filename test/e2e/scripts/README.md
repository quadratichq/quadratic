# E2E Test Scripts

## ensureUserExists.ts

This script ensures all E2E test users exist in WorkOS environments (staging and preview).

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in a `.env` file:
   ```env
   # Staging environment
   WORKOS_STAGING_API_KEY=your_staging_api_key
   WORKOS_STAGING_CLIENT_ID=your_staging_client_id

   # Preview environment
   WORKOS_PREVIEW_API_KEY=your_preview_api_key
   WORKOS_PREVIEW_CLIENT_ID=your_preview_client_id
   ```

### Usage

Run the script to create/verify all users from `users.json`:

```bash
npm run ensure-users
```

Or run it directly:

```bash
npx tsx scripts/ensureUserExists.ts
```

### What it does

1. Reads all users from `../users.json`
2. For each user, ensures they exist in both staging and preview WorkOS environments
3. Creates users if they don't exist
4. Verifies email addresses if users already exist
5. Provides progress feedback and a summary report

### Features

- **Progress tracking**: Shows current progress as `[X/Total]`
- **Error handling**: Continues processing even if individual users fail
- **Summary report**: Shows success/failure counts at the end
- **Rate limiting**: Adds small delays between requests to avoid API throttling
- **CI-aware**: Automatically skips in CI environments

### User Format

Users are defined in `users.json` with the following structure:

```json
{
  "users": [
    {
      "email": "e2e_test_user_chromium@quadratichq.com",
      "password": "E2E_test"
    }
  ]
}
```

All users are created with:
- First name: "E2E"
- Last name: "Test"
- Email verified: true
