import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { debugFlag } from '@/app/debugFlags/debugFlags';
import { EmbedApp } from '@/app/embed/EmbedApp';
import { events } from '@/app/events/events';
import { startupTimer } from '@/app/gridGL/helpers/startupTimer';
import { loadAssets } from '@/app/gridGL/loadAssets';
import { isReadonly } from '@/app/helpers/isEmbed';
import initCoreClient, { createBlankFile, getCurrentFileVersion } from '@/app/quadratic-core/quadratic_core';
import { VersionComparisonResult, compareVersions } from '@/app/schemas/compareVersions';
import type { CoreClientImportProgress } from '@/app/web-workers/quadraticCore/coreClientMessages';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { initWorkers } from '@/app/web-workers/workers';
import { apiClient } from '@/shared/api/apiClient';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Progress } from '@/shared/shadcn/ui/progress';
import { sendAnalyticsError } from '@/shared/utils/error';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { captureEvent } from '@sentry/react';
import { FilePermissionSchema, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router';
import type { MutableSnapshot } from 'recoil';
import { RecoilRoot } from 'recoil';

type EmbedLoaderData =
  | { mode: 'embed'; embedData: ApiTypes['/v0/embeds/:uuid.GET.response'] }
  | { mode: 'import'; importUrl: string }
  | { mode: 'blank' };

export const shouldRevalidate = () => false;

export const loader = async ({ request }: LoaderFunctionArgs): Promise<EmbedLoaderData | Response> => {
  startupTimer.start('file.loader');

  const url = new URL(request.url);
  // Make embedId and import parameters case-insensitive
  let embedId: string | null = null;
  let importUrl: string | null = null;
  for (const [key, value] of url.searchParams.entries()) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'embedid') {
      embedId = value;
    } else if (lowerKey === 'import') {
      importUrl = value;
    }
  }

  // Parse preload parameter to determine which workers to preload
  const preloadParam = url.searchParams.get('preload');
  const preloadWorkers = preloadParam ? preloadParam.split(',').map((s) => s.trim().toLowerCase()) : [];
  const shouldPreloadPython = preloadWorkers.includes('python');
  const shouldPreloadJS = preloadWorkers.includes('js');

  const loadPixi = async () => {
    startupTimer.start('file.loader.loadPixi');
    try {
      await loadAssets();
    } catch (error) {
      sendAnalyticsError('embed.loader', 'loadPixi', error, 'Error loading pixi assets');
    }
    startupTimer.end('file.loader.loadPixi');
  };

  const initializeCoreClient = async () => {
    startupTimer.start('file.loader.initCoreClient');
    await initCoreClient();
    startupTimer.end('file.loader.initCoreClient');
  };

  // Initialize everything in parallel
  await Promise.all([
    loadPixi(),
    initWorkers({ preloadPython: shouldPreloadPython, preloadJavascript: shouldPreloadJS }),
    initializeCoreClient(),
  ]);

  if (embedId) {
    // Load file via embed API (does not expose the file UUID)
    let data: ApiTypes['/v0/embeds/:uuid.GET.response'];
    try {
      startupTimer.start('file.loader.embeds.get');
      data = await apiClient.embeds.get(embedId);
      startupTimer.end('file.loader.embeds.get');
    } catch (error: unknown) {
      const status = error instanceof Error && 'status' in error ? (error as { status: number }).status : 500;
      if (status === 403) {
        throw new Response('Permission denied. This file may not be publicly accessible.', { status: 403 });
      }
      throw new Response('Failed to load file from server.', { status });
    }

    if (debugFlag('debugShowMultiplayer') || debugFlag('debugShowFileIO')) {
      console.log(`[Embed API] Received embed ${embedId} with sequence_num ${data.file.lastCheckpointSequenceNumber}.`);
    }

    // Use random UUIDs since the real file/team UUIDs are not exposed
    const internalFileId = crypto.randomUUID();
    const internalTeamUuid = crypto.randomUUID();

    // Load the file into core
    startupTimer.start('file.loader.quadraticCore.load');
    const result = await quadraticCore.load({
      fileId: internalFileId,
      teamUuid: internalTeamUuid,
      url: data.file.lastCheckpointDataUrl,
      version: data.file.lastCheckpointVersion,
      sequenceNumber: data.file.lastCheckpointSequenceNumber,
      noMultiplayer: true,
    });
    startupTimer.end('file.loader.quadraticCore.load');

    if (result.error) {
      captureEvent({
        message: `[Embed] Failed to deserialize embed ${embedId} from server.`,
        extra: { error: result.error },
      });
      throw new Response('Failed to deserialize file from server.', { statusText: result.error });
    } else if (result.version) {
      if (compareVersions(result.version, data.file.lastCheckpointVersion) === VersionComparisonResult.LessThan) {
        captureEvent({
          message: `[Embed] User opened an embed at version ${result.version} but the app is at version ${data.file.lastCheckpointVersion}. The app will automatically reload.`,
          level: 'log',
        });
        // @ts-expect-error hard reload via `true` only works in some browsers
        window.location.reload(true);
      }
    } else {
      throw new Error('Expected quadraticCore.load to return either a version or an error');
    }

    // In embed mode, allow editing since changes are local only (unless readonly is set)
    const isReadonlyParam = url.searchParams.get('readonly') !== null;
    if (isReadonlyParam) {
      data.userMakingRequest.filePermissions = data.userMakingRequest.filePermissions.filter(
        (p) => p !== FilePermissionSchema.enum.FILE_EDIT
      );
    }

    startupTimer.end('file.loader');
    return { mode: 'embed', embedData: data };
  }

  // Import URL is not validated (e.g. we allow http/localhost). This supports local dev
  // and keeps behavior simple; a page that can set the embed URL could fetch any URL directly anyway.
  if (importUrl) {
    startupTimer.end('file.loader');
    return { mode: 'import', importUrl };
  }

  // Blank mode - create a new blank file
  const blankFileContents = createBlankFile();
  const blankVersion = getCurrentFileVersion();

  // Create a blob URL from the blank file contents
  // Copy to a new ArrayBuffer to ensure compatibility with Blob
  const contentsArray = new Uint8Array(blankFileContents);
  const buffer = new ArrayBuffer(contentsArray.length);
  new Uint8Array(buffer).set(contentsArray);
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const blobUrl = URL.createObjectURL(blob);

  try {
    startupTimer.start('file.loader.quadraticCore.load');
    const result = await quadraticCore.load({
      fileId: crypto.randomUUID(),
      teamUuid: crypto.randomUUID(),
      url: blobUrl,
      version: blankVersion,
      sequenceNumber: 0,
      noMultiplayer: true,
    });
    startupTimer.end('file.loader.quadraticCore.load');

    if (result.error) {
      captureEvent({
        message: '[Embed] Failed to create blank file.',
        extra: { error: result.error },
      });
      throw new Response('Failed to create blank file.', { statusText: result.error });
    }
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  startupTimer.end('file.loader');
  return { mode: 'blank' };
};

export const Component = memo(() => {
  const loaderData = useLoaderData() as EmbedLoaderData;
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(loaderData.mode === 'import');
  const [importProgress, setImportProgress] = useState(0);
  const [importFileName, setImportFileName] = useState('');
  const importStartedRef = useRef(false);

  // Remove the initial HTML loading UI only after import is complete
  useRemoveInitialLoadingUI(isImporting);

  // Handle import mode - fetch file from URL and import
  useEffect(() => {
    if (loaderData.mode === 'import' && !importStartedRef.current) {
      importStartedRef.current = true;
      const handleImportProgress = (message: CoreClientImportProgress) => {
        const progress = Math.round((message.current / message.total) * 100);
        setImportProgress(progress);
      };

      const importFromUrl = async () => {
        setIsImporting(true);
        setImportProgress(0);

        // Subscribe to import progress events
        events.on('importProgress', handleImportProgress);

        try {
          const response = await fetch(loaderData.importUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();

          // Determine file type from URL
          const urlPath = new URL(loaderData.importUrl).pathname;
          const extension = urlPath.split('.').pop()?.toLowerCase();
          let fileType: 'CSV' | 'Excel' | 'Parquet' | 'Grid';

          switch (extension) {
            case 'csv':
              fileType = 'CSV';
              break;
            case 'xlsx':
            case 'xls':
              fileType = 'Excel';
              break;
            case 'parquet':
              fileType = 'Parquet';
              break;
            case 'grid':
              fileType = 'Grid';
              break;
            default:
              throw new Error(`Unsupported file type: ${extension}`);
          }

          const fileName = urlPath.split('/').pop() || 'imported_file';
          setImportFileName(fileName);

          let gridContents: ArrayBufferLike | undefined;
          let gridVersion: string | undefined;

          if (fileType === 'Grid') {
            // For grid files, use upgradeGridFile
            const result = await quadraticCore.upgradeGridFile(arrayBuffer, 0);
            if (result?.error) {
              throw new Error(result.error);
            }
            gridContents = result?.contents;
            gridVersion = result?.version;
          } else {
            // For other file types, use importFile
            const result = await quadraticCore.importFile({
              file: arrayBuffer,
              fileName,
              fileType,
              isAi: false,
            });
            if (result?.error) {
              throw new Error(result.error);
            }
            gridContents = result?.contents;
            gridVersion = result?.version;
          }

          // Now load the imported contents into the grid controller
          if (!gridContents || !gridVersion) {
            throw new Error('Import did not return file contents');
          }

          // Create a blob URL from the imported contents
          // Copy to a new ArrayBuffer to ensure compatibility with Blob
          const contentsArray = new Uint8Array(gridContents);
          const buffer = new ArrayBuffer(contentsArray.length);
          new Uint8Array(buffer).set(contentsArray);
          const blob = new Blob([buffer], { type: 'application/octet-stream' });
          const blobUrl = URL.createObjectURL(blob);

          // Set up listener for sheetsInfo BEFORE calling load to avoid race condition
          const sheetsInitialized = new Promise<void>((resolve) => {
            const handleSheetsInfo = () => {
              events.off('sheetsInfo', handleSheetsInfo);
              resolve();
            };
            events.on('sheetsInfo', handleSheetsInfo);
          });

          try {
            // Load the file into the grid controller
            const loadResult = await quadraticCore.load({
              fileId: crypto.randomUUID(),
              teamUuid: crypto.randomUUID(),
              url: blobUrl,
              version: gridVersion,
              sequenceNumber: 0,
              noMultiplayer: true,
            });

            if (loadResult.error) {
              throw new Error(loadResult.error);
            }

            // Wait for sheets to be fully initialized before proceeding
            await sheetsInitialized;
          } finally {
            // Clean up the blob URL
            URL.revokeObjectURL(blobUrl);
          }
        } catch (error) {
          console.error('Import error:', error);
          setImportError(error instanceof Error ? error.message : 'Failed to import file');
        } finally {
          // Unsubscribe from import progress events
          events.off('importProgress', handleImportProgress);
          setIsImporting(false);
        }
      };

      importFromUrl();
    }
  }, [loaderData]);

  // For embed mode, use the embed data
  const embedData = loaderData.mode === 'embed' ? loaderData.embedData : null;

  const initializeState = useCallback(
    ({ set }: MutableSnapshot) => {
      // In embed mode, user is always anonymous (undefined)
      if (embedData) {
        set(editorInteractionStateAtom, (prevState) => ({
          ...prevState,
          permissions: embedData.userMakingRequest.filePermissions,
          settings: embedData.team.settings,
          user: undefined,
          fileUuid: crypto.randomUUID(),
          teamUuid: crypto.randomUUID(),
        }));
      } else {
        // For import and blank modes, set minimal permissions (edit allowed since local only, unless readonly)
        const permissions = isReadonly
          ? [FilePermissionSchema.enum.FILE_VIEW]
          : [FilePermissionSchema.enum.FILE_VIEW, FilePermissionSchema.enum.FILE_EDIT];
        set(editorInteractionStateAtom, (prevState) => ({
          ...prevState,
          permissions,
          user: undefined,
          fileUuid: crypto.randomUUID(),
          teamUuid: crypto.randomUUID(),
        }));
      }
    },
    [embedData]
  );

  // Prevent wheel events from scrolling the parent page (iframe embed)
  useEffect(() => {
    const root = document.querySelector('#root');
    if (root) {
      root.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    }
  }, []);

  if (importError) {
    return (
      <EmptyPage
        title="Import failed"
        description={importError}
        Icon={ExclamationTriangleIcon}
        actions={
          <Button asChild variant="outline">
            <a href={CONTACT_URL} target="_blank" rel="noreferrer">
              Get help
            </a>
          </Button>
        }
      />
    );
  }

  if (isImporting) {
    // Show import status below the existing HTML loading logo (which is centered)
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        {/* Import status positioned below the centered loading logo */}
        <div className="mt-56 flex w-80 flex-col items-center text-center">
          <div className="mb-2 text-lg font-medium">Importing</div>
          {importFileName && (
            <div className="mb-4 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-muted-foreground">
              {importFileName}
            </div>
          )}
          <Progress value={importProgress} className="h-2 w-full" />
        </div>
      </div>
    );
  }

  return (
    <RecoilRoot initializeState={initializeState}>
      <EmbedApp />
    </RecoilRoot>
  );
});

export const ErrorBoundary = () => {
  const error = useRouteError();

  const actionsDefault = (
    <div className="flex justify-center gap-2">
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
    let description = '';

    if (error.status === 404) {
      title = 'File not found';
      description = 'This file may have been moved or made unavailable.';
    } else if (error.status === 400) {
      title = 'Bad request';
      description = 'Invalid request parameters.';
    } else if (error.status === 403) {
      title = 'Permission denied';
      description = 'You do not have permission to view this file.';
    } else if (error.status === 410) {
      title = 'File deleted';
      description = 'This file no longer exists.';
    } else {
      title = 'Failed to load';
      description = 'There was an error loading the embed.';
    }

    return (
      <EmptyPage title={title} description={description} Icon={ExclamationTriangleIcon} actions={actionsDefault} />
    );
  }

  console.error(error);
  return (
    <EmptyPage
      title="Unexpected error"
      description="Something went wrong. If the error continues, contact us."
      Icon={ExclamationTriangleIcon}
      actions={actionsDefault}
      error={error}
    />
  );
};
