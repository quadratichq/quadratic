import { useLoaderData, LoaderFunctionArgs, Form, Link } from 'react-router-dom';
import { protectedRouteLoaderWrapper } from '../auth';
import apiClientSingleton from '../api-client/apiClientSingleton';
// import { useEffect } from 'react';
import PaneHeader from './PaneHeader';
import File from './File';
import { timeAgo } from './utils';
import { Box, Button, IconButton, useTheme } from '@mui/material';
import { DeleteOutline, ErrorOutline, FileDownloadOutlined, InsertDriveFileOutlined } from '@mui/icons-material';
import { TooltipHint } from '../ui/components/TooltipHint';
import Empty from './Empty';
// import { useGlobalSnackbar } from './ui/contexts/GlobalSnackbar';

type FileData = {
  name: string;
  uuid: string;
  // ISO8601 date
  created_date: string;
  updated_date: string;
};

type LoaderData = {
  files: FileData[] | undefined;
};

// type ActionData = {
//   deleteSuccess: boolean;
//   dt: number;
// };

export const loader = protectedRouteLoaderWrapper(async ({ request }: LoaderFunctionArgs) => {
  const files = await apiClientSingleton.getFiles();
  return { files };
});

export const Component = () => {
  const { files } = useLoaderData() as LoaderData;
  const theme = useTheme();

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

      {!files ? (
        <Box sx={{ maxWidth: '60ch', mx: 'auto', py: theme.spacing(2) }}>
          <Empty
            title="Unexpected error"
            description="An unexpected error occurred while retrieving your files. Try reloading the page. If the issue continues, contact us."
            actions={
              <Button variant="outlined" disableElevation component={Link} to="." reloadDocument>
                Reload
              </Button>
            }
            Icon={ErrorOutline}
            severity="error"
          />
        </Box>
      ) : files.length ? (
        files.map(({ uuid, name, updated_date }) => (
          <File
            key={uuid}
            to={`/file/${uuid}`}
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
        <Empty
          title="No files"
          description={
            <>
              You don’t have any files. Using the buttons on this page, create a new one or import a <code>.grid</code>{' '}
              file from your computer.
            </>
          }
          Icon={InsertDriveFileOutlined}
        />
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
