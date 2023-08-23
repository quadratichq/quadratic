import {
  AddOutlined,
  DeleteOutline,
  ErrorOutline,
  FileDownloadOutlined,
  InsertDriveFileOutlined,
} from '@mui/icons-material';
import { Box, Button, Chip, CircularProgress, IconButton, useTheme } from '@mui/material';
import { useEffect } from 'react';
import {
  ActionFunctionArgs,
  Fetcher,
  Form,
  Link,
  LoaderFunctionArgs,
  useActionData,
  useFetcher,
  useFetchers,
  useLoaderData,
  useNavigation,
  useSubmit,
} from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { Empty } from '../../components/Empty';
import { useGlobalSnackbar } from '../../components/GlobalSnackbar';
import { ROUTES } from '../../constants/routes';
import { validateAndUpgradeGridFile } from '../../schemas/validateAndUpgradeGridFile';
import { TooltipHint } from '../../ui/components/TooltipHint';
import { DashboardFileLink } from '../components/DashboardFileLink';
import { DashboardHeader } from '../components/DashboardHeader';

type LoaderData = Awaited<ReturnType<typeof apiClient.getFiles>> | null;
type ActionData = {
  ok: boolean;
} | null;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return apiClient.getFiles().catch((e) => {
    console.error(e);
    return null;
  });
};

export const Component = () => {
  const files = useLoaderData() as LoaderData;
  const actionData = useActionData() as ActionData;
  const theme = useTheme();
  const fetchers = useFetchers();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isDisabled = navigation.state !== 'idle';
  const { addGlobalSnackbar } = useGlobalSnackbar();

  useEffect(() => {
    if (actionData && !actionData.ok) {
      addGlobalSnackbar('An error occurred. Try again.', { severity: 'error' });
    }
  }, [actionData, addGlobalSnackbar]);

  let filesUI;
  if (!files) {
    filesUI = (
      <Box sx={{ maxWidth: '60ch', mx: 'auto', py: theme.spacing(2) }}>
        <Empty
          title="Unexpected error"
          description="An unexpected error occurred while retrieving your files. Try reloading the page. If the issue continues, contact us."
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
      <DashboardHeader
        title="My files"
        actions={
          <div style={{ display: 'flex', gap: theme.spacing(1) }}>
            <Button
              startIcon={<AddOutlined />}
              variant="contained"
              disableElevation
              disabled={isDisabled}
              component={Link}
              to={ROUTES.CREATE_FILE}
            >
              Create
            </Button>
            <Form method="POST" action={ROUTES.CREATE_FILE}>
              <Button variant="outlined" component="label" disabled={isDisabled}>
                <input type="hidden" name="action" value="import" />
                <input
                  type="file"
                  name="content"
                  accept=".grid"
                  onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                    if (!e.target.files) {
                      return;
                    }
                    const file: File = e.target.files[0];
                    const contents = await file.text().catch((e) => null);

                    const validFile = validateAndUpgradeGridFile(contents);
                    if (!validFile) {
                      addGlobalSnackbar('Import failed: invalid `.grid` file.', { severity: 'error' });
                      return;
                    }

                    const name = file.name ? file.name.replace('.grid', '') : 'Untitled';

                    let formData = new FormData();
                    formData.append('name', name);
                    formData.append('version', validFile.version);
                    formData.append('contents', JSON.stringify(validFile));
                    submit(formData, { method: 'POST', action: ROUTES.CREATE_FILE });
                  }}
                  hidden
                />
                Import
              </Button>
            </Form>
          </div>
        }
      />

      {filesUI}
    </>
  );
};

export const action = async ({ params, request }: ActionFunctionArgs): Promise<ActionData> => {
  const formData = await request.formData();
  const action = formData.get('action');

  if (action === 'delete') {
    const uuid = formData.get('uuid') as string;
    try {
      await apiClient.deleteFile(uuid);
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  if (action === 'download') {
    const uuid = formData.get('uuid') as string;
    try {
      await apiClient.downloadFile(uuid);
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  return null;
};

function FileWithActions({ file }: { file: NonNullable<LoaderData>[0] }) {
  const { uuid, name, updated_date, public_link_access } = file;
  const theme = useTheme();
  const fetcherDelete = useFetcher();
  const fetcherDownload = useFetcher();
  const { addGlobalSnackbar } = useGlobalSnackbar();

  useEffect(() => {
    if (fetcherDownload.data && !fetcherDownload.data.ok) {
      addGlobalSnackbar('Failed to download file. Try again.', { severity: 'error' });
    }
  }, [addGlobalSnackbar, fetcherDownload.data]);

  if (optimisticallyHideFileBeingDeleted(fetcherDelete)) {
    return null;
  }

  const failedToDelete = fetcherDelete.data && !fetcherDelete.data.ok;

  return (
    <DashboardFileLink
      to={ROUTES.FILE(uuid)}
      key={uuid}
      name={name}
      status={failedToDelete && <Chip label="Failed to delete" size="small" color="error" variant="outlined" />}
      description={`Updated ${timeAgo(updated_date)}`}
      isShared={public_link_access !== 'NOT_SHARED'}
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
