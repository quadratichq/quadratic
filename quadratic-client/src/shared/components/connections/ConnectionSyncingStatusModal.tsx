import { deriveSyncState, type SyncState } from '@/app/atoms/useSyncedConnection';
import { apiClient } from '@/shared/api/apiClient';
import { CheckCircleIcon, SpinnerIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Progress } from '@/shared/shadcn/ui/progress';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useEffect, useRef, useState } from 'react';

const SYNC_STATUS_POLL_INTERVAL_MS = 3000; // Poll every 3 seconds

// Placeholder video URL - replace with actual syncing tutorial video
const SYNCING_TUTORIAL_VIDEO_URL =
  'https://customer-ia5m0yvds0jb4gxr.cloudflarestream.com/6ca8c5bde0049926eb96ae6db577bf7c/manifest/video.m3u8';

interface ConnectionSyncingStatusModalProps {
  open: boolean;
  connectionUuid: string;
  connectionType: ConnectionType;
  connectionName: string;
  teamUuid: string;
  onUseConnection: () => void;
  onClose: () => void;
}

export function ConnectionSyncingStatusModal({
  open,
  connectionUuid,
  connectionType,
  connectionName,
  teamUuid,
  onUseConnection,
  onClose,
}: ConnectionSyncingStatusModalProps) {
  const [syncState, setSyncState] = useState<SyncState>('not_synced');
  const [percentCompleted, setPercentCompleted] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  // Poll for sync status updates
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

    // Fire immediately
    fetchSyncStatus();

    // Then poll
    const interval = setInterval(fetchSyncStatus, SYNC_STATUS_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [open, connectionUuid, teamUuid]);

  // Setup video player with HLS support
  useEffect(() => {
    if (!open || !videoRef.current) return;

    const setupVideo = async () => {
      if (!videoRef.current) return;

      if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = SYNCING_TUTORIAL_VIDEO_URL;
      } else {
        // Dynamically import HLS.js only when needed
        const { default: Hls } = await import('hls.js');
        if (Hls.isSupported()) {
          hlsRef.current = new Hls({
            lowLatencyMode: true,
            capLevelToPlayerSize: true,
            startLevel: -1,
          });
          hlsRef.current.attachMedia(videoRef.current);
          hlsRef.current.loadSource(SYNCING_TUTORIAL_VIDEO_URL);
        }
      }
    };

    setupVideo();

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [open]);

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

  const handleClose = useCallback(() => {
    trackEvent('[ConnectionSyncingModal].close', {
      type: connectionType,
      syncState,
    });
    onClose();
  }, [connectionType, syncState, onClose]);

  const isSyncing = syncState === 'syncing' || syncState === 'not_synced';
  const isSynced = syncState === 'synced';
  const isFailed = syncState === 'failed';

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <LanguageIcon language={connectionType} />
            <div>
              <DialogTitle className="text-left">Setting up your connection</DialogTitle>
              <DialogDescription className="text-left">{connectionName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {/* Sync Status Section */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              {isSyncing && <SpinnerIcon className="text-primary" />}
              {isSynced && <CheckCircleIcon className="text-green-600" />}
              {isFailed && <span className="text-destructive">⚠️</span>}

              <div className="flex-1">
                <p className="font-medium">
                  {isSyncing && 'Syncing your data…'}
                  {isSynced && 'Your data is ready!'}
                  {isFailed && 'Sync encountered an issue'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isSyncing && 'This may take a few minutes for the initial sync.'}
                  {isSynced && 'Your connection is synced and ready to use.'}
                  {isFailed && 'You can still use the connection, but some data may be missing.'}
                </p>
              </div>
            </div>

            {isSyncing && (
              <div className="mt-3">
                <Progress value={percentCompleted} className="h-2" />
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {percentCompleted > 0 ? `${Math.round(percentCompleted)}%` : 'Starting…'}
                </p>
              </div>
            )}
          </div>

          {/* Educational Content */}
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="mb-2 font-medium">While you wait, here's what you can do with synced connections:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-primary">✓</span>
                  <span>
                    <strong className="text-foreground">Query with AI:</strong> Ask questions about your data in natural
                    language
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-primary">✓</span>
                  <span>
                    <strong className="text-foreground">Auto-sync daily:</strong> Your data refreshes automatically
                    every day
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-primary">✓</span>
                  <span>
                    <strong className="text-foreground">Browse schema:</strong> Explore your data structure in the
                    sidebar
                  </span>
                </li>
              </ul>
            </div>

            {/* Video Section */}
            <div className="overflow-hidden rounded-lg border">
              <video
                ref={videoRef}
                controls
                crossOrigin="anonymous"
                className="aspect-video w-full bg-black"
                poster="/images/syncing-video-poster.png"
                onPlay={() => trackEvent('[ConnectionSyncingModal].videoStarted')}
                onEnded={() => trackEvent('[ConnectionSyncingModal].videoCompleted')}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-4 border-t pt-4">
            <button onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground">
              Close
            </button>
            <Button
              onClick={handleUseConnection}
              disabled={isSyncing}
              className={cn('min-w-[140px]', isSyncing && 'cursor-not-allowed')}
            >
              {isSyncing && <SpinnerIcon className="mr-2" />}
              {isSyncing ? 'Syncing…' : 'Use connection'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
