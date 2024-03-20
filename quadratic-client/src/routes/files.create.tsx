import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect, redirectDocument } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { authClient } from '../auth';
import { snackbarMsgQueryParam, snackbarSeverityQueryParam } from '../components/GlobalSnackbarProvider';
import { ROUTES } from '../constants/routes';
import { initMixpanelAnalytics } from '../utils/analytics';

const getFailUrl = (path: string = ROUTES.FILES) => {
  let params = new URLSearchParams();
  params.append(snackbarMsgQueryParam, 'Failed to create file. Try again.');
  params.append(snackbarSeverityQueryParam, 'error');
  return path + '?' + params.toString();
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // We initialize mixpanel here (again, as we do it in the root loader) because
  // it helps us prevent the app from failing because all the loaders run in parallel
  // and we can't guarantee this loader finishes before the root one
  // Once this proposal ships, we should use it: https://github.com/remix-run/react-router/discussions/9564
  let user = await authClient.user();
  initMixpanelAnalytics(user);

  // Determine what kind of file creation we're doing:
  const url = new URL(request.url);

  // 1.
  // Clone an example file by passing the file id, e.g.
  // /files/create?example=:publicFileUrlInProduction
  const exampleUrl = url.searchParams.get('example');
  if (exampleUrl) {
    try {
      const { uuid, name } = await apiClient.examples.duplicate(exampleUrl);
      mixpanel.track('[Files].newExampleFile', { fileName: name });
      return redirectDocument(ROUTES.FILE(uuid));
    } catch (error) {
      Sentry.captureEvent({
        message: 'Client failed to load the selected example file.',
        level: 'warning',
        extra: {
          publicFileUrlInProduction: exampleUrl,
        },
      });
      return redirect(getFailUrl(ROUTES.EXAMPLES));
    }
  }

  // 2.
  // The file is being created as part of a team
  // /files/create?team=:uuid
  const teamUuid = url.searchParams.get('team-uuid');
  if (teamUuid) {
    mixpanel.track('[Files].newFileInTeam');
    try {
      const {
        file: { uuid },
      } = await apiClient.files.create(undefined, teamUuid);
      return redirectDocument(ROUTES.FILE(uuid));
    } catch (error) {
      return redirect(getFailUrl());
    }
  }

  // 3.
  // If there's no query params for the kind of file to create, just create a
  // new, blank file in the user’s personal files
  mixpanel.track('[Files].newFile');
  try {
    const {
      file: { uuid },
    } = await apiClient.files.create();
    return redirectDocument(ROUTES.FILE(uuid));
  } catch (error) {
    return redirect(getFailUrl());
  }
};

export type CreateActionRequest = {
  name: string;
  contents: string;
  version: string;
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const teamUuid = searchParams.get('team-uuid');
  const { name, contents, version }: CreateActionRequest = await request.json();

  mixpanel.track('[Files].loadFileFromDisk', { fileName: name });
  try {
    const {
      file: { uuid },
    } = await apiClient.files.create({ name, contents, version }, teamUuid ? teamUuid : undefined);
    return redirectDocument(ROUTES.FILE(uuid));
  } catch (error) {
    return redirect(getFailUrl());
  }
};
