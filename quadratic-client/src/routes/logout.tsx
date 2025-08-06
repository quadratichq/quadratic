import { authClient } from '@/auth/auth';
import { resetEventAnalytics } from '@/shared/utils/analyticsEvents';
import { redirect } from 'react-router';

// If you visit `/logout` directly in your browser, we'll log you out.
// But user log outs from the app should be done via a POST request to `/logout`.
export const loader = logout;

// We log out in a "resource route" that we can hit from a fetcher.Form
export const action = logout;

async function logout() {
  localStorage.clear();
  await authClient.logout();
  resetEventAnalytics();
  return redirect('/');
}
