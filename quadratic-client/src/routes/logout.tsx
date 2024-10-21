import { authClient } from '@/auth';
import { LoaderFunctionArgs, redirect } from 'react-router-dom';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // We don't allow logout via a normal GET, as browsers can optimistically
  // do gets on requests like that and accidentally log people out.
  // But we'll allow you to manually logout via a `?force=true` search param
  const url = new URL(request.url);
  const force = url.searchParams.get('force');
  if (force !== null) {
    await authClient.logout();
    return redirect('/');
  }

  // Otherwise, just redirect home
  return redirect('/');
};

// We log out in a "resource route" that we can hit from a fetcher.Form
export const action = async () => {
  await authClient.logout();
  return redirect('/');
};
