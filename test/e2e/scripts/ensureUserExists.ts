#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ensureUserExists, getExistingUserEmails } from './workos.helper.js';

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
function parseArgs(): { skipExisting: boolean } {
  const args = process.argv.slice(2);
  return {
    // Use --skip-existing to only process new users (requires fetching existing users from WorkOS)
    skipExisting: args.includes('--skip-existing') || args.includes('-s'),
  };
}

/**
 * Main function to ensure all E2E test users exist in WorkOS
 */
async function main() {
  const { skipExisting } = parseArgs();

  console.log('🚀 Starting user creation/verification process...\n');

  if (skipExisting) {
    console.log('⏭️  Skip-existing mode: will only process new users\n');
  }

  try {
    // Read test/scripts/users.json file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const usersFilePath = join(__dirname, 'test-users.json');

    const fileContent = await readFile(usersFilePath, 'utf-8');
    const usersData: UsersFile = JSON.parse(fileContent);

    const totalUsers = usersData.users.length;
    console.log(`📋 Found ${totalUsers} users in configuration\n`);

    // Check if running in CI
    if (process.env.CI) {
      console.log('ℹ️  Running in CI environment, skipping user creation');
      return;
    }

    // Determine which users need to be processed
    let usersToProcess: User[] = usersData.users;
    let skippedCount = 0;

    if (skipExisting) {
      console.log('🔍 Fetching existing users from WorkOS...\n');
      const existingEmails = await getExistingUserEmails();
      console.log('');

      const newUsers: User[] = [];
      for (const user of usersData.users) {
        if (existingEmails.has(user.email)) {
          skippedCount++;
        } else {
          newUsers.push(user);
        }
      }

      usersToProcess = newUsers;

      if (skippedCount > 0) {
        console.log(`⏭️  Skipped ${skippedCount} existing user(s)\n`);
      }

      if (usersToProcess.length === 0) {
        console.log('\n✅ All users already exist! Nothing to do.\n');
        return;
      }

      console.log(`📝 ${usersToProcess.length} new user(s) to create\n`);
    }

    // Process users with progress tracking
    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (let i = 0; i < usersToProcess.length; i++) {
      const user = usersToProcess[i];
      const progress = `[${i + 1}/${usersToProcess.length}]`;

      try {
        console.log(`${progress} Processing: ${user.email}`);

        await ensureUserExists({
          email: user.email,
          password: user.password,
          firstName: 'E2E',
          lastName: 'Test',
        });

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
    console.log(`Total in config:  ${totalUsers}`);
    if (skipExisting) {
      console.log(`⏭️  Skipped:        ${skippedCount}`);
    }
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
