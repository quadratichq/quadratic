import type { CreateUserOptions } from '@workos-inc/node';
import { WorkOS } from '@workos-inc/node';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();
const workosClientId = process.env.WORKOS_CLIENT_ID;

if (!workosClientId) {
  throw new Error('WORKOS_CLIENT_ID is not set in the .env file');
}

/**
 * Environment configuration for WorkOS
 */
interface WorkOSEnvironment {
  name: 'staging' | 'preview';
  apiKey: string;
}

/**
 * Get WorkOS environment configurations from .env file
 */
const getEnvironments = (): WorkOSEnvironment[] => {
  const stagingApiKey = process.env.WORKOS_STAGING_API_KEY;
  const previewApiKey = process.env.WORKOS_PREVIEW_API_KEY;

  const environments: WorkOSEnvironment[] = [];

  if (stagingApiKey && workosClientId) {
    environments.push({
      name: 'staging',
      apiKey: stagingApiKey,
    });
  } else {
    console.warn('⚠️  WorkOS staging credentials not found in .env file');
    console.warn('   Required: WORKOS_STAGING_API_KEY, WORKOS_CLIENT_ID');
  }

  if (previewApiKey && workosClientId) {
    environments.push({
      name: 'preview',
      apiKey: previewApiKey,
    });
  } else {
    console.warn('⚠️  WorkOS preview credentials not found in .env file');
    console.warn('   Required: WORKOS_PREVIEW_API_KEY, WORKOS_CLIENT_ID');
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
    clientId: workosClientId,
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
const ensureUserInEnvironment = async (env: WorkOSEnvironment, options: EnsureUserOptions): Promise<void> => {
  const workos = createWorkOSClient(env);

  try {
    // Check if user already exists
    const existingUsers = await workos.userManagement.listUsers({ email: options.email });

    if (existingUsers.data && existingUsers.data.length > 0) {
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

    await workos.userManagement.createUser(userData);
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
export const ensureUserExists = async (options: EnsureUserOptions): Promise<void> => {
  // we do not yet have .env files for CI, so we skip this for now
  if (process.env.CI) return;

  const environments = getEnvironments();

  // Process each environment sequentially to avoid rate limiting
  for (const env of environments) {
    try {
      await ensureUserInEnvironment(env, options);
    } catch (error) {
      // Log error but continue with other environments
      console.error(`Failed to process ${env.name}:`, error);
    }
  }
};
