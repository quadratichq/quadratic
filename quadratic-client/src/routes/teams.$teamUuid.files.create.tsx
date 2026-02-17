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
  await requireAuth(loaderArgs.request);

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
  // /teams/:teamUuid/files/create?template=:publicFileUrlInProduction&{isPrivate?}
  const templateUrl = searchParams.get('template');
  searchParams.delete('template');
  if (templateUrl) {
    try {
      const { uuid, name } = await apiClient.templates.duplicate({
        publicFileUrlInProduction: templateUrl,
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
          publicFileUrlInProduction: templateUrl,
        },
      });
      return replace(getFailUrl(ROUTES.TEMPLATES));
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

    // Pass along a few of the search params
    let searchParamsToPass = new URLSearchParams();
    const state = searchParams.get('state');
    if (state) {
      searchParamsToPass.set('state', state);
    }
    const prompt = searchParams.get('prompt');
    if (prompt) {
      searchParamsToPass.set('prompt', prompt);
    }
    const chatId = searchParams.get('chat-id');
    if (chatId) {
      searchParamsToPass.set('chat-id', chatId);
    }
    const connectionUuid = searchParams.get('connection-uuid');
    if (connectionUuid) {
      searchParamsToPass.set('connection-uuid', connectionUuid);
    }
    const connectionType = searchParams.get('connection-type');
    if (connectionType) {
      searchParamsToPass.set('connection-type', connectionType);
    }
    const connectionName = searchParams.get('connection-name');
    if (connectionName) {
      searchParamsToPass.set('connection-name', connectionName);
    }
    return replace(ROUTES.FILE({ uuid, searchParams: searchParamsToPass.toString() }));
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
