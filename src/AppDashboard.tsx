import { useLoaderData, useFetcher } from 'react-router-dom';
import { GridFile } from './schemas';
// import apiClientSingleton from './api-client/apiClientSingleton';
// import { protectedRouteLoaderWrapper } from './auth';

type LoaderData = {
  files?: GridFile[];
};

// export const loader = async ({ request }: any): Promise<LoaderData> => {
//   return { files: await apiClientSingleton.getFiles() };
// };

const ListItem = ({ uuid, name }: { uuid: string; name: string }) => {
  const fetcher = useFetcher();
  return (
    <li key={uuid}>
      {uuid} {name}
      <fetcher.Form method="delete">
        <button name={'delete-file'} value={uuid}>
          Delete
        </button>
      </fetcher.Form>
    </li>
  );
};

export const Component = () => {
  const data = useLoaderData() as LoaderData;

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
  console.warn('delete-file', uuid);
  await fetch(`http://localhost:8000/v0/files/${uuid}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer `,
    },
  });
  return null;
};
