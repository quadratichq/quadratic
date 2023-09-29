import { AddOutlined, ErrorOutline, InsertDriveFileOutlined } from '@mui/icons-material';
import { Box, Button, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  ActionFunctionArgs,
  Form,
  Link,
  LoaderFunctionArgs,
  useActionData,
  useFetchers,
  useLoaderData,
  useNavigation,
  useRouteError,
  useSubmit,
} from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { Empty } from '../../components/Empty';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { ShareFileMenu } from '../../components/ShareFileMenu';
import { ROUTES } from '../../constants/routes';
import { debugShowUILogs } from '../../debugFlags';
import { validateAndUpgradeGridFile } from '../../schemas/validateAndUpgradeGridFile';
import { DashboardHeader } from '../components/DashboardHeader';
import { FileListItem } from './MineRouteFileListItem';

export type ListFile = Awaited<ReturnType<typeof apiClient.getFiles>>[0];
type LoaderResponse = ListFile[];
export type Action = {
  response: { ok: boolean } | null;
  'request.delete': {
    action: 'delete';
    uuid: string;
  };
  'request.download': {
    action: 'download';
    uuid: string;
  };
  'request.duplicate': {
    action: 'duplicate';
    uuid: string;
    file: ListFile;
  };
  'request.rename': {
    action: 'rename';
    uuid: string;
    name: string;
  };
  request:
    | Action['request.delete']
    | Action['request.download']
    | Action['request.duplicate']
    | Action['request.rename'];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let data: LoaderResponse = await apiClient.getFiles();
  return data;
};

export const Component = () => {
  const files = useLoaderData() as LoaderResponse;
  const actionData = useActionData() as Action['response'];
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

  // Optimistcally render UI
  const filesBeingDeleted = fetchers.filter((fetcher) => (fetcher.json as Action['request'])?.action === 'delete');
  const filesBeingDuplicated = fetchers
    .filter((fetcher) => (fetcher.json as Action['request'])?.action === 'duplicate')
    .map((fetcher) => (fetcher.json as Action['request.duplicate'])?.file);
  const filesToRender = filesBeingDuplicated.concat(files);

  const activeShareMenuFileName = files.find((file) => file.uuid === activeShareMenuFileId)?.name || '';

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

                    const validFile = await validateAndUpgradeGridFile(contents);
                    if (!validFile) {
                      addGlobalSnackbar('Import failed: invalid `.grid` file.', { severity: 'error' });
                      return;
                    }

                    const name = file.name ? file.name.replace('.grid', '') : 'Untitled';

                    let formData = new FormData();
                    formData.append('name', name);
                    formData.append('version', validFile.version);
                    formData.append('contents', validFile.contents);
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

      {filesToRender.map((file, i) => (
        <FileListItem
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
              You don’t have any files. Using the buttons on this page, create a new one or import a <code>.grid</code>{' '}
              file from your computer.
            </>
          }
          Icon={InsertDriveFileOutlined}
        />
      )}

      {activeShareMenuFileId && (
        <ShareFileMenu
          onClose={() => {
            setActiveShareMenuFileId('');
          }}
          permission={'OWNER'}
          uuid={activeShareMenuFileId}
          fileName={activeShareMenuFileName}
        />
      )}
    </>
  );
};

export const action = async ({ params, request }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
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
      } = json as Action['request.duplicate'];
      const {
        file: { contents, version },
      } = await apiClient.getFile(uuid);
      await apiClient.createFile({ name, version, contents });
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  if (action === 'rename') {
    try {
      const { name } = json as Action['request.rename'];
      await apiClient.updateFile(uuid, { name });
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  return null;
};

export const ErrorBoundary = () => {
  const error = useRouteError();
  const theme = useTheme();

  if (debugShowUILogs) console.error('[<MineRoute>.<ErrorBoundary>]', error);

  return (
    <Box sx={{ maxWidth: '60ch', mx: 'auto', py: theme.spacing(2) }}>
      <Empty
        title="Unexpected error"
        description="An unexpected error occurred while retrieving your files. Try reloading the page. If the issue continues, contact us."
        Icon={ErrorOutline}
        severity="error"
      />
    </Box>
  );
};
