import { json, useLoaderData, Form, Link, LoaderFunctionArgs } from 'react-router-dom';
import { GridFile } from './schemas';
import { protectedRouteLoaderWrapper } from './auth';
import apiClientSingleton from './api-client/apiClientSingleton';
// import { useGlobalSnackbar } from './ui/contexts/GlobalSnackbar';

type LoaderData = {
  files?: GridFile[];
};

// type ActionData = {
//   deleteSuccess: boolean;
//   dt: number;
// };

export const loader = protectedRouteLoaderWrapper(async ({ request }: LoaderFunctionArgs) => {
  return { files: await apiClientSingleton.getFiles() };
});

export const Component = () => {
  const data = useLoaderData() as LoaderData;
  // const theme = useTheme();
  return (
    <>
      Files
      {
        //@ts-expect-error
        data.files && data.files.map(({ uuid, name }) => <File key={uuid} uuid={uuid} name={name} />)
      }
    </>
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

function File({ uuid, name }: { uuid: string; name: string }) {
  // const fetcher = useFetcher();
  return (
    <div
      key={uuid}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'white',
        margin: '4px 0',
      }}
    >
      <Link to={`/file?local=${uuid}`} reloadDocument>
        {name}
      </Link>
      <Form method="delete">
        <button name={'delete-file'} value={uuid}>
          Delete
        </button>
      </Form>
    </div>
  );
}
