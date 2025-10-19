import { WorkOS } from '@workos-inc/node';

// Load environment variables
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;
const WORKOS_API_KEY = process.env.WORKOS_API_KEY;

if (!WORKOS_CLIENT_ID || !WORKOS_API_KEY) {
  throw new Error(
    'WORKOS_CLIENT_ID and WORKOS_API_KEY must be set in environment variables. ' +
      'Copy .env.example to .env and fill in your WorkOS credentials.'
  );
}

let workosInstance: WorkOS | undefined;

/**
 * Get or create a WorkOS client instance
 */
const getWorkOS = (): WorkOS => {
  if (!workosInstance) {
    workosInstance = new WorkOS(WORKOS_API_KEY, {
      clientId: WORKOS_CLIENT_ID,
    });
  }
  return workosInstance;
};

/**
 * Check if a user exists in WorkOS by email
 * @param email - The email address to check
 * @returns true if user exists, false otherwise
 */
export const userExists = async (email: string): Promise<boolean> => {
  try {
    const workos = getWorkOS();
    const response = await workos.userManagement.listUsers({ email });
    return response.data.length > 0;
  } catch (error) {
    console.error(`Error checking if user exists: ${email}`, error);
    throw error;
  }
};

/**
 * Get user details from WorkOS by email
 * @param email - The email address to look up
 * @returns User object or null if not found
 */
export const getUser = async (email: string) => {
  try {
    const workos = getWorkOS();
    const response = await workos.userManagement.listUsers({ email });

    if (response.data.length === 0) {
      return null;
    }

    const user = response.data[0];
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      profilePictureUrl: user.profilePictureUrl,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  } catch (error) {
    console.error(`Error getting user: ${email}`, error);
    throw error;
  }
};

/**
 * Wait for a user to be created in WorkOS (useful after signup)
 * @param email - The email address to check
 * @param options - Configuration options
 * @returns true if user was created within timeout, false otherwise
 */
export const waitForUserCreation = async (
  email: string,
  options: {
    timeout?: number; // milliseconds
    interval?: number; // milliseconds
  } = {}
): Promise<boolean> => {
  const { timeout = 30000, interval = 1000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await userExists(email)) {
      console.log(`✓ User ${email} found in WorkOS`);
      return true;
    }

    // Wait before checking again
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  console.error(`✗ User ${email} not found in WorkOS after ${timeout}ms`);
  return false;
};

/**
 * Create a user in WorkOS
 * @param options - User creation options
 * @returns Created user object
 */
export const createUser = async (options: {
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
  password?: string;
}) => {
  try {
    const workos = getWorkOS();
    const user = await workos.userManagement.createUser({
      email: options.email,
      firstName: options.firstName,
      lastName: options.lastName,
      emailVerified: options.emailVerified ?? true, // Default to verified for E2E tests
      password: options.password,
    });

    console.log(`✓ User ${options.email} created in WorkOS`);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      profilePictureUrl: user.profilePictureUrl,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  } catch (error) {
    console.error(`Error creating user: ${options.email}`, error);
    throw error;
  }
};

/**
 * Update a user's email verification status
 * @param email - The email address of the user to update
 * @param emailVerified - Whether the email should be marked as verified
 * @returns Updated user object or null if user not found
 */
export const updateEmailVerification = async (email: string, emailVerified: boolean = true) => {
  try {
    const user = await getUser(email);

    if (!user) {
      console.log(`User ${email} not found, cannot update email verification`);
      return null;
    }

    const workos = getWorkOS();
    const updatedUser = await workos.userManagement.updateUser({
      userId: user.id,
      emailVerified,
    });

    console.log(`✓ User ${email} email verification set to ${emailVerified}`);
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      name: `${updatedUser.firstName ?? ''} ${updatedUser.lastName ?? ''}`.trim(),
      profilePictureUrl: updatedUser.profilePictureUrl,
      emailVerified: updatedUser.emailVerified,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  } catch (error) {
    console.error(`Error updating email verification for: ${email}`, error);
    throw error;
  }
};

/**
 * Ensure a user exists in WorkOS, creating them if necessary, and ensure email is verified
 * @param options - User options
 * @returns User object (either existing or newly created)
 */
export const ensureUserExists = async (options: {
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  ensureEmailVerified?: boolean;
}) => {
  try {
    let user = await getUser(options.email);

    if (!user) {
      console.log(`User ${options.email} does not exist, creating...`);
      user = await createUser({
        email: options.email,
        firstName: options.firstName ?? 'E2E',
        lastName: options.lastName ?? 'Test',
        emailVerified: true,
        password: options.password,
      });
    } else {
      // Ensure email is verified if requested
      if (options.ensureEmailVerified !== false && !user.emailVerified) {
        console.log(`Email not verified for ${options.email}, verifying...`);
        user = await updateEmailVerification(options.email, true);
      }
    }

    return user;
  } catch (error) {
    console.error(`Error ensuring user exists: ${options.email}`, error);
    throw error;
  }
};

/**
 * Delete a user from WorkOS by email (useful for test cleanup)
 * @param email - The email address of the user to delete
 * @returns true if user was deleted, false if user not found
 */
export const deleteUser = async (email: string): Promise<boolean> => {
  try {
    const user = await getUser(email);

    if (!user) {
      console.log(`User ${email} not found, nothing to delete`);
      return false;
    }

    const workos = getWorkOS();
    await workos.userManagement.deleteUser(user.id);
    console.log(`✓ User ${email} deleted from WorkOS`);
    return true;
  } catch (error) {
    console.error(`Error deleting user: ${email}`, error);
    throw error;
  }
};

/**
 * Verify a user exists before proceeding with login
 * Throws an error if user doesn't exist
 * @param email - The email address to verify
 */
export const verifyUserBeforeLogin = async (email: string): Promise<void> => {
  console.log(`Verifying user exists in WorkOS: ${email}`);

  const exists = await userExists(email);

  if (!exists) {
    throw new Error(
      `User ${email} does not exist in WorkOS. ` + 'Please ensure the user is created before attempting to log in.'
    );
  }

  console.log(`✓ User ${email} verified in WorkOS`);
};
