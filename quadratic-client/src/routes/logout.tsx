import { authClient } from '@/auth/auth';
import { VITE_AUTH_TYPE } from '@/env-vars';
import { resetEventAnalytics } from '@/shared/utils/analyticsEvents';
import { redirectDocument } from 'react-router';

// If you visit `/logout` directly in your browser, we'll log you out.
// But user log outs from the app should be done via a POST request to `/logout`.
export const loader = logout;

// We log out in a "resource route" that we can hit from a fetcher.Form
export const action = logout;

async function logout() {
  if (VITE_AUTH_TYPE === 'workos') {
    await authClient.logout();
    // return redirectDocument('/login');
  } else {
    localStorage.clear();
    resetEventAnalytics();
    await authClient.logout();
    return redirectDocument('/');
  }
}
