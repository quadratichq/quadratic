import { useEffect } from 'react';
import { json, useLoaderData, Form, useActionData, LoaderFunctionArgs } from 'react-router-dom';
import { GridFile } from './schemas';
import { protectedRouteLoaderWrapper } from './auth';
import apiClientSingleton from './api-client/apiClientSingleton';
import { useGlobalSnackbar } from './ui/contexts/GlobalSnackbar';

type LoaderData = {
  files?: GridFile[];
};

type ActionData = {
  deleteSuccess: boolean;
  dt: number;
};

// export const loader = async ({ request }: any): Promise<LoaderData> => {
//   return { files: await apiClientSingleton.getFiles() };
// };
export const loader = protectedRouteLoaderWrapper(async ({ request }: LoaderFunctionArgs) => {
  return { files: await apiClientSingleton.getFiles() };
});

const ListItem = ({ uuid, name }: { uuid: string; name: string }) => {
  // const fetcher = useFetcher();

  return (
    <li key={uuid}>
      {uuid} {name}
      <Form method="delete">
        <button name={'delete-file'} value={uuid}>
          Delete
        </button>
      </Form>
    </li>
  );
};

export const Component = () => {
  const data = useLoaderData() as LoaderData;
  const action = useActionData() as ActionData;
  const { addGlobalSnackbar } = useGlobalSnackbar();
  console.log('componentActionData', action);
  useEffect(() => {
    console.log(action);
    if (action && !action.deleteSuccess) {
      addGlobalSnackbar('Failed to delete file. Try again.');
    }
  }, [action, addGlobalSnackbar]);

  return (
    <div>
      Files
      <ul>
        {
          //@ts-expect-error
          data.files && data.files.map(({ uuid, name }) => <ListItem key={uuid} uuid={uuid} name={name} />)
        }
      </ul>
    </div>
  );
};

export const action = async ({ params, request }: any) => {
  const formData = await request.formData();
  const uuid = formData.get('delete-file');
  const deleteSuccess = await apiClientSingleton.deleteFile(uuid);

  const res = { deleteSuccess, dt: Date.now() };
  console.log('actionData', res);
  // TODO what if delete fails?
  return json(res, { status: 400 });
};
