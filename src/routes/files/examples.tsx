import apiClientSingleton from 'api-client/apiClientSingleton';
import { EXAMPLE_FILES } from 'constants/app';
import { ActionFunctionArgs, Form, useSubmit } from 'react-router-dom';
import File from 'shared/dashboard/File';
import Header from 'shared/dashboard/Header';

export const Component = () => {
  const submit = useSubmit();

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

export const action = async ({ request }: ActionFunctionArgs) => {
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
      return undefined;
    });

  if (uuid) {
    window.location.href = `/file/${uuid}`;
  }

  // TODO handle not created
  return null;
};
