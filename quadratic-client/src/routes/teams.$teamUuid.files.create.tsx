import { requireAuth } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { snackbarMsgQueryParam, snackbarSeverityQueryParam } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { captureEvent } from '@sentry/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { replace } from 'react-router';

const getFailUrl = (path: string = '/') => {
  let params = new URLSearchParams();
  params.append(snackbarMsgQueryParam, 'Failed to create file. Try again.');
  params.append(snackbarSeverityQueryParam, 'error');
  return path + '?' + params.toString();
};

export const shouldRevalidate = () => false;

export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  await requireAuth();

  const { request, params } = loaderArgs;

  // Get the team we're creating the file in
  const teamUuid = params.teamUuid;
  if (!teamUuid) {
    return replace(getFailUrl());
  }

  // Determine what kind of file creation we're doing:
  const { searchParams } = new URL(request.url);
  const isPrivate = searchParams.get('private') !== null;
  searchParams.delete('private');

  // 1.
  // Clone an example file by passing the file id, e.g.
  // /teams/:teamUuid/files/create?example=:publicFileUrlInProduction&{isPrivate?}
  const exampleUrl = searchParams.get('example');
  searchParams.delete('example');
  if (exampleUrl) {
    try {
      const { uuid, name } = await apiClient.examples.duplicate({
        publicFileUrlInProduction: exampleUrl,
        teamUuid,
        isPrivate,
      });
      trackEvent('[Files].newExampleFile', { fileName: name });
      return replace(ROUTES.FILE({ uuid, searchParams: searchParams.toString() }));
    } catch (error) {
      captureEvent({
        message: 'Client failed to load the selected example file.',
        level: 'warning',
        extra: {
          publicFileUrlInProduction: exampleUrl,
        },
      });
      return replace(getFailUrl(ROUTES.EXAMPLES));
    }
  }

  // 2.
  // If there's no query params for the kind of file to create, just create a
  // new, blank file. If it's private, that's passed as a query param
  // /teams/:teamUuid/files/create?private
  trackEvent('[Files].newFile', { isPrivate });
  try {
    const {
      file: { uuid },
    } = await apiClient.files.create({ teamUuid, isPrivate });
    if (state) {
    return replace(ROUTES.FILE({ uuid, searchParams: searchParams.toString() }));
  } catch (error) {
    return replace(getFailUrl(ROUTES.TEAM(teamUuid)));
  }
};

export type CreateActionRequest = {
  name: string;
  contents: string;
  version: string;
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { searchParams } = new URL(request.url);
  const isPrivate = searchParams.get('private') !== null;
  searchParams.delete('example');

  const { teamUuid } = params;
  if (!teamUuid) {
    return replace(getFailUrl());
  }

  const { name, contents, version }: CreateActionRequest = await request.json();

  trackEvent('[Files].loadFileFromDisk', { fileName: name });
  try {
    const {
      file: { uuid },
    } = await apiClient.files.create({ file: { name, contents, version }, teamUuid, isPrivate });
    return replace(ROUTES.FILE({ uuid, searchParams: searchParams.toString() }));
  } catch (error) {
    return replace(getFailUrl());
  }
};

export const Component = () => {
  return null;
};
