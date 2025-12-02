import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/shadcn/ui/dialog';
import { timeAgo } from '@/shared/utils/timeAgo';
import { useCallback, useMemo, useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Navigate, redirect, useLoaderData } from 'react-router';

export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  const { params } = loaderArgs;
  const teamUuid = params.teamUuid;
  if (!teamUuid) return redirect('/');

  const files = await apiClient.teams.files.deleted.list(teamUuid);
  return { teamUuid, files };
};

export const Component = () => {
  const { teamUuid, files } = useLoaderData<typeof loader>();
  const {
    activeTeam: {
      userMakingRequest: { teamPermissions },
    },
  } = useDashboardRouteLoaderData();
  const [activeFileUuid, setActiveFileUuid] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const activeFile = useMemo(() => files.find(({ file }) => file.uuid === activeFileUuid), [activeFileUuid, files]);
  const handleRestoreAndRedirect = useCallback(
    async (fileUuid: string) => {
      setActiveFileUuid(fileUuid);
      setIsLoading(true);
      try {
        const res = await apiClient.files.restore(fileUuid);
        window.location.href = ROUTES.FILE({ uuid: res.file.uuid });
      } catch {
        setIsLoading(false);
        addGlobalSnackbar('Failed to restore file. Try again.', { severity: 'error' });
      }
    },
    [addGlobalSnackbar]
  );

  // No permission? Redirect to team page
  if (!teamPermissions.includes('TEAM_EDIT')) {
    return <Navigate to={ROUTES.TEAM(teamUuid)} />;
  }

  return (
    <>
      <DashboardHeader title="Deleted files" />
      <div className="-mx-2 flex max-w-3xl flex-col">
        {files.length > 0 ? (
          files.map(({ file }, i) => (
            <button
              key={file.uuid}
              className="flex flex-row items-center gap-3 rounded border-t border-transparent px-2 py-3 hover:bg-accent"
              onClick={() => setActiveFileUuid(file.uuid)}
            >
              <div className={`hidden border border-border shadow-sm md:block`}>
                {file.thumbnail ? (
                  <img
                    loading={i > 30 ? 'lazy' : 'eager'}
                    src={file.thumbnail}
                    crossOrigin="anonymous"
                    alt="File thumbnail screenshot"
                    className={`aspect-video object-fill`}
                    width="80"
                    draggable="false"
                  />
                ) : (
                  <div className="flex aspect-video w-20 items-center justify-center bg-background">
                    <img
                      src={'/favicon.ico'}
                      alt="File thumbnail placeholder"
                      className={`h-4 w-4 opacity-10 brightness-0 grayscale`}
                      width="16"
                      height="16"
                      draggable="false"
                    />
                  </div>
                )}
              </div>
              <span className="flex flex-col items-start">
                <span className="text-base">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {file.ownerUserId === null ? 'Team' : 'Personal'} file
                </span>
              </span>
              <span className="ml-auto text-xs text-muted-foreground">Deleted {timeAgo(file.deletedDate)} by You</span>
            </button>
          ))
        ) : (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            No personal or team files deleted in the last 30 days.
          </p>
        )}
      </div>
      {activeFile && (
        <Dialog open={true} onOpenChange={() => setActiveFileUuid('')}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore file</DialogTitle>
              <DialogDescription>
                This file will be restored to{' '}
                {activeFile.file.ownerUserId === null ? 'the team’s files' : 'your personal files'}.
              </DialogDescription>
            </DialogHeader>

            <div>
              {activeFile.file.thumbnail && (
                <img
                  crossOrigin="anonymous"
                  src={activeFile.file.thumbnail}
                  alt={activeFile.file.name}
                  className="aspect-video rounded-md border border-border object-fill"
                />
              )}
            </div>
            <DialogFooter className="flex items-center">
              <Button variant="outline" onClick={() => setActiveFileUuid('')} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={() => handleRestoreAndRedirect(activeFileUuid)} loading={isLoading}>
                Restore & open
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
