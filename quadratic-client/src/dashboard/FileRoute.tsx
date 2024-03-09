import { authClient, useCheckForAuthorizationTokenOnWindowFocus } from '@/auth';
import { CONTACT_URL } from '@/constants/urls';
import { debugShowMultiplayer } from '@/debugFlags';
import { loadAssets } from '@/gridGL/loadAssets';
import { isEmbed } from '@/helpers/isEmbed';
import { Button } from '@/shadcn/ui/button';
import { quadraticCore } from '@/web-workers/quadraticCore/quadraticCore';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import {
  Link,
  LoaderFunctionArgs,
  isRouteErrorResponse,
  redirect,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
} from 'react-router-dom';
import { MutableSnapshot, RecoilRoot } from 'recoil';
import { apiClient } from '../api/apiClient';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { Empty } from '../components/Empty';
import { ROUTES, ROUTE_LOADER_IDS } from '../constants/routes';
import QuadraticApp from '../ui/QuadraticApp';

export type FileData = ApiTypes['/v0/files/:uuid.GET.response'];

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<FileData | Response> => {
  const { uuid } = params as { uuid: string };

  // Fetch the file. If it fails because of permissions, redirect to login. Otherwise throw.
  let data;
  try {
    data = await apiClient.files.get(uuid);
  } catch (error: any) {
    const isLoggedIn = await authClient.isAuthenticated();
    if (error.status === 403 && !isLoggedIn) {
      return redirect(ROUTES.SIGNUP_WITH_REDIRECT());
    }
    throw new Response('Failed to load file from server.', { status: error.status });
  }
  if (debugShowMultiplayer)
    console.log(
      `[File API] Received information for file ${uuid} with sequence_num ${data.file.lastCheckpointSequenceNumber}.`
    );

  // initialize: Rust metadata and PIXI assets
  await loadAssets();

  // initialize Core web worker
  await quadraticCore.load(
    data.file.lastCheckpointDataUrl,
    data.file.lastCheckpointVersion,
    data.file.lastCheckpointSequenceNumber
  );

  // todo: these need to be handled as well...

  // grid.thumbnailDirty = !data.file.thumbnail && data.userMakingRequest.filePermissions.includes('FILE_EDIT');

  // // If the file is newer than the app, do a (hard) reload.
  // const gridVersion = grid.getVersion();
  // if (compareVersions(version, gridVersion) === VersionComparisonResult.GreaterThan) {
  //   Sentry.captureEvent({
  //     message: `User opened a file at version ${version} but the app is at version ${gridVersion}. The app will automatically reload.`,
  //     level: 'log',
  //   });
  //   // @ts-expect-error hard reload via `true` only works in some browsers
  //   window.location.reload(true);
  // }

  return data;
};

export const Component = () => {
  // Initialize recoil with the file's permission we get from the server
  const {
    userMakingRequest: { filePermissions },
    file: { uuid },
  } = useLoaderData() as FileData;
  const initializeState = ({ set }: MutableSnapshot) => {
    set(editorInteractionStateAtom, (prevState) => ({
      ...prevState,
      uuid,
      permissions: filePermissions,
    }));
  };

  // If this is an embed, ensure that wheel events do not scroll the page
  // otherwise we get weird double-scrolling on the iframe embed
  if (isEmbed) {
    document.querySelector('#root')?.addEventListener('wheel', (e) => e.preventDefault());
  }

  useCheckForAuthorizationTokenOnWindowFocus();

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

  if (isRouteErrorResponse(error)) {
    let title = '';
    let description: string = '';

    if (error.status === 404) {
      title = 'File not found';
      description = 'This file may have been moved or made unavailable. Try reaching out to the file owner.';
    } else if (error.status === 400) {
      title = 'Bad file request';
      description = 'Check the URL and try again.';
    } else if (error.status === 403) {
      title = 'Permission denied';
      description = 'You do not have permission to view this file. Try reaching out to the file owner.';
    } else if (error.status === 410) {
      title = 'File deleted';
      description = 'This file no longer exists. Try reaching out to the file owner.';
    } else if (error.status === 200) {
      title = 'File validation failed';
      description =
        'The file was retrieved from the server but failed to load into the app. Try again or contact us for help.';
    } else {
      title = 'Failed to load file';
      description = 'There was an error retrieving and loading this file.';
    }
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
