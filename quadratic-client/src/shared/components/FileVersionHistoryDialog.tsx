import { getActionFileDownload, getActionFileDuplicate } from '@/routes/api.files.$uuid';
import { apiClient } from '@/shared/api/apiClient';
import { DownloadIcon, ExternalLinkIcon, FileCopyIcon, SpinnerIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTE_LOADER_IDS, ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_FILE_RECOVERY } from '@/shared/constants/urls';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useEffect, useState } from 'react';
import { useFetcher, useMatches } from 'react-router-dom';

const FileVersionHistoryDialog = ({ uuid, onClose }: { uuid: string; onClose: () => void }) => {
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error' | 'loaded'>('idle');
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<ApiTypes['/v0/files/:uuid/checkpoints.GET.response'] | undefined>();
  const versions = data?.checkpoints ?? [];
  const matches = useMatches();
  const isTeamFilesRoute = matches.filter((match) => match.id === ROUTE_LOADER_IDS.TEAM_FILES).length > 0;

  useEffect(() => {
    // Load the data once on mount
    if (loadState === 'idle') {
      setLoadState('loading');
      apiClient.files.checkpoints
        .list(uuid)
        .then((data) => {
          setData(data);
          setLoadState('loaded');
        })
        .catch((error) => {
          console.error(error);
          setError('Failed to load file versions. Try again later.');
          setLoadState('error');
        });
    }
  }, [loadState, uuid]);

  // TODO: what if there are 0 versions?

  const versionsByDay = versions.reduce((acc, version) => {
    const date = new Date(version.timestamp);
    const day = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    acc[day] = [...(acc[day] || []), version];
    return acc;
  }, {} as Record<string, ApiTypes['/v0/files/:uuid/checkpoints.GET.response']['checkpoints']>);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Files are saved automatically as you work. You can restore a previous version if needed.{' '}
            <InlineExternalLink href={DOCUMENTATION_FILE_RECOVERY}>Learn more</InlineExternalLink>
          </DialogDescription>
        </DialogHeader>
        <div className="">
          {loadState === 'error' ? (
            <p className="text-center text-sm text-destructive">{error}</p>
          ) : loadState === 'loading' || loadState === 'idle' ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <div className="flex flex-col gap-0.5">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            </div>
          ) : (
            <div className="text-sm">
              {Object.entries(versionsByDay).map(([day, versions], groupIndex) => {
                return (
                  <div key={day} className={cn(groupIndex !== 0 && 'mt-6')}>
                    <Type as="h3" variant="overline" className="mb-2">
                      {day}
                    </Type>
                    <ul className="rounded-md border border-border">
                      {versions.map((version, i) => {
                        const isFirstVersion = groupIndex === 0 && i === 0;

                        return (
                          <FileVersion
                            key={version.timestamp}
                            fileUuid={uuid}
                            checkpointUrl={version.dataUrl}
                            checkpointVersion={version.version}
                            isCurrentFileVersion={isFirstVersion}
                            timestamp={version.timestamp}
                            index={i}
                            isPrivate={isTeamFilesRoute}
                          />
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

function FileVersion({
  isCurrentFileVersion,
  timestamp,
  index,
  checkpointUrl,
  checkpointVersion,
  fileUuid,
  isPrivate,
}: {
  fileUuid: string;
  checkpointUrl: string;
  checkpointVersion: string;
  isCurrentFileVersion: boolean;
  index: number;
  timestamp: string;
  isPrivate: boolean;
}) {
  const label = new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

  const fetcherDownload = useFetcher();
  const fetcherDuplicate = useFetcher();
  const disabled = fetcherDownload.state !== 'idle' || fetcherDuplicate.state !== 'idle';

  // If we duplicated a file successfully, open it in a new tab
  useEffect(() => {
    if (fetcherDuplicate.data && fetcherDuplicate.data.ok) {
      console.log('DUPLICATED!, redirect to', fetcherDuplicate.data.uuid);
      window.open(ROUTES.FILE(fetcherDuplicate.data.uuid), '_blank');
    }
  }, [fetcherDuplicate]);
  return (
    <li
      className={cn('group flex items-center p-1 pl-3 pr-1 hover:bg-accent', {
        'border-t border-border': index !== 0,
      })}
    >
      <p className="font-medium">{label}</p>
      <div className="ml-auto flex items-center gap-0.5">
        {isCurrentFileVersion && <Badge variant="secondary">Current version</Badge>}
        <TooltipPopover label="Download" tooltipProps={{ delayDuration: 1000 }}>
          <Button
            disabled={disabled}
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => {
              const data = getActionFileDownload({ checkpointUrl });
              fetcherDownload.submit(data, {
                method: 'POST',
                action: ROUTES.API.FILE(fileUuid),
                encType: 'application/json',
              });
            }}
          >
            {fetcherDownload.state !== 'idle' ? <SpinnerIcon /> : <DownloadIcon />}
          </Button>
        </TooltipPopover>
        <TooltipPopover label="Duplicate" tooltipProps={{ delayDuration: 1000 }}>
          <Button
            disabled={disabled}
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => {
              const data = getActionFileDuplicate({
                redirect: false,
                isPrivate,
                // If it's the current version
                ...(isCurrentFileVersion
                  ? {}
                  : {
                      checkpointDataUrl: checkpointUrl,
                      checkpointVersion: checkpointVersion,
                    }),
              });
              fetcherDuplicate.submit(data, {
                method: 'POST',
                action: ROUTES.API.FILE(fileUuid),
                encType: 'application/json',
              });
            }}
          >
            {fetcherDuplicate.state !== 'idle' ? <SpinnerIcon /> : <FileCopyIcon />}
          </Button>
        </TooltipPopover>
      </div>
    </li>
  );
}

export { FileVersionHistoryDialog };

/**
 * Shared component for inline textual links that open in a new tab, e.g.
 * a link to something in the docs.
 * @param opts
 * @param opts.href - The URL to link to.
 * @param opts.children - The content to display.
 * @returns
 */
function InlineExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" className="gap-1 underline hover:text-primary">
      {children}
      <ExternalLinkIcon className="relative top-0.5 ml-0.5 !text-xs" />
    </a>
  );
}
