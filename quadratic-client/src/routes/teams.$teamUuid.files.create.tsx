import { authClient, requireAuth } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { snackbarMsgQueryParam, snackbarSeverityQueryParam } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { initMixpanelAnalytics } from '@/shared/utils/analytics';
import { captureEvent } from '@sentry/react';
import mixpanel from 'mixpanel-browser';
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

  // We initialize mixpanel here (again, as we do it in the root loader) because
  // it helps us prevent the app from failing because all the loaders run in parallel
  // and we can't guarantee this loader finishes before the root one
  // Once this proposal ships, we should use it: https://github.com/remix-run/react-router/discussions/9564
  let user = await authClient.user();
  initMixpanelAnalytics(user);

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
      mixpanel.track('[Files].newExampleFile', { fileName: name });
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
  mixpanel.track('[Files].newFile', { isPrivate });
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

  mixpanel.track('[Files].loadFileFromDisk', { fileName: name });
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
