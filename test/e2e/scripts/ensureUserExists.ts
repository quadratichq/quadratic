#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ensureUserExists } from './workos.helper.js';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

interface User {
  email: string;
  password: string;
}

interface UsersFile {
  users: User[];
}

/**
 * Parse command line arguments
 */
function parseArgs(): { verbose: boolean; filter?: string } {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const filterIndex = args.findIndex((a) => a === '--filter' || a === '-f');
  const filter = filterIndex !== -1 ? args[filterIndex + 1] : undefined;
  return { verbose, filter };
}

/**
 * Check if required environment variables are set for both environments
 */
function checkEnvironment(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!process.env.WORKOS_STAGING_API_KEY) missing.push('WORKOS_STAGING_API_KEY');
  if (!process.env.WORKOS_STAGING_CLIENT_ID) missing.push('WORKOS_STAGING_CLIENT_ID');
  if (!process.env.WORKOS_PREVIEW_API_KEY) missing.push('WORKOS_PREVIEW_API_KEY');
  if (!process.env.WORKOS_PREVIEW_CLIENT_ID) missing.push('WORKOS_PREVIEW_CLIENT_ID');

  return { valid: missing.length === 0, missing };
}

/**
 * Main function to ensure all E2E test users exist in WorkOS
 */
async function main() {
  const { verbose, filter } = parseArgs();

  console.log('🚀 Starting user creation/verification process...\n');

  // Check if running in CI
  if (process.env.CI) {
    console.log('ℹ️  Running in CI environment, skipping user creation');
    return;
  }

  // Check if .env file exists and has required variables
  if (!existsSync(envPath)) {
    console.error('❌ Error: .env file not found at:', envPath);
    console.error('   Please create a .env file with WorkOS credentials.');
    console.error('   Required variables:');
    console.error('     - WORKOS_STAGING_API_KEY and WORKOS_STAGING_CLIENT_ID (for staging)');
    console.error('     - WORKOS_PREVIEW_API_KEY and WORKOS_PREVIEW_CLIENT_ID (for preview)');
    process.exit(1);
  }

  const envCheck = checkEnvironment();
  if (!envCheck.valid) {
    console.error('❌ Error: Missing required WorkOS credentials in .env file');
    console.error('   Both staging and preview environments must be configured.');
    console.error('   Missing variables:');
    envCheck.missing.forEach((v) => console.error(`     - ${v}`));
    console.error('');
    console.error('   All required variables:');
    console.error('     - WORKOS_STAGING_API_KEY');
    console.error('     - WORKOS_STAGING_CLIENT_ID');
    console.error('     - WORKOS_PREVIEW_API_KEY');
    console.error('     - WORKOS_PREVIEW_CLIENT_ID');
    process.exit(1);
  }

  console.log('🔧 Configured environments: staging, preview\n');

  try {
    // Read test/scripts/users.json file
    const usersFilePath = join(__dirname, 'test-users.json');

    const fileContent = await readFile(usersFilePath, 'utf-8');
    const usersData: UsersFile = JSON.parse(fileContent);

    // Filter users if filter argument provided
    let usersToProcess = usersData.users;
    if (filter) {
      usersToProcess = usersData.users.filter((u) => u.email.includes(filter));
      console.log(`🔍 Filtering users matching: "${filter}"`);
    }

    const totalUsers = usersToProcess.length;
    console.log(`📋 Found ${totalUsers} users to process\n`);

    // Process users with progress tracking
    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (let i = 0; i < usersToProcess.length; i++) {
      const user = usersToProcess[i];
      const progress = `[${i + 1}/${totalUsers}]`;

      try {
        console.log(`${progress} Processing: ${user.email}`);

        await ensureUserExists(
          {
            email: user.email,
            password: user.password,
            firstName: 'E2E',
            lastName: 'Test',
          },
          verbose
        );

        successCount++;
        console.log(`${progress} ✓ Completed: ${user.email}\n`);
      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        failures.push({ email: user.email, error: errorMessage });
        console.error(`${progress} ✗ Failed: ${user.email}`);
        console.error(`   Error: ${errorMessage}\n`);
      }

      // Add a small delay between requests to avoid rate limiting
      if (i < usersToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log(`Total users:      ${totalUsers}`);
    console.log(`✓ Successful:     ${successCount}`);
    console.log(`✗ Failed:         ${failureCount}`);
    console.log('='.repeat(60));

    // Print failure details if any
    if (failures.length > 0) {
      console.log('\n❌ Failed users:');
      failures.forEach(({ email, error }) => {
        console.log(`   - ${email}`);
        console.log(`     ${error}`);
      });
      process.exit(1);
    }

    console.log('\n✅ All users processed successfully!');
  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
