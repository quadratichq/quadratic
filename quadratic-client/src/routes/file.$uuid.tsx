import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { debugShowFileIO, debugShowMultiplayer } from '@/app/debugFlags';
import { loadAssets } from '@/app/gridGL/loadAssets';
import { thumbnail } from '@/app/gridGL/pixiApp/thumbnail';
import { isEmbed } from '@/app/helpers/isEmbed';
import initRustClient from '@/app/quadratic-rust-client/quadratic_rust_client';
import { VersionComparisonResult, compareVersions } from '@/app/schemas/compareVersions';
import { QuadraticApp } from '@/app/ui/QuadraticApp';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { initWorkers } from '@/app/web-workers/workers';
import { authClient, useCheckForAuthorizationTokenOnWindowFocus } from '@/auth/auth';
import { useRootRouteLoaderData } from '@/routes/_root';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL, SCHEDULE_MEETING } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { updateRecentFiles } from '@/shared/utils/updateRecentFiles';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import * as Sentry from '@sentry/react';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import {
  Link,
  LoaderFunctionArgs,
  Outlet,
  isRouteErrorResponse,
  redirect,
  useLoaderData,
  useRouteError,
} from 'react-router-dom';
import { MutableSnapshot, RecoilRoot } from 'recoil';
import { Empty } from '../dashboard/components/Empty';

type FileData = ApiTypes['/v0/files/:uuid.GET.response'];

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
    updateRecentFiles(uuid, '', false);
    throw new Response('Failed to load file from server.', { status: error.status });
  }
  if (debugShowMultiplayer || debugShowFileIO)
    console.log(
      `[File API] Received information for file ${uuid} with sequence_num ${data.file.lastCheckpointSequenceNumber}.`
    );

  // initialize all workers
  initWorkers();

  // initialize: Rust metadata and PIXI assets
  await Promise.all([initRustClient(), loadAssets()]);

  // initialize Core web worker
  const result = await quadraticCore.load({
    fileId: uuid,
    url: data.file.lastCheckpointDataUrl,
    version: data.file.lastCheckpointVersion,
    sequenceNumber: data.file.lastCheckpointSequenceNumber,
  });
  if (result.error) {
    Sentry.captureEvent({
      message: `Failed to deserialize file ${uuid} from server.`,
      extra: {
        error: result.error,
      },
    });
    updateRecentFiles(uuid, data.file.name, false);
    throw new Response('Failed to deserialize file from server.', { statusText: result.error });
  } else if (result.version) {
    // this should eventually be moved to Rust (too lazy now to find a Rust library that does the version string compare)
    if (compareVersions(result.version, data.file.lastCheckpointVersion) === VersionComparisonResult.LessThan) {
      Sentry.captureEvent({
        message: `User opened a file at version ${result.version} but the app is at version ${data.file.lastCheckpointVersion}. The app will automatically reload.`,
        level: 'log',
      });
      updateRecentFiles(uuid, data.file.name, false);
      // @ts-expect-error hard reload via `true` only works in some browsers
      window.location.reload(true);
    }
    if (!data.file.thumbnail && data.userMakingRequest.filePermissions.includes('FILE_EDIT')) {
      thumbnail.generateThumbnail();
    }
  } else {
    throw new Error('Expected quadraticCore.load to return either a version or an error');
  }
  updateRecentFiles(uuid, data.file.name, true);
  return data;
};

export const Component = () => {
  // Initialize recoil with the file's permission we get from the server
  const { loggedInUser } = useRootRouteLoaderData();
  const {
    userMakingRequest: { filePermissions },
    file: { uuid },
  } = useLoaderData() as FileData;
  const initializeState = ({ set }: MutableSnapshot) => {
    set(editorInteractionStateAtom, (prevState) => ({
      ...prevState,
      user: loggedInUser,
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
      <Outlet />
    </RecoilRoot>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  const actionsDefault = (
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

  const actionsLicenseRevoked = (
    <div className={`flex justify-center gap-2`}>
      <Button asChild variant="outline">
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">
          Contact Support
        </a>
      </Button>
      <Button asChild>
        <a href={SCHEDULE_MEETING} target="_blank" rel="noreferrer">
          Schedule Meeting
        </a>
      </Button>
    </div>
  );

  if (isRouteErrorResponse(error)) {
    let title = '';
    let description: string = '';
    let actions = actionsDefault;

    if (error.status === 404) {
      title = 'File not found';
      description = 'This file may have been moved or made unavailable. Try reaching out to the file owner.';
    } else if (error.status === 400) {
      title = 'Bad file request';
      description = 'Check the URL and try again.';
    } else if (error.status === 402) {
      title = 'License Revoked';
      description = 'Your license has been revoked. Please contact Quadratic Support.';
      actions = actionsLicenseRevoked;
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
    return (
      <Empty
        title={title}
        description={description}
        Icon={ExclamationTriangleIcon}
        actions={actions}
        showLoggedInUser
      />
    );
  }

  // If we reach here, it's an error we don't know how to handle.
  // TODO: probably log this to Sentry...
  console.error(error);
  return (
    <Empty
      title="Unexpected error"
      description="Something went wrong loading this file. If the error continues, contact us."
      Icon={ExclamationTriangleIcon}
      actions={actionsDefault}
      severity="error"
      showLoggedInUser
    />
  );
};
