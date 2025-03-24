import { authClient } from '@/auth/auth';
import { Empty } from '@/dashboard/components/Empty';
import { getActionFileDownload, getActionFileDuplicate } from '@/routes/api.files.$uuid';
import { apiClient } from '@/shared/api/apiClient';
import { ChevronRightIcon, DraftIcon, ExternalLinkIcon, RefreshIcon } from '@/shared/components/Icons';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { CONTACT_URL, DOCUMENTATION_FILE_RECOVERY } from '@/shared/constants/urls';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useState } from 'react';
import {
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  useParams,
  useRevalidator,
  useRouteError,
  type LoaderFunctionArgs,
} from 'react-router-dom';

type LoaderData = ApiTypes['/v0/files/:uuid/checkpoints.GET.response'];

export const loader = async ({ params }: LoaderFunctionArgs): Promise<LoaderData | Response> => {
  const isLoggedIn = await authClient.isAuthenticated();
  if (!isLoggedIn) {
    return redirect(ROUTES.SIGNUP_WITH_REDIRECT());
  }

  const { uuid } = params as { uuid: string };
  const data = await apiClient.files.checkpoints.list(uuid);
  return data;
};

export const Component = () => {
  const { uuid } = useParams() as { uuid: string };
  const data = useLoaderData() as LoaderData;
  const revalidator = useRevalidator();
  const [activeCheckpointId, setActiveCheckpointId] = useState<number | null>(null);
  const activeCheckpoint = data.checkpoints.find((checkpoint) => checkpoint.id === activeCheckpointId);
  const iframeUrl = activeCheckpointId ? ROUTES.FILE(uuid) + `?checkpoint=${activeCheckpointId}&embed` : '';

  const checkpointsByDay = data.checkpoints.reduce((acc, version) => {
    const date = new Date(version.timestamp);
    const day = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    acc[day] = [...(acc[day] || []), version];
    return acc;
  }, {} as Record<string, LoaderData['checkpoints']>);

  const fetcher = useFetcher();
  const isLoading = fetcher.state !== 'idle' || revalidator.state === 'loading';
  const btnsDisabled = isLoading || !activeCheckpoint;

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
              onClick={() => {
                revalidator.revalidate();
              }}
              disabled={isLoading}
            >
              <RefreshIcon className={cn(isLoading && 'animate-spin opacity-50')} />
            </Button>
          </div>
          <h3 className="mr-auto text-lg font-semibold">Version history</h3>
          <p className="text-sm text-muted-foreground">
            Browse and recover file versions that’ve been automatically saved.{' '}
            <a href={DOCUMENTATION_FILE_RECOVERY} target="_blank" className="underline hover:text-primary">
              Learn more
              <ExternalLinkIcon className="relative top-0.5 ml-0.5 !text-xs" />
            </a>
          </p>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              disabled={btnsDisabled}
              onClick={() => {
                if (!activeCheckpoint) return;

                mixpanel.track('[FileVersionHistory].duplicateVersion', {
                  uuid,
                  checkpointId: activeCheckpoint.id,
                });
                const data = getActionFileDuplicate({
                  isPrivate: true,
                  redirect: true,
                  checkpointVersion: activeCheckpoint.version,
                  checkpointDataUrl: activeCheckpoint.dataUrl,
                });
                fetcher.submit(data, { method: 'POST', action: ROUTES.API.FILE(uuid), encType: 'application/json' });
              }}
            >
              Duplicate
            </Button>
            <Button
              variant="outline"
              disabled={btnsDisabled}
              onClick={() => {
                if (!activeCheckpoint) return;

                mixpanel.track('[FileVersionHistory].downloadVersion', {
                  uuid,
                  checkpointId: activeCheckpoint.id,
                });
                const data = getActionFileDownload({ checkpointDataUrl: activeCheckpoint.dataUrl });
                fetcher.submit(data, { method: 'POST', action: ROUTES.API.FILE(uuid), encType: 'application/json' });
              }}
            >
              Download
            </Button>
          </div>
          <Button variant="secondary" size="sm" asChild>
            <Link
              to={ROUTES.FILE(uuid)}
              target="_blank"
              className="group mt-2 flex w-full items-center gap-1 overflow-hidden !px-1 hover:text-primary"
              onClick={() => {
                mixpanel.track('[FileVersionHistory].openCurrentVersion', {
                  uuid,
                });
              }}
            >
              <DraftIcon />
              <span className="truncate">{data.name}</span>

              <ExternalLinkIcon className="ml-auto !text-sm text-muted-foreground opacity-70 group-hover:text-primary group-hover:opacity-100" />
            </Link>
          </Button>
        </div>
        <div className="h-full flex-col overflow-auto p-3">
          {Object.entries(checkpointsByDay).map(([day, checkpoints], groupIndex) => {
            return (
              <div key={day} className={cn(groupIndex !== 0 && 'mt-6')}>
                <Type variant="overline" className="mb-2">
                  {day}
                </Type>
                <ul className="flex-col gap-2 text-sm">
                  {checkpoints.map(({ timestamp, id }, checkpointIndex) => {
                    const label = new Date(timestamp).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                    });
                    const isSelected = activeCheckpointId === id;
                    const isCurrentVersion = groupIndex === 0 && checkpointIndex === 0;
                    return (
                      <li key={id} className="mb-0.5">
                        <button
                          disabled={isLoading}
                          className={cn(
                            'flex w-full items-center justify-between rounded px-2 py-2 ',
                            isSelected ? 'bg-accent' : 'hover:bg-accent',
                            isLoading && 'cursor-not-allowed'
                          )}
                          onClick={() => {
                            setActiveCheckpointId((prev) => (prev === id ? null : id));
                          }}
                        >
                          <span className="mr-auto">{label}</span>
                          {isCurrentVersion && (
                            <Badge variant="outline" className="mr-1">
                              Current version
                            </Badge>
                          )}
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
            Select a file version on the left to preview it…
          </p>
        )}
      </div>
    </div>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  return (
    <Empty
      title="Failed to load version history"
      description="An unexpected error occurred. Try reloading the page or contact us if the error continues."
      Icon={ExclamationTriangleIcon}
      severity="error"
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
