import { AddOutlined, ErrorOutline, InsertDriveFileOutlined, MoreVert } from '@mui/icons-material';
import { Box, Button, Chip, CircularProgress, Divider, IconButton, Menu, MenuItem, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  ActionFunctionArgs,
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
import { deleteFile, downloadFile, duplicateFile, renameFile } from '../../actions';
import { apiClient } from '../../api/apiClient';
import { Empty } from '../../components/Empty';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { ShareFileMenu } from '../../components/ShareFileMenu';
import { ROUTES } from '../../constants/routes';
import { validateAndUpgradeGridFile } from '../../schemas/validateAndUpgradeGridFile';
import { DashboardFileLink } from '../components/DashboardFileLink';
import { DashboardHeader } from '../components/DashboardHeader';

type ListFile = Awaited<ReturnType<typeof apiClient.getFiles>>[0];
type LoaderRes = ListFile[] | null;

type ActionRes = {
  ok: boolean;
} | null;

type ActionReqDelete = {
  action: 'delete';
  uuid: string;
};
type ActionReqDownload = {
  action: 'download';
  uuid: string;
};
type ActionReqDuplicate = {
  action: 'duplicate';
  uuid: string;
  file: ListFile;
};
type ActionReq = ActionReqDelete | ActionReqDownload | ActionReqDuplicate;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.warn('fired loader');
  return apiClient.getFiles().catch((e) => {
    console.error(e);
    return null;
  });
};

export const Component = () => {
  const files = useLoaderData() as LoaderRes;
  const actionData = useActionData() as ActionRes;
  const theme = useTheme();
  const fetchers = useFetchers();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [activeShareMenuFileId, setActiveShareMenuFileId] = useState<string>('');
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
    // Optimistcally render UI
    const filesBeingDeleted = fetchers.filter((fetcher) => (fetcher.json as ActionReq)?.action === 'delete');
    const filesBeingDuplicated = fetchers
      .filter((fetcher) => (fetcher.json as ActionReq)?.action === 'duplicate')
      .map((fetcher) => (fetcher.json as ActionReqDuplicate)?.file);
    const filesToRender = filesBeingDuplicated.concat(files);

    filesUI = (
      <>
        {filesToRender.map((file, i) => (
          <FileWithActions
            key={file.uuid}
            file={file}
            activeShareMenuFileId={activeShareMenuFileId}
            setActiveShareMenuFileId={setActiveShareMenuFileId}
          />
        ))}
        {filesBeingDeleted.length === files.length && filesBeingDuplicated.length === 0 && (
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

      {activeShareMenuFileId && (
        <ShareFileMenu
          onClose={() => {
            setActiveShareMenuFileId('');
          }}
          permission={'OWNER'}
          fileUuid={activeShareMenuFileId}
        />
      )}
    </>
  );
};

export const action = async ({ params, request }: ActionFunctionArgs): Promise<ActionRes> => {
  const json: ActionReq = await request.json();
  const { action, uuid } = json;

  if (action === 'delete') {
    try {
      await apiClient.deleteFile(uuid);
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  if (action === 'download') {
    try {
      await apiClient.downloadFile(uuid);
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  if (action === 'duplicate') {
    try {
      const {
        file: { name },
      } = json as ActionReqDuplicate;
      const {
        file: { contents, version },
      } = await apiClient.getFile(uuid);
      await apiClient.createFile({ name, version, contents });
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  return null;
};

function FileWithActions({
  file,
  activeShareMenuFileId,
  setActiveShareMenuFileId,
}: {
  file: ListFile;
  activeShareMenuFileId: string;
  setActiveShareMenuFileId: Function;
}) {
  const theme = useTheme();
  const fetcherDelete = useFetcher();
  const fetcherDownload = useFetcher();
  const fetcherDuplicate = useFetcher();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    if (fetcherDownload.data && !fetcherDownload.data.ok) {
      addGlobalSnackbar('Failed to download file. Try again.', { severity: 'error' });
    }
  }, [addGlobalSnackbar, fetcherDownload.data]);

  if (fetcherDelete.state === 'submitting' || fetcherDelete.state === 'loading') {
    return null;
  }

  const { uuid, name, updated_date, public_link_access } = file;
  const open = Boolean(anchorEl);
  const failedToDelete = fetcherDelete.data && !fetcherDelete.data.ok;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    event.preventDefault();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <DashboardFileLink
      to={uuid.startsWith('duplicate-') ? '' : ROUTES.FILE(uuid)}
      key={uuid}
      name={name}
      status={failedToDelete && <Chip label="Failed to delete" size="small" color="error" variant="outlined" />}
      description={`Updated ${timeAgo(updated_date)}`}
      isShared={public_link_access !== 'NOT_SHARED'}
      actions={
        <div style={{ display: 'flex', gap: theme.spacing(1), alignItems: 'center' }}>
          {fetcherDownload.state === 'submitting' && <CircularProgress size={18} />}
          <IconButton
            id="file-actions-button"
            aria-controls={open ? 'file-actions-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            onClick={handleClick}
          >
            <MoreVert />
          </IconButton>
          <Menu
            id="file-actions-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            MenuListProps={{
              'aria-labelledby': 'file-actions-button',
            }}
          >
            <MenuItem
              dense
              onClick={() => {
                setActiveShareMenuFileId(uuid);
                handleClose();
              }}
            >
              Share
            </MenuItem>
            <MenuItem
              dense
              onClick={(e) => {
                e.stopPropagation();
                const date = new Date().toISOString();
                const data: ActionReqDuplicate = {
                  action: 'duplicate',
                  uuid,
                  // These are the values that will optimistically render in the UI
                  file: {
                    uuid: 'duplicate-' + date,
                    public_link_access: 'NOT_SHARED',
                    name: name + ' (Copy)',
                    updated_date: date,
                    created_date: date,
                  },
                };
                fetcherDuplicate.submit(data, { method: 'POST', encType: 'application/json' });
                handleClose();
              }}
            >
              {duplicateFile.label}
            </MenuItem>
            <MenuItem dense onClick={handleClose}>
              {renameFile.label}
            </MenuItem>

            <MenuItem
              dense
              onClick={(e) => {
                e.stopPropagation();
                const data: ActionReqDownload = {
                  action: 'download',
                  uuid,
                };
                fetcherDownload.submit(data, { method: 'POST', encType: 'application/json' });
                handleClose();
              }}
            >
              {downloadFile.label}
            </MenuItem>
            <Divider />

            <MenuItem
              dense
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Confirm you want to delete the file: “${name}”`)) {
                  const data: ActionReqDelete = {
                    uuid,
                    action: 'delete',
                  };
                  fetcherDelete.submit(data, { method: 'POST', encType: 'application/json' });
                }
                handleClose();
              }}
            >
              {deleteFile.label}
            </MenuItem>
          </Menu>
        </div>
      }
    />
  );
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
