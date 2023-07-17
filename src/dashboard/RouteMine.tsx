import { useLoaderData, LoaderFunctionArgs, Form } from 'react-router-dom';
import { protectedRouteLoaderWrapper } from '../auth';
import apiClientSingleton from '../api-client/apiClientSingleton';
// import { useEffect } from 'react';
import PaneHeader from './PaneHeader';
import File from './File';
import { timeAgo } from './utils';
import { Button, IconButton, useTheme } from '@mui/material';
import { DeleteOutline, FileDownloadOutlined } from '@mui/icons-material';
import { TooltipHint } from '../ui/components/TooltipHint';
// import { useGlobalSnackbar } from './ui/contexts/GlobalSnackbar';

type FileData = {
  name: string;
  uuid: string;
  // ISO8601 date
  created_date: string;
  updated_date: string;
};

type LoaderData = {
  files?: FileData[];
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
  const theme = useTheme();
  console.log(data);
  return (
    <>
      <PaneHeader
        title="My files"
        actions={
          <Form method="post" style={{ display: 'flex', gap: theme.spacing(1) }}>
            <Button variant="outlined" name="action" value="import" type="submit">
              Import
            </Button>
            <Button variant="contained" disableElevation name="action" value="create" type="submit">
              Create
            </Button>
          </Form>
        }
      />
      {data.files ? (
        data.files.map(({ uuid, name, updated_date }) => (
          <File
            key={uuid}
            to={`/file?local=${uuid}`}
            name={name}
            description={`Modified ${timeAgo(updated_date)}`}
            actions={
              <form method="post" style={{ display: 'flex', gap: theme.spacing(1) }}>
                <input type="hidden" name="action" />
                <TooltipHint title="Delete" enterDelay={1000}>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log(e);
                      // if (window.confirm(`Please confirm you want to delete the file “${filename}”`)) {
                      //   TODO
                      // }
                    }}
                  >
                    <DeleteOutline />
                  </IconButton>
                </TooltipHint>

                <TooltipHint title="Download local copy" enterDelay={1000}>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      // apiClientSingleton.downloadFile(id);
                    }}
                  >
                    <FileDownloadOutlined />
                  </IconButton>
                </TooltipHint>
              </form>
            }
          />
        ))
      ) : (
        <div>TODO No files yet</div>
      )}
    </>
  );
};

export const action = async ({ params, request }: any) => {
  const formData = await request.formData();
  const action = formData.get('action');

  if (action === 'create') {
    console.warn('fired create action');
    await new Promise((resolve) => {
      setTimeout(() => {
        console.warn('created new record');
      }, 5000);
    });
    return null;
  }

  return null;

  // IF DELETE
  // const uuid = formData.get('delete-file');
  // const deleteSuccess = await apiClientSingleton.deleteFile(uuid);
  // const res = { deleteSuccess, dt: Date.now() };
  // TODO what if delete fails?
  // return json(res, { status: 400 });

  // ELSE IF download

  // ELSE IF create
  // ELSE IF import
};

// function File({ uuid, name }: { uuid: string; name: string }) {
//   const fetcher = useFetcher();

//   useEffect(() => {
//     if (fetcher.data?.deleteSuccess) {
//       // TODO globalAlert provider
//     }
//   }, [fetcher.data]);
//   return (
//     <div
//       key={uuid}

//       onClick={}
//     >
//       <Link to={`/file?local=${uuid}`}>{name}</Link>
//       <fetcher.Form method="delete">
//         <button name={'delete-file'} value={uuid}>
//           Delete
//         </button>
//       </fetcher.Form>
//     </div>
//   );
// }
