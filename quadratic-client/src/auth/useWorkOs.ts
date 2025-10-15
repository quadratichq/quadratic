import type { User } from '@/auth/auth';
import { useAuth } from '@workos-inc/authkit-react';
import { useEffect } from 'react';

export const isWorkOs = import.meta.env.VITE_AUTH_TYPE === 'workos';

interface UseWorkOsReturn {
  getUser: (() => User | null) | undefined;
  getAccessToken: ((options?: { forceRefresh?: boolean }) => Promise<string>) | undefined;
  signIn: (() => Promise<void>) | undefined;
  signOut: (() => Promise<void>) | undefined;
}

// Hook implementation when WorkOS is enabled
const useWorkOsEnabled = (): UseWorkOsReturn => {
  const { getUser, getAccessToken, signIn, signOut } = useAuth();

  useEffect(() => {
    workOs.getAccessToken = getAccessToken;
    workOs.getUser = getUser;
    workOs.signIn = signIn;
    workOs.signOut = signOut;
  }, [getAccessToken, getUser, signIn, signOut]);

  return { getUser, getAccessToken, signIn, signOut };
};

// Hook implementation when WorkOS is disabled
const useWorkOsDisabled = (): UseWorkOsReturn => {
  return { getUser: undefined, getAccessToken: undefined, signIn: undefined, signOut: undefined };
};

// Export the appropriate implementation based on build-time configuration
export const useWorkOs = isWorkOs ? useWorkOsEnabled : useWorkOsDisabled;

class WorkOs {
  getUser: (() => User | null) | undefined;
  getAccessToken: ((options?: { forceRefresh?: boolean }) => Promise<string>) | undefined;
  signIn: (() => Promise<void>) | undefined;
  signOut: (() => Promise<void>) | undefined;
}

export const workOs = new WorkOs();
