import { events } from '@/app/events/events';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import type { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import { SyncingAlertIcon, SyncingDoneIcon, SyncingInProgressIcon } from '@/shared/components/Icons';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';

type DisplayState = 'synced' | 'syncing' | 'sync-alert';

export const ConnectionStatusIcon = () => {
  const [syncState, setSyncState] = useState<MultiplayerState>(multiplayer.state);
  const [unsavedTransactions, setUnsavedTransactions] = useState(0);
  const [displayState, setDisplayState] = useState<DisplayState>('synced');

  useEffect(() => {
    const updateState = (state: MultiplayerState) => {
      setSyncState(state);
    };
    events.on('multiplayerState', updateState);
    return () => {
      events.off('multiplayerState', updateState);
    };
  }, []);

  useEffect(() => {
    const updateUnsavedTransactions = (transactions: number, _operations: number) => {
      setUnsavedTransactions(transactions);
    };
    events.on('offlineTransactions', updateUnsavedTransactions);
    return () => {
      events.off('offlineTransactions', updateUnsavedTransactions);
    };
  }, []);

  // Calculate what the display state should be based on current sync state
  useEffect(() => {
    let targetState: DisplayState;

    if (syncState === 'connected' && unsavedTransactions === 0) {
      targetState = 'synced';
    } else if (syncState === 'syncing' || (syncState === 'connected' && unsavedTransactions > 0)) {
      targetState = 'syncing';
    } else {
      targetState = 'sync-alert';
    }

    // Apply debounce logic: delay when transitioning FROM "synced", immediate otherwise
    let timeoutId: NodeJS.Timeout | null = null;

    if (targetState === 'synced') {
      // Immediately show synced state
      setDisplayState(targetState);
    } else if (displayState === 'synced') {
      // Transitioning away from synced - apply delay
      timeoutId = setTimeout(() => {
        setDisplayState(targetState);
      }, 1000);
    } else {
      // Already in a non-synced state, update immediately
      setDisplayState(targetState);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [syncState, unsavedTransactions, displayState]);

  let tooltip: string;
  let icon: React.ReactNode;

  if (displayState === 'synced') {
    tooltip = 'All changes saved';
    icon = <SyncingDoneIcon className="text-muted-foreground opacity-50 hover:text-foreground hover:opacity-100" />;
  } else if (displayState === 'syncing') {
    tooltip = 'Recent changes saved locally';
    if (unsavedTransactions > 0) {
      tooltip += ` (syncing ${unsavedTransactions} ${unsavedTransactions === 1 ? 'item' : 'items'}…)`;
    }
    icon = <SyncingInProgressIcon className={'text-muted-foreground hover:text-foreground'} />;
  } else {
    const isOffline = syncState === 'no internet' || syncState === 'waiting to reconnect';
    if (isOffline) {
      tooltip = 'Network offline • Recent changes only saved locally';
    } else {
      tooltip = 'Recent changes only saved locally';
    }
    icon = <SyncingAlertIcon className={'text-destructive'} />;
  }

  return (
    <TooltipPopover label={tooltip}>
      <div className={cn('flex items-center')}>{icon}</div>
    </TooltipPopover>
  );
};
