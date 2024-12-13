import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { redirect } from 'react-router-dom';

export const loader = async () => {
  // try/catch here handles case where this _could_ error out and we
  // have no errorElement so we just redirect back to home
  try {
    await authClient.handleSigninRedirect();
    let isAuthenticated = await authClient.isAuthenticated();
    if (isAuthenticated) {
      // Acknowledge the user has just logged in. The backend may need
      // to run some logic before making any other API calls in parallel
      const { userCreated } = await apiClient.users.acknowledge();

      // Special case for first-time users
      if (userCreated) {
        try {
          // @ts-expect-error
          window.dataLayer.push({
            event: 'registrationComplete',
          });
        } catch (e) {
          // No google analytics available
        }
      }

      let redirectTo = new URLSearchParams(window.location.search).get('redirectTo') || '/';
      return redirect(redirectTo);
    }
  } catch (e) {
    console.error(e);
  }
  return redirect('/');
};
