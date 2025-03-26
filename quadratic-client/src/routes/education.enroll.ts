import { apiClient } from '@/shared/api/apiClient';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { redirect } from 'react-router';

export const clientLoader = async () => {
  // Check their status, then send them to the dashboard with the education dialog
  await apiClient.education.refresh();
  return redirect(`/?${SEARCH_PARAMS.DIALOG.KEY}=${SEARCH_PARAMS.DIALOG.VALUES.EDUCATION}`);
};
