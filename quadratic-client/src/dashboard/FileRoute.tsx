import { ApiError } from '@/api/fetchFromApi';
import { CONTACT_URL } from '@/constants/urls';
import { Button } from '@/shadcn/ui/button';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import * as Sentry from '@sentry/react';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ReactElement } from 'react';
import {
  Link,
  LoaderFunctionArgs,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
} from 'react-router-dom';
import { MutableSnapshot, RecoilRoot } from 'recoil';
import { apiClient } from '../api/apiClient';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { Empty } from '../components/Empty';
import { ROUTE_LOADER_IDS } from '../constants/routes';
import { grid } from '../grid/controller/Grid';
import init, { hello } from '../quadratic-core/quadratic_core';
import { VersionComparisonResult, compareVersions } from '../schemas/compareVersions';
import { validateAndUpgradeGridFile } from '../schemas/validateAndUpgradeGridFile';
import QuadraticApp from '../ui/QuadraticApp';

export type FileData = {
  name: string;
  uuid: string;
  sharing: ApiTypes['/v0/files/:uuid/sharing.GET.response'];
  permissions: ApiTypes['/v0/files/:uuid.GET.response']['user']['permissions'];
};

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<FileData> => {
  const { uuid } = params as { uuid: string };

  // Fetch the file & its sharing data
  const [data, sharing] = await Promise.all([apiClient.getFile(uuid), apiClient.getFileSharing(uuid)]);

  // Validate and upgrade file to the latest version in TS (up to 1.4)
  const file = await validateAndUpgradeGridFile(data.file.contents);
  if (!file) {
    Sentry.captureEvent({
      message: `Failed to validate and upgrade user file from database. It will likely have to be fixed manually. File UUID: ${uuid}`,
      level: 'error',
    });
    throw new Response('File validation failed.');
  }

  // load WASM
  await init();
  hello();
  grid.init();
  grid.openFromContents(file.contents);
  grid.thumbnailDirty = !data.file.thumbnail;

  // If the file is newer than the app, do a (hard) reload.
  const fileVersion = file.version;
  const gridVersion = grid.getVersion();
  if (compareVersions(fileVersion, gridVersion) === VersionComparisonResult.GreaterThan) {
    Sentry.captureEvent({
      message: `User opened a file at version ${fileVersion} but the app is at version ${gridVersion}. The app will automatically reload.`,
      level: 'log',
    });
    // @ts-expect-error hard reload via `true` only works in some browsers
    window.location.reload(true);
  }

  return {
    name: data.file.name,
    uuid: data.file.uuid,
    permissions: data.user.permissions,
    sharing,
  };
};

export const Component = () => {
  // Initialize recoil with the file's permission we get from the server
  const { permissions, uuid } = useLoaderData() as FileData;
  const initializeState = ({ set }: MutableSnapshot) => {
    set(editorInteractionStateAtom, (prevState) => ({
      ...prevState,
      uuid,
      permissions,
    }));
  };
  // multiplayer.enterFileRoom(uuid, user);

  return (
    <RecoilRoot initializeState={initializeState}>
      <QuadraticApp />
    </RecoilRoot>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  const actions = (
    <div className={`flex justify-center gap-2`}>
      <Button asChild variant="outline">
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">
          Get help
        </a>
      </Button>
      <Button asChild variant="default">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );

  // Handle specific errors

  let title = '';
  let description: string | ReactElement = '';

  if (error instanceof ApiError) {
    if (error.status === 404) {
      title = 'File not found';
      description = 'This file may have been deleted, moved, or made unavailable. Try reaching out to the file owner.';
    } else if (error.status >= 400 && error.status < 500) {
      title = 'Failed to retrieve file';
      description = (
        <>
          This file could not be loaded from the server. Additional details:
          <pre className="mt-4">{error.details}</pre>
        </>
      );
    }
  }

  if (isRouteErrorResponse(error)) {
    title = 'Failed to load file';
    description = (
      <>
        The file was retrieved from the server but could not be loaded. Additional details:
        <pre className="mt-4">{error.data}</pre>
      </>
    );
  }

  if (title && description) {
    return <Empty title={title} description={description} Icon={ExclamationTriangleIcon} actions={actions} />;
  }

  // If we reach here, it's an error we don't know how to handle.
  // TODO: probably log this to Sentry...
  console.error(error);
  return (
    <Empty
      title="Unexpected error"
      description="Something went wrong loading this file. If the error continues, contact us."
      Icon={ExclamationTriangleIcon}
      actions={actions}
      severity="error"
    />
  );
};

export const useFileRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.FILE) as FileData;
