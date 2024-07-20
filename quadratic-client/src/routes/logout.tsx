import { authClient } from '@/auth';
import { redirect } from 'react-router-dom';

export const loader = async () => {
  return redirect('/');
};

// We log out in a "resource route" that we can hit from a fetcher.Form
export const action = async () => {
  await authClient.logout();
  return redirect('/');
};
