import { authClient } from '@/auth';
import { LoaderFunctionArgs, redirect } from 'react-router-dom';

// Note: for user-initiatied logouts, don’t do `<a href="/logout">` in code.
// Instead, do `<form action="/logout" method="POST">...</form>` as browsers
// may optimistically prefetch routes they think you'll visit
// (e.g. hover `<a href="/logout">` and you get logged out).
//
// But we'll still allow manually visiting `/logout` if you want to do that.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authClient.logout();
  return redirect('/');
};

// If the user clicks log out, we do that via a "resource route" we can hit from a fetcher.Form
export const action = async () => {
  await authClient.logout();
  return redirect('/');
};
