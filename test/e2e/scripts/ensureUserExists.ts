#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ensureUserExists } from './workos.helper.js';

interface User {
  email: string;
  password: string;
}

interface UsersFile {
  users: User[];
}

/**
 * Main function to ensure all E2E test users exist in WorkOS
 */
async function main() {
  console.log('🚀 Starting user creation/verification process...\n');

  try {
    // Read test/scripts/users.json file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const usersFilePath = join(__dirname, 'test-users.json');

    const fileContent = await readFile(usersFilePath, 'utf-8');
    const usersData: UsersFile = JSON.parse(fileContent);

    const totalUsers = usersData.users.length;
    console.log(`📋 Found ${totalUsers} users to process\n`);

    // Check if running in CI
    if (process.env.CI) {
      console.log('ℹ️  Running in CI environment, skipping user creation');
      return;
    }

    // Process users with progress tracking
    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (let i = 0; i < usersData.users.length; i++) {
      const user = usersData.users[i];
      const progress = `[${i + 1}/${totalUsers}]`;

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
      if (i < usersData.users.length - 1) {
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
