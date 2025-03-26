import { authClient } from '@/auth/auth';
import { redirect } from 'react-router';

// If you visit `/logout` directly in your browser, we'll log you out.
// But user log outs from the app should be done via a POST request to `/logout`.
export const clientLoader = async () => {
  await authClient.logout();
  return redirect('/');
};

// We log out in a "resource route" that we can hit from a fetcher.Form
export const clientAction = async () => {
  await authClient.logout();
  return redirect('/');
};
