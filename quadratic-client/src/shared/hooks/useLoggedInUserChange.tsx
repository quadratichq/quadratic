import type { User } from '@/auth/auth';
import { useEffect } from 'react';

export const useLoggedInUserChange = ({ loggedInUser }: { loggedInUser: User | undefined }) => {
  useEffect(() => {
    const checkLoggedInUserEmail = () => {
      const loggedInUserEmail = window.localStorage.getItem('loggedInUserEmail');
      if ((loggedInUserEmail ?? '') !== (loggedInUser?.email ?? '')) {
        window.location.reload();
      }
    };

    window.addEventListener('storage', checkLoggedInUserEmail);
    return () => {
      window.removeEventListener('storage', checkLoggedInUserEmail);
    };
  }, [loggedInUser]);
};
