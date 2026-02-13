import { deriveSyncState, type SyncState } from '@/app/atoms/useSyncedConnection';
import { apiClient } from '@/shared/api/apiClient';
import { CheckCircleIcon, CheckIcon, ErrorIcon, SyncIcon } from '@/shared/components/Icons';
import { SnakeGame } from '@/shared/components/connections/SnakeGame';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useEffect, useState } from 'react';

const SYNC_STATUS_POLL_INTERVAL_MS = 3000;

interface ConnectionSyncingStatusModalProps {
  open: boolean;
  connectionUuid: string;
  connectionType: ConnectionType;
  connectionName: string;
  teamUuid: string;
  onUseConnection: () => void;
  onViewErrorDetails: () => void;
  onClose: () => void;
}

export function ConnectionSyncingStatusModal({
  open,
  connectionUuid,
  connectionType,
  connectionName,
  teamUuid,
  onUseConnection,
  onViewErrorDetails,
  onClose,
}: ConnectionSyncingStatusModalProps) {
  const [syncState, setSyncState] = useState<SyncState>('not_synced');
  const [percentCompleted, setPercentCompleted] = useState(0);
  useEffect(() => {
    if (!open || !connectionUuid) return;

    const fetchSyncStatus = async () => {
      try {
        const connection = await apiClient.connections.get({
          connectionUuid,
          teamUuid,
        });
        if (connection) {
          const newSyncState = deriveSyncState({
            percentCompleted: connection.syncedConnectionPercentCompleted,
            latestLogStatus: connection.syncedConnectionLatestLogStatus,
          });
          setSyncState(newSyncState);
          setPercentCompleted(connection.syncedConnectionPercentCompleted ?? 0);
        }
      } catch {
        // Silently fail - keep polling
      }
    };

    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, SYNC_STATUS_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [open, connectionUuid, teamUuid]);

  useEffect(() => {
    if (open) {
      trackEvent('[ConnectionSyncingModal].opened', { type: connectionType });
    }
  }, [open, connectionType]);

  const handleUseConnection = useCallback(() => {
    trackEvent('[ConnectionSyncingModal].useConnection', {
      type: connectionType,
      syncState,
    });
    onUseConnection();
  }, [connectionType, syncState, onUseConnection]);

  const handleViewErrorDetails = useCallback(() => {
    trackEvent('[ConnectionSyncingModal].viewErrorDetails', {
      type: connectionType,
    });
    onViewErrorDetails();
  }, [connectionType, onViewErrorDetails]);

  const handleClose = useCallback(() => {
    trackEvent('[ConnectionSyncingModal].close', {
      type: connectionType,
      syncState,
    });
    onClose();
  }, [connectionType, syncState, onClose]);

  const syncingState =
    syncState === 'syncing' || syncState === 'not_synced' ? 'SYNCING' : syncState === 'synced' ? 'SYNCED' : 'FAILED';

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Syncing your connection…</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {/* Status section */}
          <div className="rounded bg-accent text-center text-sm">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-2 px-2 py-4">
              {syncingState === 'SYNCING' && (
                <>
                  <SyncIcon className="animate-spin" />
                  <p>You can use your connection when syncing is complete. This can take a few minutes.</p>
                  <Button disabled className="mt-1">
                    Use connection
                  </Button>
                </>
              )}
              {syncingState === 'SYNCED' && (
                <>
                  <CheckCircleIcon />
                  <p>Your connection is ready for use!</p>
                  <Button onClick={handleUseConnection} className="mt-1">
                    Use connection
                  </Button>
                </>
              )}
              {syncingState === 'FAILED' && (
                <>
                  <ErrorIcon className="text-destructive" />
                  <p className="text-destructive">
                    Your connection failed to sync. Check the connection details for more info.
                  </p>
                  <Button variant="default" onClick={handleViewErrorDetails} className="mt-1">
                    View connection details
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Educational content */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold">How to use synced connections in Quadratic:</h4>

            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">
                  <CheckIcon />
                </span>
                <span>
                  <strong className="font-medium text-foreground">Query with AI:</strong> Ask questions about your data
                  in natural language.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">
                  <CheckIcon />
                </span>
                <span>
                  <strong className="font-medium text-foreground">Sync automatically:</strong> Your data refreshes
                  automatically every day.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">
                  <CheckIcon />
                </span>
                <span>
                  <strong className="font-medium text-foreground">Explore the schema:</strong> View the structure of
                  your data with our built-in schema tool.
                </span>
              </li>
            </ul>

            <SnakeGame />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
