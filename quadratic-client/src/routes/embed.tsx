import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { debugFlag } from '@/app/debugFlags/debugFlags';
import { EmbedApp } from '@/app/embed/EmbedApp';
import { startupTimer } from '@/app/gridGL/helpers/startupTimer';
import { loadAssets } from '@/app/gridGL/loadAssets';
import initCoreClient from '@/app/quadratic-core/quadratic_core';
import { VersionComparisonResult, compareVersions } from '@/app/schemas/compareVersions';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { initWorkers } from '@/app/web-workers/workers';
import { apiClient } from '@/shared/api/apiClient';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { CONTACT_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { sendAnalyticsError } from '@/shared/utils/error';
import { ExclamationTriangleIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { captureEvent } from '@sentry/react';
import { FilePermissionSchema, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { memo, useCallback, useEffect, useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, isRouteErrorResponse, useLoaderData, useRouteError } from 'react-router';
import type { MutableSnapshot } from 'recoil';
import { RecoilRoot } from 'recoil';

type EmbedLoaderData =
  | { mode: 'file'; fileData: ApiTypes['/v0/files/:uuid.GET.response'] }
  | { mode: 'import'; importUrl: string };

export const shouldRevalidate = () => false;

export const loader = async ({ request }: LoaderFunctionArgs): Promise<EmbedLoaderData | Response> => {
  startupTimer.start('file.loader');

  const url = new URL(request.url);
  const fileId = url.searchParams.get('fileId');
  const importUrl = url.searchParams.get('import');

  if (!fileId && !importUrl) {
    throw new Response('Missing fileId or import parameter', { status: 400 });
  }

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
  await Promise.all([loadPixi(), initWorkers(), initializeCoreClient()]);

  if (fileId) {
    // Load existing file from API
    let data: ApiTypes['/v0/files/:uuid.GET.response'];
    try {
      startupTimer.start('file.loader.files.get');
      data = await apiClient.files.get(fileId);
      startupTimer.end('file.loader.files.get');
    } catch (error: any) {
      // In embed mode, don't redirect to login - just show permission error
      if (error.status === 403) {
        throw new Response('Permission denied. This file may not be publicly accessible.', { status: 403 });
      }
      throw new Response('Failed to load file from server.', { status: error.status });
    }

    if (debugFlag('debugShowMultiplayer') || debugFlag('debugShowFileIO')) {
      console.log(
        `[Embed API] Received information for file ${fileId} with sequence_num ${data.file.lastCheckpointSequenceNumber}.`
      );
    }

    // Load the file into core
    startupTimer.start('file.loader.quadraticCore.load');
    const result = await quadraticCore.load({
      fileId,
      teamUuid: data.team.uuid,
      url: data.file.lastCheckpointDataUrl,
      version: data.file.lastCheckpointVersion,
      sequenceNumber: data.file.lastCheckpointSequenceNumber,
      noMultiplayer: true, // Always true for embed
    });
    startupTimer.end('file.loader.quadraticCore.load');

    if (result.error) {
      captureEvent({
        message: `[Embed] Failed to deserialize file ${fileId} from server.`,
        extra: { error: result.error },
      });
      throw new Response('Failed to deserialize file from server.', { statusText: result.error });
    } else if (result.version) {
      if (compareVersions(result.version, data.file.lastCheckpointVersion) === VersionComparisonResult.LessThan) {
        captureEvent({
          message: `[Embed] User opened a file at version ${result.version} but the app is at version ${data.file.lastCheckpointVersion}. The app will automatically reload.`,
          level: 'log',
        });
        // @ts-expect-error hard reload via `true` only works in some browsers
        window.location.reload(true);
      }
    } else {
      throw new Error('Expected quadraticCore.load to return either a version or an error');
    }

    // In embed mode, always allow editing since changes are local only
    if (!data.userMakingRequest.filePermissions.includes(FilePermissionSchema.enum.FILE_EDIT)) {
      data.userMakingRequest.filePermissions = [
        ...data.userMakingRequest.filePermissions,
        FilePermissionSchema.enum.FILE_EDIT,
      ];
    }

    startupTimer.end('file.loader');
    return { mode: 'file', fileData: data };
  }

  if (importUrl) {
    startupTimer.end('file.loader');
    return { mode: 'import', importUrl };
  }

  throw new Response('Invalid request', { status: 400 });
};

/**
 * Placeholder button to open the file in the full Quadratic app.
 * Currently non-functional - will be implemented in a future update.
 */
const EditInQuadraticButton = () => {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        variant="default"
        size="sm"
        className="gap-2 shadow-lg"
        onClick={() => {
          // TODO: Implement - will open the file in the full Quadratic app
          console.log('Edit in Quadratic - to be implemented');
        }}
      >
        <ExternalLinkIcon />
        Edit in Quadratic
      </Button>
    </div>
  );
};

export const Component = memo(() => {
  const loaderData = useLoaderData() as EmbedLoaderData;
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Handle import mode - fetch file from URL and import
  useEffect(() => {
    if (loaderData.mode === 'import') {
      const importFromUrl = async () => {
        setIsImporting(true);
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

          if (fileType === 'Grid') {
            // For grid files, use upgradeGridFile
            const result = await quadraticCore.upgradeGridFile(arrayBuffer, 0);
            if (result?.error) {
              throw new Error(result.error);
            }
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
          }
        } catch (error) {
          console.error('Import error:', error);
          setImportError(error instanceof Error ? error.message : 'Failed to import file');
        } finally {
          setIsImporting(false);
        }
      };

      importFromUrl();
    }
  }, [loaderData]);

  // For file mode, use the file data
  const fileData = loaderData.mode === 'file' ? loaderData.fileData : null;

  const initializeState = useCallback(
    ({ set }: MutableSnapshot) => {
      // In embed mode, user is always anonymous (undefined)
      if (fileData) {
        set(editorInteractionStateAtom, (prevState) => ({
          ...prevState,
          permissions: fileData.userMakingRequest.filePermissions,
          settings: fileData.team.settings,
          user: undefined, // Anonymous in embed mode
          fileUuid: fileData.file.uuid,
          teamUuid: fileData.team.uuid,
        }));
      } else {
        // For import mode, set minimal permissions (edit allowed since local only)
        set(editorInteractionStateAtom, (prevState) => ({
          ...prevState,
          permissions: [FilePermissionSchema.enum.FILE_VIEW, FilePermissionSchema.enum.FILE_EDIT],
          user: undefined, // Anonymous in embed mode
        }));
      }
    },
    [fileData]
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
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-lg">Importing file...</div>
        </div>
      </div>
    );
  }

  return (
    <RecoilRoot initializeState={initializeState}>
      <EmbedApp />
      <EditInQuadraticButton />
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
      description = 'Missing required fileId or import parameter.';
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
