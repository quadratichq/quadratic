import { authClient } from '@/auth/auth';
import { getAndClearRedirectState } from '@/auth/workos';
import { apiClient } from '@/shared/api/apiClient';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { getRedirectTo } from '@/shared/utils/getRedirectToOrLoginResult';
import { redirect } from 'react-router';

const AUTH_TYPE = import.meta.env.VITE_AUTH_TYPE;

export const loader = async ({ request }: { request: Request }) => {
  // try/catch here handles case where this _could_ error out and we
  // have no errorElement so we just redirect back to home
  try {
    // Check if already authenticated first - if so, ignore any auth codes in the URL
    let isAuthenticated = await authClient.isAuthenticated();

    // Only process the redirect if not already authenticated
    if (!isAuthenticated) {
      await authClient.handleSigninRedirect(request.url);
      isAuthenticated = await authClient.isAuthenticated();
    }
    if (isAuthenticated) {
      // Acknowledge the user has just logged in. The backend may need
      // to run some logic before making any other API calls in parallel
      const { userCreated } = await apiClient.user.acknowledge();

      // Special case for first-time users
      if (userCreated) {
        await trackEvent('[Auth].signup');
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

      // Get redirect destination from WorkOS state (if available) or URL params
      let redirectTo = getRedirectTo() || '/';

      // For WorkOS, check if there's a redirect state from the OAuth callback
      if (AUTH_TYPE === 'workos') {
        const workosState = getAndClearRedirectState();
        if (workosState?.redirectTo) {
          redirectTo = workosState.redirectTo;
        }
      }

      return redirect(redirectTo);
    }
  } catch (e) {
    // Error handled by redirecting to home
  }
  return redirect('/');
};
