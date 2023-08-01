import { DeleteOutline, ErrorOutline, FileDownloadOutlined, InsertDriveFileOutlined } from '@mui/icons-material';
import { Box, Button, Chip, CircularProgress, IconButton, useTheme } from '@mui/material';
import apiClientSingleton from 'api-client/apiClientSingleton';
import { GetFilesRes } from 'api-client/types';
import { protectedRouteLoaderWrapper } from 'auth';
import {
  ActionFunctionArgs,
  Fetcher,
  Form,
  Link,
  LoaderFunctionArgs,
  useFetcher,
  useFetchers,
  useLoaderData,
  useSubmit,
} from 'react-router-dom';
import Empty from 'shared/Empty';
import File from 'shared/dashboard/File';
import Header from 'shared/dashboard/Header';
import { TooltipHint } from 'ui/components/TooltipHint';

export const loader = protectedRouteLoaderWrapper(async ({ request }: LoaderFunctionArgs) => {
  const files = await apiClientSingleton.getFiles();
  return files;
});

export const Component = () => {
  const files = useLoaderData() as GetFilesRes;
  const theme = useTheme();
  const fetchers = useFetchers();
  const submit = useSubmit();

  let filesUI;
  if (!files) {
    filesUI = (
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
    );
  } else {
    const renderEmptyList =
      files.length === 0 ||
      // Optimistic UI
      // If the number of fetchers that are in the process of being deleted match
      // the number of files there are, render the empty state.
      fetchers.filter(
        (fetcher) => fetcher.formData?.get('action') === 'delete' && optimisticallyHideFileBeingDeleted(fetcher)
      ).length === files.length;

    filesUI = (
      <>
        {files.map((file) => (
          <FileWithActions key={file.uuid} file={file} />
        ))}
        {renderEmptyList && (
          <Empty
            title="No files"
            description={
              <>
                You don’t have any files. Using the buttons on this page, create a new one or import a{' '}
                <code>.grid</code> file from your computer.
              </>
            }
            Icon={InsertDriveFileOutlined}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Header
        title="My files"
        actions={
          <Form method="post" style={{ display: 'flex', gap: theme.spacing(1) }}>
            <Button variant="outlined" component="label">
              <input
                type="file"
                name="file"
                accept=".grid"
                onChange={async (e: any) => {
                  if (!e.target.files) {
                    return;
                  }
                  const file: File = e.target.files[0];
                  const contents = await file.text().catch((e) => '');
                  if (!contents) {
                    return;
                  }
                  // TODO validate that it's a .grid file, update it to the latest version

                  const name = file.name ? file.name.replace('.grid', '') : 'Untitled';

                  let formData = new FormData();
                  formData.append('action', 'import');
                  formData.append('name', name);
                  formData.append('contents', contents);
                  submit(formData, { method: 'POST' });
                }}
                hidden
              />
              Import
            </Button>

            <Button variant="contained" disableElevation name="action" value="create" type="submit">
              Create
            </Button>
          </Form>
        }
      />

      {filesUI}
    </>
  );
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get('action');

  if (action === 'create') {
    const res = await apiClientSingleton.createFile();
    if (res?.uuid) {
      window.location.href = `/file/${res.uuid}`;
      // This will do a SPA navigation, but we want a hard reload ATM
      // return redirect(`/file/${res.uuid}`);
    }
    // TODO handle doesn't create
  }

  if (action === 'delete') {
    const uuid = formData.get('uuid');
    const success = await apiClientSingleton.deleteFile(uuid as string);
    return { success };
  }

  if (action === 'download') {
    const uuid = formData.get('uuid');
    await apiClientSingleton.downloadFile(uuid as string);
    // TODO should we handle this not working?
  }

  // TODO
  if (action === 'import') {
    const name = formData.get('name') as string;
    const contents = formData.get('contents') as string;
    const res = await apiClientSingleton.createFile(name, contents);
    if (res?.uuid) {
      window.location.href = `/file/${res.uuid}`;
    }
    // TODO handle doesn't create
  }

  return null;
};

function FileWithActions({ file }: { file: NonNullable<GetFilesRes>[0] }) {
  const { uuid, name, updated_date } = file;
  const theme = useTheme();
  const fetcherDelete = useFetcher();
  const fetcherDownload = useFetcher();

  if (optimisticallyHideFileBeingDeleted(fetcherDelete)) {
    return null;
  }

  const failedToDelete = fetcherDelete.data && !fetcherDelete.data.success;

  return (
    <Link to={`/file/${uuid}`} reloadDocument style={{ textDecoration: 'none', color: 'inherit' }}>
      <File
        key={uuid}
        name={name}
        status={failedToDelete && <Chip label="Failed to delete" size="small" color="error" variant="outlined" />}
        description={`Updated ${timeAgo(updated_date)}`}
        actions={
          <div style={{ display: 'flex', gap: theme.spacing(1) }}>
            <fetcherDelete.Form method="post">
              <input type="hidden" name="uuid" value={uuid} />
              <TooltipHint title="Delete" enterDelay={1000}>
                <span>
                  <IconButton
                    name="action"
                    value="delete"
                    type="submit"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!window.confirm(`Confirm you want to delete the file: “${name}”`)) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <DeleteOutline />
                  </IconButton>
                </span>
              </TooltipHint>
            </fetcherDelete.Form>
            <fetcherDownload.Form method="post">
              <input type="hidden" name="uuid" value={uuid} />
              <TooltipHint title="Download local copy" enterDelay={1000}>
                <span>
                  <IconButton
                    name="action"
                    value="download"
                    type="submit"
                    disabled={false}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    {fetcherDownload.state !== 'idle' ? <CircularProgress size={24} /> : <FileDownloadOutlined />}
                  </IconButton>
                </span>
              </TooltipHint>
            </fetcherDownload.Form>
          </div>
        }
      />
    </Link>
  );
}

function optimisticallyHideFileBeingDeleted(fetcher: Fetcher) {
  return fetcher.state === 'submitting' || fetcher.state === 'loading' || (fetcher.data && fetcher.data.success);
}

// Vanilla js time formatter. Adapted from:
// https://blog.webdevsimplified.com/2020-07/relative-time-format/
const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
});
const DIVISIONS: { amount: number; name: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, name: 'seconds' },
  { amount: 60, name: 'minutes' },
  { amount: 24, name: 'hours' },
  { amount: 7, name: 'days' },
  { amount: 4.34524, name: 'weeks' },
  { amount: 12, name: 'months' },
  { amount: Number.POSITIVE_INFINITY, name: 'years' },
];
export function timeAgo(dateString: string) {
  const date: Date = new Date(dateString);

  let duration = (date.getTime() - new Date().getTime()) / 1000;

  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
}
