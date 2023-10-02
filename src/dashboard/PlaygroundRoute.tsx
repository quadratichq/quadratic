import { ErrorOutline, QuestionMarkOutlined } from '@mui/icons-material';
import { Button } from '@mui/material';
import {
  Link,
  LoaderFunctionArgs,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
} from 'react-router-dom';
import { MutableSnapshot, RecoilRoot } from 'recoil';
import { DEFAULT_FILE } from '../api/apiClient';
import { ApiTypes } from '../api/types';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { Empty } from '../components/Empty';
import { ROUTE_LOADER_IDS } from '../constants/routes';
import { grid } from '../grid/controller/Grid';
import init, { hello } from '../quadratic-core/quadratic_core';
import QuadraticApp from '../ui/QuadraticApp';

export type FileData = {
  name: string;
  sharing: ApiTypes['/v0/files/:uuid/sharing.GET.response'];
  permission: ApiTypes['/v0/files/:uuid.GET.response']['permission'];
};

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<FileData> => {
  // load WASM
  await init();
  hello();
  grid.init();

  const file = DEFAULT_FILE;

  // attempt to load the sheet
  if (!grid.newFromFile(file)) {
    // Sentry.captureEvent({
    //   message: `Failed to validate and upgrade user file from database (to Rust). It will likely have to be fixed manually. File UUID: ${uuid}`,
    //   level: Sentry.Severity.Critical,
    // });
    // throw new Response('Invalid file that could not be upgraded by Rust.', { status: 400 });
  }
  console.log(file.sheets[0].name);

  return {
    name: 'TEST',
    permission: 'OWNER',
    sharing: {
      public_link_access: 'NOT_SHARED',
      owner: {
        name: 'TEST',
        picture: '',
      },
    },
  };
};

export const Component = () => {
  // Initialize recoil with the file's permission we get from the server
  const initialFileData = useLoaderData() as FileData;
  const initializeState = ({ set }: MutableSnapshot) => {
    set(editorInteractionStateAtom, (prevState) => ({
      ...prevState,
      permission: initialFileData.permission,
    }));
  };

  return (
    <RecoilRoot initializeState={initializeState}>
      <QuadraticApp initialFileData={initialFileData} />
    </RecoilRoot>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    console.error(error);
    // If the future, we can differentiate between the different kinds of file
    // loading errors and be as granular in the message as we like.
    // e.g. file found but didn't validate. file couldn't be found on server, etc.
    // But for now, we'll just show a 404
    return (
      <Empty
        title="404: file not found"
        description="This file may have been deleted, moved, or made unavailable. Try reaching out to the file owner."
        Icon={QuestionMarkOutlined}
        actions={
          <Button variant="contained" disableElevation component={Link} to="/">
            Go home
          </Button>
        }
      />
    );
  }

  // Maybe we log this to Sentry someday...
  console.error(error);
  return (
    <Empty
      title="Unexpected error"
      description="Something went wrong loading this file. If the error continues, contact us."
      Icon={ErrorOutline}
      actions={
        <Button variant="contained" disableElevation component={Link} to="/">
          Go home
        </Button>
      }
      severity="error"
    />
  );
};

export const useFileRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.FILE) as FileData;
