import { requireAuth } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { redirect, type LoaderFunctionArgs } from 'react-router';

/**
 * Checks the user's status, then sends them to the dashboard with the education dialog
 */
export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  await requireAuth();
  await apiClient.education.refresh();
  return redirect(`/?${SEARCH_PARAMS.DIALOG.KEY}=${SEARCH_PARAMS.DIALOG.VALUES.EDUCATION}`);
};

export const Component = () => {
  return null;
};
