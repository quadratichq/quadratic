import { ActionFunctionArgs, Form, useSubmit } from 'react-router-dom';
import apiClientSingleton from '../../../api-client/apiClientSingleton';
import { EXAMPLE_FILES } from '../../../constants/app';
import File from '../../File';
import PaneHeader from '../../PaneHeader';

export const Component = () => {
  const submit = useSubmit();
  return (
    <>
      <PaneHeader title="Example files" />
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
  const file = formData.get('file');
  const name = formData.get('name') as string;

  const contents = await fetch(`/examples/${file}`)
    .then((res) => res.text())
    .catch(() => '');
  if (!contents) {
    // TODO Handle can't fetch file
    return null;
  }
  const res = await apiClientSingleton.createFile(name, contents);
  if (res?.uuid) {
    window.location.href = `/file/${res.uuid}`;
  }
  // TODO handle not created

  return null;
};
