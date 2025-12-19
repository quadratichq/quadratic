#!/usr/bin/env node

/**
 * Script to create a validated user in QA and Staging WorkOS environments.
 *
 * Prerequisites:
 *   1. Set up environment variables (in .env file or shell):
 *      - WORKOS_QA_API_KEY: WorkOS API key for QA environment
 *      - WORKOS_QA_CLIENT_ID: WorkOS Client ID for QA environment
 *      - WORKOS_STAGING_API_KEY: WorkOS API key for Staging environment
 *      - WORKOS_STAGING_CLIENT_ID: WorkOS Client ID for Staging environment
 *
 *   2. Install dependencies:
 *      npm install @workos-inc/node dotenv
 *
 * Usage:
 *   node scripts/createUser.js --email <email> [--password <password>] [--firstName <name>] [--lastName <name>] [--env <qa|staging|all>]
 *
 * Examples:
 *   # Create user in both QA and Staging (default)
 *   node scripts/createUser.js --email test@example.com --password SecurePass123
 *
 *   # Create user in QA only
 *   node scripts/createUser.js --email test@example.com --password SecurePass123 --env qa
 *
 *   # Create user in Staging only
 *   node scripts/createUser.js --email test@example.com --env staging
 *
 *   # Create user with custom name
 *   node scripts/createUser.js --email test@example.com --firstName John --lastName Doe
 */

import { WorkOS } from '@workos-inc/node';
import * as dotenv from 'dotenv';
import { parseArgs } from 'node:util';

// Load environment variables from .env file
dotenv.config();

/**
 * Environment configuration for WorkOS
 * @typedef {Object} WorkOSEnvironment
 * @property {'qa' | 'staging'} name - Environment name
 * @property {string} apiKey - WorkOS API key
 * @property {string} clientId - WorkOS Client ID
 */

/**
 * Options for creating a user
 * @typedef {Object} CreateUserOptions
 * @property {string} email - User email address
 * @property {string} [password] - User password (defaults to 'E2E_test')
 * @property {string} [firstName] - User first name (defaults to 'E2E')
 * @property {string} [lastName] - User last name (defaults to 'Test')
 */

/**
 * Get WorkOS environment configurations from environment variables
 * @param {'qa' | 'staging' | 'all'} targetEnv - Target environment(s)
 * @returns {WorkOSEnvironment[]}
 */
const getEnvironments = (targetEnv = 'all') => {
  const qaApiKey = process.env.WORKOS_QA_API_KEY;
  const qaClientId = process.env.WORKOS_QA_CLIENT_ID;
  const stagingApiKey = process.env.WORKOS_STAGING_API_KEY;
  const stagingClientId = process.env.WORKOS_STAGING_CLIENT_ID;

  /** @type {WorkOSEnvironment[]} */
  const environments = [];

  if ((targetEnv === 'qa' || targetEnv === 'all') && qaApiKey && qaClientId) {
    environments.push({
      name: 'qa',
      apiKey: qaApiKey,
      clientId: qaClientId,
    });
  } else if (targetEnv === 'qa' || targetEnv === 'all') {
    console.warn('⚠️  WorkOS QA credentials not found in environment');
    console.warn('   Required: WORKOS_QA_API_KEY, WORKOS_QA_CLIENT_ID');
  }

  if ((targetEnv === 'staging' || targetEnv === 'all') && stagingApiKey && stagingClientId) {
    environments.push({
      name: 'staging',
      apiKey: stagingApiKey,
      clientId: stagingClientId,
    });
  } else if (targetEnv === 'staging' || targetEnv === 'all') {
    console.warn('⚠️  WorkOS Staging credentials not found in environment');
    console.warn('   Required: WORKOS_STAGING_API_KEY, WORKOS_STAGING_CLIENT_ID');
  }

  if (environments.length === 0) {
    throw new Error('No WorkOS environments configured. Please set credentials in environment variables or .env file.');
  }

  return environments;
};

/**
 * Creates a WorkOS client for the given environment
 * @param {WorkOSEnvironment} env
 * @returns {WorkOS}
 */
const createWorkOSClient = (env) => {
  return new WorkOS(env.apiKey, {
    clientId: env.clientId,
  });
};

/**
 * Creates or ensures a validated user exists in a specific WorkOS environment.
 * If the user already exists, updates their email verification status.
 *
 * @param {WorkOSEnvironment} env - The WorkOS environment configuration
 * @param {CreateUserOptions} options - User data
 * @returns {Promise<{created: boolean, userId: string}>}
 */
const createUserInEnvironment = async (env, options) => {
  const workos = createWorkOSClient(env);

  try {
    // Check if user already exists
    const existingUsers = await workos.userManagement.listUsers({ email: options.email });

    if (existingUsers.data && existingUsers.data.length > 0) {
      const existingUser = existingUsers.data[0];
      console.log(`ℹ️  User already exists in ${env.name}: ${options.email} (ID: ${existingUser.id})`);

      // Ensure emailVerified is true
      if (!existingUser.emailVerified) {
        await workos.userManagement.updateUser({
          userId: existingUser.id,
          emailVerified: true,
        });
        console.log(`✓ Email verified status updated in ${env.name}`);
      } else {
        console.log(`✓ User is already verified in ${env.name}`);
      }

      return { created: false, userId: existingUser.id };
    }

    // User doesn't exist, create them
    console.log(`📝 Creating user in ${env.name}: ${options.email}`);

    const newUser = await workos.userManagement.createUser({
      email: options.email,
      password: options.password || 'E2E_test',
      firstName: options.firstName || 'E2E',
      lastName: options.lastName || 'Test',
      emailVerified: true,
    });

    console.log(`✓ User created and verified in ${env.name}: ${options.email} (ID: ${newUser.id})`);
    return { created: true, userId: newUser.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error in ${env.name}:`, errorMessage);
    throw new Error(`Failed to create user in ${env.name}: ${errorMessage}`);
  }
};

/**
 * Creates a validated user in QA and/or Staging WorkOS environments.
 *
 * @param {CreateUserOptions} options - User data
 * @param {'qa' | 'staging' | 'all'} [targetEnv='all'] - Target environment(s)
 * @returns {Promise<Array<{environment: string, created: boolean, userId: string}>>}
 */
export const createUser = async (options, targetEnv = 'all') => {
  const environments = getEnvironments(targetEnv);
  const results = [];

  console.log(`\n🚀 Creating user: ${options.email}`);
  console.log(`   Target environment(s): ${targetEnv === 'all' ? 'QA, Staging' : targetEnv.toUpperCase()}\n`);

  for (const env of environments) {
    try {
      const result = await createUserInEnvironment(env, options);
      results.push({
        environment: env.name,
        ...result,
      });
    } catch (error) {
      console.error(`Failed to process ${env.name}:`, error.message);
      results.push({
        environment: env.name,
        created: false,
        userId: null,
        error: error.message,
      });
    }

    // Add a small delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
};

/**
 * Parse command line arguments
 */
const parseCliArgs = () => {
  try {
    const { values } = parseArgs({
      options: {
        email: { type: 'string', short: 'e' },
        password: { type: 'string', short: 'p' },
        firstName: { type: 'string', short: 'f' },
        lastName: { type: 'string', short: 'l' },
        env: { type: 'string', default: 'all' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
      allowPositionals: false,
    });

    return values;
  } catch (error) {
    if (error.code === 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL') {
      console.error('❌ Error: Unexpected positional argument.');
      console.error('\n💡 Tip: When using npm run, add "--" before arguments:');
      console.error('   npm run create-user -- --email test@example.com\n');
      process.exit(1);
    }
    throw error;
  }
};

/**
 * Print usage information
 */
const printUsage = () => {
  console.log(`
Usage: npm run create-user -- [options]
   or: node scripts/createUser.js [options]

Options:
  -e, --email <email>       User email address (required)
  -p, --password <password> User password (default: E2E_test)
  -f, --firstName <name>    User first name (default: E2E)
  -l, --lastName <name>     User last name (default: Test)
  --env <environment>       Target environment: qa, staging, or all (default: all)
  -h, --help                Show this help message

Environment Variables (required):
  WORKOS_QA_API_KEY         WorkOS API key for QA environment
  WORKOS_QA_CLIENT_ID       WorkOS Client ID for QA environment
  WORKOS_STAGING_API_KEY    WorkOS API key for Staging environment
  WORKOS_STAGING_CLIENT_ID  WorkOS Client ID for Staging environment

Examples:
  # Create user in both QA and Staging (note the -- before arguments)
  npm run create-user -- --email test@example.com --password SecurePass123

  # Create user in QA only
  npm run create-user -- --email test@example.com --env qa

  # Create user with custom name
  npm run create-user -- --email test@example.com --firstName John --lastName Doe
`);
};

/**
 * Main function - runs when script is executed directly
 */
const main = async () => {
  const args = parseCliArgs();

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.email) {
    console.error('❌ Error: --email is required\n');
    printUsage();
    process.exit(1);
  }

  const validEnvs = ['qa', 'staging', 'all'];
  if (args.env && !validEnvs.includes(args.env)) {
    console.error(`❌ Error: --env must be one of: ${validEnvs.join(', ')}\n`);
    printUsage();
    process.exit(1);
  }

  try {
    const results = await createUser(
      {
        email: args.email,
        password: args.password,
        firstName: args.firstName,
        lastName: args.lastName,
      },
      args.env || 'all'
    );

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log('='.repeat(50));

    let hasErrors = false;
    for (const result of results) {
      const status = result.error ? '❌' : result.created ? '✓ Created' : '✓ Exists';
      console.log(`${result.environment.toUpperCase()}: ${status}${result.userId ? ` (${result.userId})` : ''}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
        hasErrors = true;
      }
    }
    console.log('='.repeat(50));

    if (hasErrors) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
};

// Run main function when executed directly
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
