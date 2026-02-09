import { requireAuth } from '@/auth/auth';
import { getActionFileDownload, getActionFileDuplicate } from '@/routes/api.files.$uuid';
import { apiClient } from '@/shared/api/apiClient';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { ChevronRightIcon, RefreshIcon } from '@/shared/components/Icons';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { Type } from '@/shared/components/Type';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useCallback, useMemo, useState } from 'react';
import {
  Link,
  useFetcher,
  useLoaderData,
  useParams,
  useRevalidator,
  useRouteError,
  type LoaderFunctionArgs,
} from 'react-router';

type LoaderData = ApiTypes['/v0/files/:uuid/checkpoints.GET.response'] & {
  activeTeamUuid: string;
};

export const loader = async (loaderArgs: LoaderFunctionArgs): Promise<LoaderData> => {
  const { activeTeamUuid } = await requireAuth(loaderArgs.request);
  const { params } = loaderArgs;
  const { uuid } = params as { uuid: string };
  const checkpointsData = await apiClient.files.checkpoints.list(uuid);

  return { ...checkpointsData, activeTeamUuid };
};

export const Component = () => {
  const { uuid } = useParams() as { uuid: string };
  const data = useLoaderData() as LoaderData;
  const revalidator = useRevalidator();
  const [activeSequenceNum, setActiveSequenceNum] = useState<number | null>(null);

  const activeCheckpoint = useMemo(
    () => data.checkpoints.find((checkpoint) => checkpoint.sequenceNumber === activeSequenceNum),
    [activeSequenceNum, data.checkpoints]
  );

  const iframeUrl = useMemo(
    () =>
      activeSequenceNum !== null
        ? ROUTES.FILE({ uuid, searchParams: `${SEARCH_PARAMS.SEQUENCE_NUM.KEY}=${activeSequenceNum}&embed&noAi` })
        : '',
    [activeSequenceNum, uuid]
  );

  const teamUuid = useMemo(() => data.team.uuid, [data.team.uuid]);

  const checkpointsByDay = useMemo(
    () =>
      data.checkpoints.reduce(
        (acc, version) => {
          const date = new Date(version.timestamp);
          const day = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          acc[day] = [...(acc[day] || []), version];
          return acc;
        },
        {} as Record<string, LoaderData['checkpoints']>
      ),
    [data.checkpoints]
  );

  const fetcher = useFetcher();
  const isLoading = useMemo(
    () => fetcher.state !== 'idle' || revalidator.state === 'loading',
    [fetcher.state, revalidator.state]
  );
  const btnsDisabled = useMemo(() => isLoading || !activeCheckpoint, [activeCheckpoint, isLoading]);

  const handleDuplicateVersion = useCallback(() => {
    if (!activeCheckpoint || !teamUuid) return;

    trackEvent('[FileVersionHistory].duplicateVersion', {
      uuid,
      sequenceNumber: activeCheckpoint.sequenceNumber,
    });

    const duplicateAction = getActionFileDuplicate({
      teamUuid,
      isPrivate: true,
      redirect: true,
      checkpointVersion: activeCheckpoint.version,
      checkpointDataUrl: activeCheckpoint.dataUrl,
    });

    fetcher.submit(duplicateAction, {
      method: 'POST',
      action: ROUTES.API.FILE(uuid),
      encType: 'application/json',
    });
  }, [activeCheckpoint, fetcher, teamUuid, uuid]);

  const handleDownload = useCallback(() => {
    if (!activeCheckpoint) return;

    trackEvent('[FileVersionHistory].downloadVersion', {
      uuid,
      sequenceNumber: activeCheckpoint.sequenceNumber,
    });

    const data = getActionFileDownload({ checkpointDataUrl: activeCheckpoint.dataUrl });

    fetcher.submit(data, { method: 'POST', action: ROUTES.API.FILE(uuid), encType: 'application/json' });
  }, [activeCheckpoint, fetcher, uuid]);

  useRemoveInitialLoadingUI();

  return (
    <div className="grid h-full w-full grid-cols-[300px_1fr] overflow-hidden">
      <div className="grid grid-rows-[auto_1fr] overflow-hidden border-r border-border">
        <div className="overflow-hidden border-b border-border p-3">
          <div className="mb-1 flex items-center justify-between">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/"
                    className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-border"
                  >
                    <QuadraticLogo />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Go to dashboard</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={revalidator.revalidate}
              disabled={isLoading}
            >
              <RefreshIcon className={cn(isLoading && 'animate-spin opacity-50')} />
            </Button>
          </div>
          <h3 className="mr-auto text-lg font-semibold">File history</h3>
          <p className="text-sm text-muted-foreground">
            Files are saved automatically as you work so you can recover previous versions.
          </p>

          <div className="mt-2 flex items-center gap-2">
            <Button disabled={btnsDisabled} className="flex-grow" onClick={handleDuplicateVersion}>
              Duplicate version
            </Button>
            <Button variant="outline" disabled={btnsDisabled} onClick={handleDownload}>
              Download
            </Button>
          </div>
        </div>

        <div className="h-full flex-col overflow-auto p-3">
          {Object.entries(checkpointsByDay).map(([day, checkpoints], groupIndex) => {
            return (
              <div key={day} className={cn(groupIndex !== 0 && 'mt-6')}>
                <Type variant="overline" className="mb-2">
                  {day}
                </Type>
                <ul className="flex-col gap-2 text-sm">
                  {checkpoints.map(({ timestamp, sequenceNumber }, checkpointIndex) => {
                    const label = new Date(timestamp).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    });
                    const isSelected = activeSequenceNum === sequenceNumber;
                    const isCurrentVersion = groupIndex === 0 && checkpointIndex === 0;
                    return (
                      <li key={sequenceNumber} className="mb-0.5">
                        <button
                          disabled={isLoading}
                          className={cn(
                            'flex w-full items-center justify-between rounded px-2 py-2',
                            isSelected ? 'bg-primary text-background' : 'hover:bg-accent',
                            isLoading && 'cursor-not-allowed'
                          )}
                          onClick={() => {
                            setActiveSequenceNum((prev) => (prev === sequenceNumber ? null : sequenceNumber));
                          }}
                        >
                          <span className="mr-auto">{label}</span>
                          {isCurrentVersion && <span className="mr-1 opacity-60">Latest</span>}
                          <ChevronRightIcon className={cn(isSelected ? 'opacity-100' : 'opacity-30')} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-full w-full">
        {iframeUrl ? (
          <iframe src={iframeUrl} title="App" className="h-full w-full" />
        ) : (
          <p className="flex h-full w-full flex-col items-center justify-center text-sm text-muted-foreground">
            Select a file version on the left to preview it.
          </p>
        )}
      </div>
    </div>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  return (
    <EmptyPage
      title="Failed to load version history"
      description="An unexpected error occurred. Try reloading the page or contact us if the error continues."
      Icon={ExclamationTriangleIcon}
      error={error}
      actions={
        <div className="flex justify-center gap-2">
          <Button variant="outline" asChild>
            <Link to={CONTACT_URL} target="_blank">
              Contact us
            </Link>
          </Button>
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
        </div>
      }
    />
  );
};
