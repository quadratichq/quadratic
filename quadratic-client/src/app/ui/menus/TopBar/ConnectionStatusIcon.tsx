import { events } from '@/app/events/events';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import type { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import { CheckCircleIcon, LinkOffIcon, SyncIcon } from '@/shared/components/Icons';
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
  let className = '';

  // Show syncing if state is syncing OR if we have unsaved transactions (even if state is connected)
  const isSyncing = syncState === 'syncing' || (syncState === 'connected' && unsavedTransactions > 0);

  if (syncState === 'connected' && !isSyncing) {
    tooltip = 'All changes saved';
    icon = <CheckCircleIcon className={cn('h-4 w-4 text-green-500 dark:text-green-400')} />;
  } else if (isSyncing) {
    tooltip = 'Recent changes saved locally';
    if (unsavedTransactions > 0) {
      tooltip += ` (syncing ${unsavedTransactions} ${unsavedTransactions === 1 ? 'item' : 'items'}…)`;
    }
    icon = <SyncIcon className={cn('h-4 w-4 animate-spin text-yellow-500 dark:text-yellow-400')} />;
  } else {
    tooltip = 'Recent changes only saved locally';
    className = 'text-destructive';
    icon = <LinkOffIcon className={cn('h-4 w-4 text-red-500 dark:text-red-400')} />;
  }

  return (
    <TooltipPopover label={tooltip}>
      <div className={cn('flex items-center', className)}>{icon}</div>
    </TooltipPopover>
  );
};
