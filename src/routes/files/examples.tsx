import apiClientSingleton from 'api-client/apiClientSingleton';
import { EXAMPLE_FILES } from 'constants/app';
import { useEffect } from 'react';
import { ActionFunctionArgs, Form, useActionData, useSubmit } from 'react-router-dom';
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
      <Header title="Example files" />
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

  const uuid = await fetch(`/examples/${file}`)
    .then((res) => res.text())
    .then((contents) => {
      if (!contents) {
        throw new Error('Failed to fetch example file');
      }
      return apiClientSingleton.createFile(name, contents);
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
