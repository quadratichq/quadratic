import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { isMobile } from 'react-device-detect';
import { redirect } from 'react-router';

export const loader = async () => {
  // Show onboarding for ~25% of new users
  const SHOW_ONBOARDING = Math.random() < 0.25;

  // try/catch here handles case where this _could_ error out and we
  // have no errorElement so we just redirect back to home
  try {
    await authClient.handleSigninRedirect();
    let isAuthenticated = await authClient.isAuthenticated();
    if (isAuthenticated) {
      // Acknowledge the user has just logged in. The backend may need
      // to run some logic before making any other API calls in parallel
      const { userCreated } = await apiClient.user.acknowledge();

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
      // For new users coming directly to `/` on desktop, handle them specially
      // Otherwise, respect the route they were trying to access (e.g. `/files/create?prompt=...`)
      if (userCreated && !isMobile && redirectTo === '/') {
        return SHOW_ONBOARDING ? redirect('/onboarding') : redirect('/files/create?private=false');
      }
      return redirect(redirectTo);
    }
  } catch (e) {
    console.error(e);
  }
  return redirect('/');
};
