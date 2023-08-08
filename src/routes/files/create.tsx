import apiClientSingleton from 'api-client/apiClientSingleton';
import mixpanel from 'mixpanel-browser';
import { ActionFunctionArgs, redirect } from 'react-router-dom';
import { validateAndUpgradeGridFile } from 'schemas/validateAndUpgradeGridFile';

const failUrl = encodeURI('/files/mine?snackbar-msg=Failed to create file. Try again.&snackbar-severity=error');

// FYI the `await new Promise()` code is a hack until this ships in react-router
// https://github.com/remix-run/react-router/pull/10705
// Hard reload instead of SPA navigation and replace current stack
const navigate = async (uuid: string) => {
  window.location.href = `/file/${uuid}`;
  await new Promise((resolve) => setTimeout(resolve, 10000));
  return redirect('/');
};

export const loader = async (thing: any) => {
  console.warn('fired loader');
  mixpanel.track('[Files].newFileGet');
  const uuid = await apiClientSingleton.createFile();
  if (uuid) {
    return navigate(uuid);
  }

  return redirect(failUrl);
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get('action');
  console.warn('fired action');

  if (action === 'create') {
    mixpanel.track('[Files].newFile');
    const uuid = await apiClientSingleton.createFile();

    if (uuid) {
      return navigate(uuid);
    }
  }

  if (action === 'import') {
    const name = formData.get('name') as string;
    const contents = formData.get('contents') as string;
    const version = formData.get('version') as string;

    mixpanel.track('[Files].loadFileFromDisk', { fileName: name });
    const uuid = await apiClientSingleton.createFile({ name, contents, version });

    if (uuid) {
      return navigate(uuid);
    }
  }

  if (action === 'clone-example') {
    const name = formData.get('name') as string;
    const file = formData.get('file') as string;

    mixpanel.track('[Files].newExampleFile', { fileName: name });
    const uuid = await fetch(`/examples/${file}`)
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
  }

  return redirect(failUrl);
};
