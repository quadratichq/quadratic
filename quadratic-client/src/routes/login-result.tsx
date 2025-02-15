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
          // Read UTM cookie if it exists
          const utmCookie = document.cookie.split('; ').find((row) => row.startsWith('quadratic_utm='));

          let utmData = {};
          if (utmCookie) {
            try {
              utmData = JSON.parse(decodeURIComponent(utmCookie.split('=')[1]));
            } catch (e) {
              console.error('Failed to parse UTM cookie:', e);
            }
          }

          // remove null values
          utmData = Object.fromEntries(Object.entries(utmData).filter(([_, value]) => value !== null));

          // @ts-expect-error
          window.dataLayer.push({
            event: 'registrationComplete',
            ...utmData,
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
