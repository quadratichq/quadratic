import { InsertDriveFileOutlined, SearchOff } from '@mui/icons-material';
import { Box, Stack, TextField, useTheme } from '@mui/material';
import { useState } from 'react';
import { ActionFunctionArgs, useFetchers } from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { Empty } from '../../components/Empty';
import { ShareFileMenu } from '../../components/ShareFileMenu';
import { FileListItem } from './FileListItem';
import { FileListLayoutPreferenceToggle, LayoutPreference } from './FileListLayoutPreferenceToggle';
import { FileListViewPreferences, Layout, Order, Sort, ViewPreferences } from './FileListViewPreferences';

export type Props = {
  files: Awaited<ReturnType<typeof apiClient.getFiles>>;
};

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
    file: Props['files'][0];
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

export function FileList({ files }: Props) {
  // const actionData = useActionData() as Action['response'];
  const [filterValue, setFilterValue] = useState<string>('');
  const [layoutPreference, setLayoutPreference] = useState<LayoutPreference>('list');
  const [viewPreferences, setViewPreferences] = useState<ViewPreferences>({
    sort: Sort.Updated,
    order: Order.Descending,
    layout: Layout.List,
  });
  const theme = useTheme();
  const fetchers = useFetchers();
  // const submit = useSubmit();
  // const navigation = useNavigation();
  const [activeShareMenuFileId, setActiveShareMenuFileId] = useState<string>('');
  // const isDisabled = navigation.state !== 'idle';
  // const { addGlobalSnackbar } = useGlobalSnackbar();

  // useEffect(() => {
  //   if (actionData && !actionData.ok) {
  //     addGlobalSnackbar('An error occurred. Try again.', { severity: 'error' });
  //   }
  // }, [actionData, addGlobalSnackbar]);

  // Optimistcally render UI
  const filesBeingDeleted = fetchers.filter((fetcher) => (fetcher.json as Action['request'])?.action === 'delete');
  const filesBeingDuplicated = fetchers
    .filter((fetcher) => (fetcher.json as Action['request'])?.action === 'duplicate')
    .map((fetcher) => (fetcher.json as Action['request.duplicate'])?.file);
  let filesToRender = filesBeingDuplicated.concat(files);

  // Filter out any values if the user has a query
  if (filterValue) {
    filesToRender = filesToRender.filter(({ name }) => name.toLowerCase().includes(filterValue.toLowerCase()));
  }

  // Sort 'em based on current prefs
  filesToRender.sort((a, b) => {
    let comparison;
    if (viewPreferences.sort === Sort.Alphabetical) {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      comparison = nameA.localeCompare(nameB);
    } else if (viewPreferences.sort === Sort.Created) {
      comparison = a.created_date.localeCompare(b.created_date);
    } else {
      comparison = a.updated_date.localeCompare(b.updated_date);
    }
    return viewPreferences.order === Order.Ascending ? comparison : -comparison;
  });

  const activeShareMenuFileName = files.find((file) => file.uuid === activeShareMenuFileId)?.name || '';

  return (
    <>
      {/* <FileListViewControls>
        <FileListFilter />
        <FileListViewPreferences>
          <FileListViewPreferenceSort />
          <FileListViewPreferenceLayout />
        </FileListViewPreferences>
      </FileListViewControls> */}

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={theme.spacing(2)}
        sx={{
          py: theme.spacing(1),
          borderBottom: `1px solid ${theme.palette.divider}`,
          [theme.breakpoints.up('md')]: {
            px: theme.spacing(),
          },
        }}
      >
        <Box sx={{ maxWidth: '25rem', flexGrow: 2 }}>
          <TextField
            onChange={(e) => setFilterValue(e.target.value)}
            value={filterValue}
            size="small"
            placeholder="Filter by name…"
            fullWidth
          />
        </Box>
        <Stack direction="row" gap={theme.spacing(2)} alignItems="center">
          <Box sx={{ color: theme.palette.text.secondary }}>
            <FileListViewPreferences viewPreferences={viewPreferences} setViewPreferences={setViewPreferences} />
          </Box>

          <Box>
            <FileListLayoutPreferenceToggle
              layoutPreference={layoutPreference}
              setLayoutPreference={setLayoutPreference}
            />
          </Box>
        </Stack>
      </Stack>

      {filesToRender.map((file, i) => (
        <FileListItem
          key={file.uuid}
          file={file}
          filterValue={filterValue}
          activeShareMenuFileId={activeShareMenuFileId}
          setActiveShareMenuFileId={setActiveShareMenuFileId}
          viewPreferences={viewPreferences}
        />
      ))}

      {filterValue && filesToRender.length === 0 && (
        <Empty title="No matches" description={<>No files found with that specified name.</>} Icon={SearchOff} />
      )}

      {filesBeingDeleted.length === files.length && filesBeingDuplicated.length === 0 && (
        <Empty
          title="No files"
          description={
            <>
              Using the buttons on this page, create a new file or import a <code>.grid</code> file from your computer.
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
}

export const action = async ({ params, request }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
  const { action, uuid } = json;
  // TODO remove uuid from being passed and pull it from the URL

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
