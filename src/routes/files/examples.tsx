import apiClientSingleton from 'api-client/apiClientSingleton';
import { EXAMPLE_FILES } from 'constants/app';
import mixpanel from 'mixpanel-browser';
import { useEffect } from 'react';
import { ActionFunctionArgs, Form, useActionData, useSubmit } from 'react-router-dom';
import { validateAndUpgradeGridFile } from 'schemas/validateAndUpgradeGridFile';
import { useGlobalSnackbar } from 'shared/GlobalSnackbar';
import File from 'shared/dashboard/FileListItem';
import Header from 'shared/dashboard/Header';

type ActionData = {
  ok?: boolean;
};

export const Component = () => {
  const submit = useSubmit();
  const data = useActionData() as ActionData;
  const { addGlobalSnackbar } = useGlobalSnackbar();

  useEffect(() => {
    if (data && !data.ok) {
      addGlobalSnackbar('Failed to load example file. Try again.', { severity: 'error' });
    }
  }, [data, addGlobalSnackbar]);

  return (
    <>
      <Header title="Examples" />
      {EXAMPLE_FILES.map(({ name, description, file }) => (
        <Form key={file} method="post" onClick={(e) => submit(e.currentTarget)}>
          <input type="hidden" name="file" value={file} />
          <input type="hidden" name="name" value={name} />
          <File key={file} name={name} description={description} />
        </Form>
      ))}
    </>
  );
};

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionData> => {
  const formData = await request.formData();
  const file = formData.get('file') as string;
  const name = formData.get('name') as string;

  mixpanel.track('[Files].loadExample', { file });

  const uuid = await fetch(`/examples/${file}`)
    .then((res) => res.text())
    .then((contents) => {
      const file = validateAndUpgradeGridFile(contents);
      if (!file) {
        throw new Error('Failed to create a new file because the example files are corrupt.');
      }
      return apiClientSingleton.createFile({ name, contents: JSON.stringify(file), version: file.version });
    })
    .catch((err) => {
      console.error(err);
      return undefined;
    });

  if (uuid) {
    window.location.href = `/file/${uuid}`;
  }

  return { ok: false };
};
