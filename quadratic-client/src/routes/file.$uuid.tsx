import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { debugFlag } from '@/app/debugFlags/debugFlags';
import { startupTimer } from '@/app/gridGL/helpers/startupTimer';
import { loadAssets } from '@/app/gridGL/loadAssets';
import { thumbnail } from '@/app/gridGL/pixiApp/thumbnail';
import { isEmbed } from '@/app/helpers/isEmbed';
import initCoreClient from '@/app/quadratic-core/quadratic_core';
import { VersionComparisonResult, compareVersions } from '@/app/schemas/compareVersions';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import { QuadraticApp } from '@/app/ui/QuadraticApp';
import { QuadraticAppDebugSettings } from '@/app/ui/QuadraticAppDebugSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { initWorkers } from '@/app/web-workers/workers';
import { authClient, useCheckForAuthorizationTokenOnWindowFocus } from '@/auth/auth';
import { useRootRouteLoaderData } from '@/routes/_root';
import { apiClient } from '@/shared/api/apiClient';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { UpgradeDialog } from '@/shared/components/UpgradeDialog';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import { CONTACT_URL, SCHEDULE_MEETING } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { registerEventAnalyticsData } from '@/shared/utils/analyticsEvents';
import { sendAnalyticsError } from '@/shared/utils/error';
import { handleSentryReplays } from '@/shared/utils/sentry';
import { updateRecentFiles } from '@/shared/utils/updateRecentFiles';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { captureEvent } from '@sentry/react';
import { FilePermissionSchema, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { memo, useCallback, useEffect } from 'react';
import type { LoaderFunctionArgs, ShouldRevalidateFunctionArgs } from 'react-router';
import { Link, Outlet, isRouteErrorResponse, redirect, useLoaderData, useParams, useRouteError } from 'react-router';
import type { MutableSnapshot } from 'recoil';
import { RecoilRoot } from 'recoil';

type FileData = ApiTypes['/v0/files/:uuid.GET.response'];

export const shouldRevalidate = ({ currentParams, nextParams }: ShouldRevalidateFunctionArgs) =>
  currentParams.uuid !== nextParams.uuid;

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<FileData | Response> => {
  startupTimer.start('file.loader');

  const loadPixi = async () => {
    startupTimer.start('file.loader.loadPixi');
    try {
      await loadAssets();
    } catch (error) {
      sendAnalyticsError('file.loader', 'loadPixi', error, 'Error loading pixi assets');
    }
    startupTimer.end('file.loader.loadPixi');
  };

  // load file information from the api
  const loadFileFromApi = async (uuid: string, isVersionHistoryPreview: boolean): Promise<FileData | Response> => {
    // Fetch the file. If it fails because of permissions, redirect to login. Otherwise throw.
    let data: ApiTypes['/v0/files/:uuid.GET.response'];
    try {
      startupTimer.start('file.loader.files.get');
      data = await apiClient.files.get(uuid);
      startupTimer.end('file.loader.files.get');
    } catch (error: any) {
      const isLoggedIn = await authClient.isAuthenticated();
      if (error.status === 403 && !isLoggedIn) {
        return redirect(ROUTES.LOGIN_WITH_REDIRECT(request.url));
      }
      if (!isVersionHistoryPreview) updateRecentFiles(uuid, '', false);
      throw new Response('Failed to load file from server.', { status: error.status });
    }
    if (debugFlag('debugShowMultiplayer') || debugFlag('debugShowFileIO'))
      console.log(
        `[File API] Received information for file ${uuid} with sequence_num ${data.file.lastCheckpointSequenceNumber}.`
      );
    return data;
  };

  // initialize the core module within client
  const initializeCoreClient = async () => {
    startupTimer.start('file.loader.initCoreClient');
    await initCoreClient();
    startupTimer.end('file.loader.initCoreClient');
  };

  const { uuid } = params as { uuid: string };

  // Figure out if we're loading a specific checkpoint (for version history)
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const checkpointId = searchParams.get(SEARCH_PARAMS.CHECKPOINT.KEY);
  const isVersionHistoryPreview = checkpointId !== null;

  const [data] = await Promise.all([
    loadFileFromApi(uuid, isVersionHistoryPreview),
    loadPixi(),
    initWorkers(),
    initializeCoreClient(),
  ]);

  // we were redirected to login, so we don't need to do anything else
  if (data instanceof Response) return data;

  // Load the latest checkpoint by default, but a specific one if we're in version history preview
  let checkpoint = {
    url: data.file.lastCheckpointDataUrl,
    version: data.file.lastCheckpointVersion,
    sequenceNumber: data.file.lastCheckpointSequenceNumber,
  };
  if (isVersionHistoryPreview) {
    const { dataUrl, version, sequenceNumber } = await apiClient.files.checkpoints.get(uuid, checkpointId);
    checkpoint.url = dataUrl;
    checkpoint.version = version;
    checkpoint.sequenceNumber = sequenceNumber;
  }

  // initialize Core web worker
  startupTimer.start('file.loader.quadraticCore.load');
  const result = await quadraticCore.load({
    fileId: uuid,
    teamUuid: data.team.uuid,
    url: checkpoint.url,
    version: checkpoint.version,
    sequenceNumber: checkpoint.sequenceNumber,
  });
  startupTimer.end('file.loader.quadraticCore.load');
  if (result.error) {
    if (!isVersionHistoryPreview) {
      captureEvent({
        message: `Failed to deserialize file ${uuid} from server.`,
        extra: {
          error: result.error,
        },
      });
      updateRecentFiles(uuid, data.file.name, false);
    }
    throw new Response('Failed to deserialize file from server.', { statusText: result.error });
  } else if (result.version) {
    // this should eventually be moved to Rust (too lazy now to find a Rust library that does the version string compare)
    if (compareVersions(result.version, data.file.lastCheckpointVersion) === VersionComparisonResult.LessThan) {
      if (!isVersionHistoryPreview) {
        captureEvent({
          message: `User opened a file at version ${result.version} but the app is at version ${data.file.lastCheckpointVersion}. The app will automatically reload.`,
          level: 'log',
        });
        updateRecentFiles(uuid, data.file.name, false);
      }
      // @ts-expect-error hard reload via `true` only works in some browsers
      window.location.reload(true);
    }

    if (
      !isVersionHistoryPreview &&
      !data.file.thumbnail &&
      data.userMakingRequest.filePermissions.includes('FILE_EDIT')
    ) {
      thumbnail.setThumbnailDirty();
    }
  } else {
    throw new Error('Expected quadraticCore.load to return either a version or an error');
  }

  if (!isVersionHistoryPreview) updateRecentFiles(uuid, data.file.name, true);

  // Hot-modify permissions if its the version history, so it's read-only
  if (isVersionHistoryPreview) {
    data.userMakingRequest.filePermissions = [FilePermissionSchema.enum.FILE_VIEW];
  }

  registerEventAnalyticsData({ isOnPaidPlan: data.team.isOnPaidPlan });

  handleSentryReplays(data.team.settings.analyticsAi);

  startupTimer.end('file.loader');
  return data;
};

export const Component = memo(() => {
  // Initialize recoil with the file's permission we get from the server
  const { loggedInUser } = useRootRouteLoaderData();
  const {
    file: { uuid: fileUuid },
    team: { uuid: teamUuid, isOnPaidPlan, settings: teamSettings },
    userMakingRequest: { filePermissions },
  } = useLoaderData() as FileData;
  const initializeState = useCallback(
    ({ set }: MutableSnapshot) => {
      set(editorInteractionStateAtom, (prevState) => ({
        ...prevState,
        permissions: filePermissions,
        settings: teamSettings,
        user: loggedInUser,
        fileUuid,
        teamUuid,
      }));
    },
    [filePermissions, fileUuid, loggedInUser, teamSettings, teamUuid]
  );

  const { setIsOnPaidPlan } = useIsOnPaidPlan();
  useEffect(() => {
    setIsOnPaidPlan(isOnPaidPlan);
  }, [isOnPaidPlan, setIsOnPaidPlan]);

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
      <QuadraticAppDebugSettings />
      <UpgradeDialog teamUuid={teamUuid} />
    </RecoilRoot>
  );
});

export const ErrorBoundary = () => {
  const error = useRouteError();
  const { uuid } = useParams() as { uuid: string };

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

  const actionsFileFailedToLoad = (
    <div className={`flex justify-center gap-2`}>
      <Button asChild variant="outline">
        <Link to="/">Go home</Link>
      </Button>
      <Button asChild variant="default">
        <Link to={ROUTES.FILE_HISTORY(uuid)} reloadDocument>
          Open history
        </Link>
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
    let reportError = false;

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
      actions = actionsFileFailedToLoad;
      reportError = true;
    } else {
      title = 'Failed to load file';
      description = 'There was an error retrieving and loading this file.';
      reportError = true;
    }
    return (
      <EmptyPage
        title={title}
        description={description}
        Icon={ExclamationTriangleIcon}
        actions={actions}
        error={reportError ? error : undefined}
      />
    );
  }

  // If we reach here, it's an error we don't know how to handle.
  console.error(error);
  return (
    <EmptyPage
      title="Unexpected error"
      description="Something went wrong loading this file. If the error continues, contact us."
      Icon={ExclamationTriangleIcon}
      actions={actionsDefault}
      error={error}
    />
  );
};
