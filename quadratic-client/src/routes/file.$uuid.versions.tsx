import { apiClient } from '@/shared/api/apiClient';
import { ChevronRightIcon, DraftIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { useState } from 'react';
import { useLoaderData, useParams, type LoaderFunctionArgs } from 'react-router-dom';

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { uuid } = params as { uuid: string };
  const data = await apiClient.files.checkpoints.list(uuid);
  return data;
};

export const Component = () => {
  const { uuid } = useParams() as { uuid: string };
  const data = useLoaderData() as LoaderData;
  const [activeCheckpointId, setActiveCheckpointId] = useState<number | null>(null);
  const iframeUrl = activeCheckpointId ? ROUTES.FILE(uuid) + `?checkpoint=${activeCheckpointId}&embed` : '';

  const checkpointsByDay = data.checkpoints.reduce((acc, version) => {
    const date = new Date(version.timestamp);
    const day = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    acc[day] = [...(acc[day] || []), version];
    return acc;
  }, {} as Record<string, LoaderData['checkpoints']>);

  // TODO: we probably want to hide the file name because it's changed over time

  return (
    <div className="grid h-full w-full grid-cols-[300px_1fr] overflow-hidden">
      <div className="overflow-hidden border-r border-border">
        <div className="p-3">
          <p className="mb-1 inline-flex items-center gap-0.5 rounded bg-accent py-1 pl-1 pr-2 text-xs font-semibold">
            <DraftIcon />
            {data.name}
          </p>
          <h3 className="mr-auto text-lg font-semibold">Version history</h3>
          <p className="text-sm text-muted-foreground">
            Browse previous file versions in read-only mode to see changes and restore them.
          </p>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              disabled={!activeCheckpointId}
              onClick={() => {
                // TODO: implement
                window.alert('Not implemented');
              }}
            >
              Duplicate
            </Button>
            <Button
              variant="outline"
              disabled={!activeCheckpointId}
              onClick={() => {
                // TODO: implement
                window.alert('Not implemented');
              }}
            >
              Download
            </Button>
          </div>
        </div>
        <div className="flex h-full flex-col  overflow-scroll border-t border-border p-3">
          {Object.entries(checkpointsByDay).map(([day, versions], groupIndex) => {
            return (
              <div id={day} className={cn(groupIndex !== 0 && 'mt-6')}>
                <Type variant="overline" className="mb-2">
                  {day}
                </Type>
                <ul className="flex-col gap-2 text-sm">
                  {versions.map((version) => {
                    const label = new Date(version.timestamp).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                    });
                    const isSelected = activeCheckpointId === version.id;
                    return (
                      <li key={version.id}>
                        <button
                          className={cn(
                            'flex w-full items-center justify-between rounded px-2 py-2',
                            isSelected ? 'bg-primary text-background' : ''
                          )}
                          onClick={() => setActiveCheckpointId((prev) => (prev === version.id ? null : version.id))}
                        >
                          {label}
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
          <iframe src={iframeUrl} title="App" className="pointer-events-nonez h-full w-full" />
        ) : (
          <p className="flex h-full w-full flex-col items-center justify-center text-sm text-muted-foreground">
            Select a file version on the left to preview it…
          </p>
        )}
      </div>
    </div>
  );
};
