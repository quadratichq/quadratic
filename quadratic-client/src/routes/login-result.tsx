import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { getRedirectTo } from '@/shared/utils/getRedirectToOrLoginResult';
import { isMobile } from 'react-device-detect';
import { redirect } from 'react-router';

const SHOW_ONBOARDING_QUESTIONNAIRE = Math.random() < 0.5;
const SHOW_ONBOARDING_VIDEO = Math.random() < 0.5;

export const loader = async ({ request }: { request: Request }) => {
  // try/catch here handles case where this _could_ error out and we
  // have no errorElement so we just redirect back to home
  try {
    await authClient.handleSigninRedirect(request.url);
    let isAuthenticated = await authClient.isAuthenticated();
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

      const redirectTo = getRedirectTo() || '/';
      // For new users coming directly to `/` on desktop, handle them specially
      // Otherwise, respect the route they were trying to access (e.g. `/files/create?prompt=...`)
      if (userCreated && !isMobile && redirectTo === '/') {
        return redirect(
          SHOW_ONBOARDING_QUESTIONNAIRE
            ? ROUTES.ONBOARDING_QUESTIONNAIRE
            : SHOW_ONBOARDING_VIDEO
              ? ROUTES.ONBOARDING_VIDEO
              : '/files/create'
        );
      }
      return redirect(redirectTo);
    }
  } catch (e) {
    console.error(e);
  }
  return redirect('/');
};
