import { AddOutlined, ErrorOutline } from '@mui/icons-material';
import { Box, Button, useTheme } from '@mui/material';
import {
  Form,
  Link,
  LoaderFunctionArgs,
  useLoaderData,
  useNavigation,
  useRouteError,
  useSubmit,
} from 'react-router-dom';
import { apiClient } from '../../api/apiClient';
import { Empty } from '../../components/Empty';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { ROUTES } from '../../constants/routes';
import { debugShowUILogs } from '../../debugFlags';
import { validateAndUpgradeGridFile } from '../../schemas/validateAndUpgradeGridFile';
import CreateButton from '../components/CreateButton';
import { DashboardHeader } from '../components/DashboardHeader';
import { FileList } from '../components/FileList';

export type ListFile = Awaited<ReturnType<typeof apiClient.getFiles>>[0];
type LoaderResponse = ListFile[];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let data: LoaderResponse = await apiClient.getFiles();
  return data;
};

export const Component = () => {
  const files = useLoaderData() as LoaderResponse;
  // const actionData = useActionData() as Action['response'];
  // const [filterValue, setFilterValue] = useState<string>('');
  // const [viewStyle, setViewStyle] = useState<ViewStyle>('list');
  // const [sort, setSort] = useState<Sort>('Last updated');
  const theme = useTheme();
  // const fetchers = useFetchers();
  const submit = useSubmit();
  const navigation = useNavigation();
  // const [activeShareMenuFileId, setActiveShareMenuFileId] = useState<string>('');
  const isDisabled = navigation.state !== 'idle';
  const { addGlobalSnackbar } = useGlobalSnackbar();

  // useEffect(() => {
  //   if (actionData && !actionData.ok) {
  //     addGlobalSnackbar('An error occurred. Try again.', { severity: 'error' });
  //   }
  // }, [actionData, addGlobalSnackbar]);

  return (
    <>
      <DashboardHeader
        title="My files"
        actions={
          <div style={{ display: 'flex', gap: theme.spacing(1) }}>
            <CreateButton />
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

      <FileList files={files} />
    </>
  );
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
