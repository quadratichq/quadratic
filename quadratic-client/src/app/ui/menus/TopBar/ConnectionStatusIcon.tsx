import { events } from '@/app/events/events';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import type { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import { SyncingAlertIcon, SyncingDoneIcon, SyncingInProgressIcon } from '@/shared/components/Icons';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';

export const ConnectionStatusIcon = () => {
  const [syncState, setSyncState] = useState<MultiplayerState>(multiplayer.state);
  const [unsavedTransactions, setUnsavedTransactions] = useState(0);

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

  let tooltip: string;
  let icon: React.ReactNode;

  // Show syncing if state is syncing OR if we have unsaved transactions (even if state is connected)
  const isSyncing = syncState === 'syncing' || (syncState === 'connected' && unsavedTransactions > 0);

  if (syncState === 'connected' && !isSyncing) {
    tooltip = 'All changes saved';
    icon = <SyncingDoneIcon className="text-muted-foreground opacity-50 hover:text-foreground hover:opacity-100" />;
  } else if (isSyncing) {
    tooltip = 'Recent changes saved locally';
    if (unsavedTransactions > 0) {
      tooltip += ` (syncing ${unsavedTransactions} ${unsavedTransactions === 1 ? 'item' : 'items'}…)`;
    }
    icon = <SyncingInProgressIcon className={'text-muted-foreground hover:text-foreground'} />;
  } else {
    tooltip = 'Recent changes only saved locally';
    icon = <SyncingAlertIcon className={'text-destructive'} />;
  }

  return (
    <TooltipPopover label={tooltip}>
      <div className={cn('flex items-center')}>{icon}</div>
    </TooltipPopover>
  );
};
