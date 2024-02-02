import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { authClient } from '../auth';
import { snackbarMsgQueryParam, snackbarSeverityQueryParam } from '../components/GlobalSnackbarProvider';
import { EXAMPLE_FILES, ExampleFileNames } from '../constants/appConstants';
import { ROUTES } from '../constants/routes';
import { validateAndUpgradeGridFile } from '../schemas/validateAndUpgradeGridFile';
import { initMixpanelAnalytics } from '../utils/analytics';

const getFailUrl = (path: string = ROUTES.FILES) => {
  let params = new URLSearchParams();
  params.append(snackbarMsgQueryParam, 'Failed to create file. Try again.');
  params.append(snackbarSeverityQueryParam, 'error');
  return path + '?' + params.toString();
};

// FYI the `await new Promise()` code is a hack until this ships in react-router
// https://github.com/remix-run/react-router/pull/10705
// Hard reload instead of SPA navigation and replace current stack
const navigate = async (uuid: string) => {
  window.location.href = ROUTES.FILE(uuid);
  await new Promise((resolve) => setTimeout(resolve, 10000));
  return redirect('/');
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // We initialize mixpanel here (again, as we do it in the root loader) because
  // it helps us prevent the app from failing because all the loaders run in parallel
  // and we can't guarantee this loader finishes before the root one
  // Once this proposal ships, we should use it: https://github.com/remix-run/react-router/discussions/9564
  let user = await authClient.user();
  initMixpanelAnalytics(user);

  // Allows you to clone an example file by passing the file id, e.g.
  // /files/create?example=:id
  const url = new URL(request.url);
  const exampleId = url.searchParams.get('example');
  if (exampleId) {
    if (!EXAMPLE_FILES.hasOwnProperty(exampleId)) {
      // If we get here, something's wrong
      Sentry.captureEvent({
        message: 'Client tried to load an invalid example file.',
        level: 'warning',
        extra: {
          exampleId,
        },
      });
      return redirect(getFailUrl(ROUTES.EXAMPLES));
    }

    // Above we've ensured it's a file name we know about
    const fileNameKey = exampleId as ExampleFileNames;
    const { name } = EXAMPLE_FILES[fileNameKey];
    mixpanel.track('[Files].newExampleFile', { fileName: name });

    try {
      // Get example file's contents
      const res = await fetch(`/examples/${fileNameKey}`);
      const contents = await res.text();

      // Validate and upgrade file
      const file = await validateAndUpgradeGridFile(contents);
      if (!file) {
        Sentry.captureEvent({
          message: `Failed to validate and upgrade example file from an upload. It will likely have to be fixed manually. File name ${name}`,
          level: 'error',
        });
        throw new Error(`Failed to create a new file because the example file is corrupt: ${file}`);
      }

      // Create a new file from that example file
      const { uuid } = await apiClient.files.create({ name, contents: file.contents, version: file.version });

      // Navigate to it
      return navigate(uuid);
    } catch (error) {
      Sentry.captureEvent({
        message: 'Client failed to load the selected example file.',
        level: 'warning',
        extra: {
          fileNameKey,
        },
      });
      return redirect(getFailUrl(ROUTES.EXAMPLES));
    }
  }

  // If there's no query params for the kind of file to create, just create a blank new one
  mixpanel.track('[Files].newFile');
  try {
    const { uuid } = await apiClient.files.create();
    return navigate(uuid);
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
  const { name, contents, version }: CreateActionRequest = await request.json();

  mixpanel.track('[Files].loadFileFromDisk', { fileName: name });
  try {
    const { uuid } = await apiClient.files.create({ name, contents, version });
    return navigate(uuid);
  } catch (error) {
    return redirect(getFailUrl());
  }
};
