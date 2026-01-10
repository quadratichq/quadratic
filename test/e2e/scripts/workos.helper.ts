import type { CreateUserOptions } from '@workos-inc/node';
import { WorkOS } from '@workos-inc/node';
import * as dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from test/e2e/.env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Environment configuration for WorkOS
 */
interface WorkOSEnvironment {
  name: 'staging' | 'preview';
  apiKey: string;
  clientId: string;
}

/**
 * Get WorkOS environment configurations from .env file
 */
const getEnvironments = (): WorkOSEnvironment[] => {
  const stagingApiKey = process.env.WORKOS_STAGING_API_KEY;
  const stagingClientId = process.env.WORKOS_STAGING_CLIENT_ID;
  const previewApiKey = process.env.WORKOS_PREVIEW_API_KEY;
  const previewClientId = process.env.WORKOS_PREVIEW_CLIENT_ID;

  const environments: WorkOSEnvironment[] = [];

  if (stagingApiKey && stagingClientId) {
    environments.push({
      name: 'staging',
      apiKey: stagingApiKey,
      clientId: stagingClientId,
    });
  }

  if (previewApiKey && previewClientId) {
    environments.push({
      name: 'preview',
      apiKey: previewApiKey,
      clientId: previewClientId,
    });
  }

  if (environments.length === 0) {
    throw new Error('No WorkOS environments configured. Please set credentials in .env file.');
  }

  return environments;
};

/**
 * Options for ensuring a user exists
 */
interface EnsureUserOptions {
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}

/**
 * Creates a WorkOS client for the given environment
 */
const createWorkOSClient = (env: WorkOSEnvironment): WorkOS => {
  return new WorkOS(env.apiKey, {
    clientId: env.clientId,
  });
};

/**
 * Ensures a user exists in a specific WorkOS environment.
 * If the user doesn't exist, creates them. If they exist, returns their information.
 *
 * @param env - The WorkOS environment configuration
 * @param options - User data including email, firstName, lastName, and optional password
 * @returns Promise with user information including whether they were created
 */
const ensureUserInEnvironment = async (
  env: WorkOSEnvironment,
  options: EnsureUserOptions,
  verbose = false
): Promise<void> => {
  const workos = createWorkOSClient(env);

  try {
    // Check if user already exists
    const existingUsers = await workos.userManagement.listUsers({ email: options.email });

    if (verbose) {
      console.log(`  [${env.name}] Found ${existingUsers.data?.length ?? 0} existing user(s)`);
    }

    if (existingUsers.data && existingUsers.data.length > 0) {
      const existingUser = existingUsers.data[0];

      if (verbose) {
        console.log(`  [${env.name}] User ID: ${existingUser.id}`);
        console.log(`  [${env.name}] Email verified: ${existingUser.emailVerified}`);
      }

      // Always update user to ensure password and emailVerified are correct
      const updateData: { userId: string; emailVerified?: boolean; password?: string } = {
        userId: existingUser.id,
      };

      if (!existingUser.emailVerified) {
        updateData.emailVerified = true;
      }

      // Always reset the password to ensure it matches the expected value
      if (options.password) {
        updateData.password = options.password;
      }

      // Only call update if there's something to update
      if (updateData.emailVerified !== undefined || updateData.password) {
        const updatedUser = await workos.userManagement.updateUser(updateData);
        if (verbose) {
          console.log(
            `  [${env.name}] Update response - ID: ${updatedUser.id}, emailVerified: ${updatedUser.emailVerified}`
          );
        }
        console.log(`✓ User updated in ${env.name}: ${options.email}`);
      } else {
        console.log(`✓ User already up-to-date in ${env.name}: ${options.email}`);
      }

      return;
    }

    // User doesn't exist, create them
    console.log(`Creating user in ${env.name}: ${options.email}`);

    const userData: CreateUserOptions = {
      email: options.email,
      password: options.password,
      firstName: options.firstName,
      lastName: options.lastName,
      emailVerified: true,
    };

    if (verbose) {
      console.log(`  [${env.name}] Creating with data:`, { ...userData, password: '***' });
    }

    const createdUser = await workos.userManagement.createUser(userData);
    if (verbose) {
      console.log(`  [${env.name}] Created user ID: ${createdUser.id}, emailVerified: ${createdUser.emailVerified}`);
    }
    console.log(`✓ User created in ${env.name}: ${options.email}`);
  } catch (error) {
    console.error(`❌ Error ensuring user exists in ${env.name}:`, error);
    throw new Error(
      `Failed to ensure user exists in ${env.name} environment: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Ensures a user exists in both staging and preview WorkOS environments.
 * If the user doesn't exist in an environment, creates them.
 * If they exist, returns their existing information.
 *
 * @param options - User data including email, firstName, lastName, and optional password
 * @returns Promise with array of results for each environment
 *
 * @example
 * ```typescript
 * const results = await ensureUserExists({
 *   email: 'test@example.com',
 *   firstName: 'Test',
 *   lastName: 'User',
 *   password: 'SecurePassword123',
 * });
 *
 * results.forEach(result => {
 *   console.log(`${result.environment}: ${result.created ? 'Created' : 'Exists'} - ${result.userId}`);
 * });
 * ```
 */
export const ensureUserExists = async (options: EnsureUserOptions, verbose = false): Promise<void> => {
  // we do not yet have .env files for CI, so we skip this for now
  if (process.env.CI) return;

  const environments = getEnvironments();

  // Process each environment sequentially to avoid rate limiting
  for (const env of environments) {
    try {
      await ensureUserInEnvironment(env, options, verbose);
    } catch (error) {
      // Log error but continue with other environments
      console.error(`Failed to process ${env.name}:`, error);
    }
  }
};

/**
 * Get list of configured environment names
 */
export const getConfiguredEnvironments = (): string[] => {
  const environments: string[] = [];

  if (process.env.WORKOS_STAGING_API_KEY && process.env.WORKOS_STAGING_CLIENT_ID) {
    environments.push('staging');
  }

  if (process.env.WORKOS_PREVIEW_API_KEY && process.env.WORKOS_PREVIEW_CLIENT_ID) {
    environments.push('preview');
  }

  return environments;
};

/**
 * Fetches all users from a single WorkOS environment.
 */
const fetchUsersFromEnvironment = async (
  env: WorkOSEnvironment
): Promise<{ env: WorkOSEnvironment; emails: Set<string> } | null> => {
  try {
    const workos = createWorkOSClient(env);
    const envEmails = new Set<string>();

    // Paginate through all users
    let after: string | undefined;
    let pageCount = 0;

    do {
      const response = await workos.userManagement.listUsers({
        limit: 100,
        after,
      });

      for (const user of response.data) {
        envEmails.add(user.email);
      }

      pageCount++;
      process.stdout.write(`\r   [${env.name}] Fetched page ${pageCount} (${envEmails.size} users so far)`);
      after = response.listMetadata?.after ?? undefined;
    } while (after);

    // Clear line and print final count
    process.stdout.write('\r' + ' '.repeat(60) + '\r');

    return { env, emails: envEmails };
  } catch (error) {
    console.error(`   ✗ Failed to fetch users from ${env.name}:`, error);
    return null;
  }
};

/**
 * Fetches all existing user emails from all configured WorkOS environments.
 * Fetches from all environments in parallel for better performance.
 *
 * @returns Promise with Set of email addresses that exist in all environments
 */
export const getExistingUserEmails = async (): Promise<Set<string>> => {
  // we do not yet have .env files for CI, so we skip this for now
  if (process.env.CI) return new Set();

  const environments = getEnvironments();

  console.log(`   Fetching users from ${environments.map((e) => e.name).join(' and ')} in parallel...`);

  // Fetch from all environments in parallel
  const results = await Promise.all(environments.map((env) => fetchUsersFromEnvironment(env)));

  // Check for failures
  const successfulResults = results.filter((r): r is { env: WorkOSEnvironment; emails: Set<string> } => r !== null);

  if (successfulResults.length === 0) {
    console.error('   ✗ Failed to fetch users from any environment');
    return new Set();
  }

  // Log results
  for (const result of successfulResults) {
    console.log(`   ✓ Found ${result.emails.size} users in ${result.env.name}`);
  }

  // If we couldn't fetch from all environments, just use what we have
  if (successfulResults.length < environments.length) {
    console.warn('   ⚠️  Could not fetch from all environments, using partial data');
  }

  // Return intersection of all environments (users that exist in ALL fetched environments)
  if (successfulResults.length === 1) return successfulResults[0].emails;

  // Find emails that exist in all environments
  const intersection = new Set<string>();
  for (const email of successfulResults[0].emails) {
    if (successfulResults.every((r) => r.emails.has(email))) {
      intersection.add(email);
    }
  }

  return intersection;
};
