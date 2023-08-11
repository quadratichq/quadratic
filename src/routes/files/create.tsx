import apiClientSingleton from 'api-client/apiClientSingleton';
import { EXAMPLE_FILES } from 'constants/app';
import { ROUTES } from 'constants/routes';
import mixpanel from 'mixpanel-browser';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from 'react-router-dom';
import { validateAndUpgradeGridFile } from 'schemas/validateAndUpgradeGridFile';

const getFailUrl = (location: string = ROUTES.MY_FILES) =>
  encodeURI(`${location}?snackbar-msg=Failed to create file. Try again.&snackbar-severity=error`);

// FYI the `await new Promise()` code is a hack until this ships in react-router
// https://github.com/remix-run/react-router/pull/10705
// Hard reload instead of SPA navigation and replace current stack
const navigate = async (uuid: string) => {
  window.location.href = ROUTES.FILE(uuid);
  await new Promise((resolve) => setTimeout(resolve, 10000));
  return redirect('/');
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Allows you to clone an example file by passing the file id, e.g.
  // /files/create?example=:id
  const url = new URL(request.url);
  const exampleId = url.searchParams.get('example');
  if (exampleId) {
    if (!EXAMPLE_FILES.hasOwnProperty(exampleId)) {
      // If we get here, something's wrong
      // TODO log to sentry
      return redirect(getFailUrl(ROUTES.EXAMPLES));
    }

    const { name } = EXAMPLE_FILES[exampleId];

    // These fail on fresh page loads new loads
    // mixpanel.track('[Files].newExampleFile', { fileName: name });

    const uuid = await fetch(`/examples/${exampleId}`)
      .then((res) => res.text())
      .then((contents) => {
        const file = validateAndUpgradeGridFile(contents);
        if (!file) {
          throw new Error(`Failed to create a new file because the example file is corrupt: ${file}`);
        }
        return apiClientSingleton.createFile({ name, contents: JSON.stringify(file), version: file.version });
      })
      .catch((err) => {
        console.error(err);
        // TODO sentry error
        return undefined;
      });

    if (uuid) {
      return navigate(uuid);
    }

    return redirect(getFailUrl(ROUTES.EXAMPLES));
  }

  // If there's no query params for the kind of file to create, just create a blank new one

  // TODO this crashes the app
  mixpanel.track('[Files].newFile', undefined, undefined, () => {
    console.warn('tracking event recoreded by mixpanel');
  });
  const uuid = await apiClientSingleton.createFile();
  if (uuid) {
    return navigate(uuid);
  }
  return redirect(getFailUrl());
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const name = formData.get('name') as string;
  const contents = formData.get('contents') as string;
  const version = formData.get('version') as string;

  if (name && contents && version) {
    mixpanel.track('[Files].loadFileFromDisk', { fileName: name });
    const uuid = await apiClientSingleton.createFile({ name, contents, version });
    if (uuid) {
      return navigate(uuid);
    }
  }

  return redirect(getFailUrl());
};
