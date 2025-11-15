import { events } from '@/app/events/events';
import { pluralize } from '@/app/helpers/pluralize';
import BottomBarItem from '@/app/ui/menus/BottomBar/BottomBarItem';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import type { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CloseIcon, SpinnerIcon } from '@/shared/components/Icons';
import { ShowAfter } from '@/shared/components/ShowAfter';
import { DOCUMENTATION_OFFLINE } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { timeAgo } from '@/shared/utils/timeAgo';
import { useEffect, useState } from 'react';

// const TIMEOUT_TO_SHOW_DISCONNECT_MESSAGE = 1000;

export default function SyncState() {
  const [syncState, setSyncState] = useState<MultiplayerState>(multiplayer.state);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [showOfflineMsg, setShowOfflineMsg] = useState(false);

  useEffect(() => {
    const updateState = (state: MultiplayerState) => {
      setSyncState((prevState) => {
        // If they dismissed it, don't show it again if they've gone from offline -> online
        if ((prevState === 'connected' || prevState === 'syncing') && !(state === 'connected' || state === 'syncing')) {
          setShowOfflineMsg(true);
        }
        // If they didn't dismiss it, make sure it hides if they go from offline -> online
        if (!(prevState === 'connected' || prevState === 'syncing') && (state === 'connected' || state === 'syncing')) {
          setShowOfflineMsg(false);
        }
        return state;
      });
    };
    events.on('multiplayerState', updateState);
    return () => {
      events.off('multiplayerState', updateState);
    };
  }, []);

  const [unsavedTransactions, setUnsavedTransactions] = useState(0);
  useEffect(() => {
    const updateUnsavedTransactions = (transactions: number, _operations: number) => {
      setUnsavedTransactions(transactions);
    };
    events.on('offlineTransactions', updateUnsavedTransactions);

    const offlineTransactionsApplied = (timestamps: number[]) => {
      if (timestamps.length === 0) return;
      const to = timeAgo(timestamps[timestamps.length - 1]);
      const message = (
        <div>
          We applied {timestamps.length} unsynced changes from {to}. You can undo these changes.{' '}
          <a className="underline" href={DOCUMENTATION_OFFLINE} target="_blank" rel="noopener noreferrer">
            Learn More
          </a>
          .
        </div>
      );
      addGlobalSnackbar(message, {
        severity: 'warning',
        button: {
          title: 'Undo',
          callback: () => {
            for (let i = 0; i < timestamps.length; i++) {
              quadraticCore.undo(1, false);
            }
          },
        },
      });
    };
    events.on('offlineTransactionsApplied', offlineTransactionsApplied);

    return () => {
      events.off('offlineTransactions', updateUnsavedTransactions);
      events.off('offlineTransactionsApplied', offlineTransactionsApplied);
    };
  }, [addGlobalSnackbar]);

  let tooltip: string;
  let message: string;
  let icon = null;
  let className = '';

  const loadingIcon = (
    <span className="flex scale-75 items-center">
      <SpinnerIcon className="text-primary" />
    </span>
  );

  if (syncState === 'connected') {
    message = 'Connected';
    tooltip = 'All changes saved';
  } else if (syncState === 'syncing') {
    message = 'Syncing…';
    tooltip = 'Recent changes saved locally';
    icon = loadingIcon;
  } else {
    className = 'text-destructive';
    icon = loadingIcon;
    message = 'Offline, reconnecting…';
    tooltip = 'Recent changes only saved locally';
  }

  if (unsavedTransactions > 0) {
    tooltip += ` (syncing ${unsavedTransactions} ${pluralize('item', unsavedTransactions)}…)`;
  }

  return (
    <>
      <BottomBarItem className={className} icon={icon}>
        <TooltipPopover label={tooltip}>
          <div>{message}</div>
        </TooltipPopover>
      </BottomBarItem>
      {showOfflineMsg && (
        <ShowAfter delay={5000}>
          <div className="fixed bottom-16 right-2 z-[100] w-96 rounded bg-destructive p-4 pr-8 text-sm text-background">
            Connection lost. Your changes are only saved locally.{' '}
            <a className="underline" href={DOCUMENTATION_OFFLINE} target="_blank" rel="noopener noreferrer">
              Learn more
            </a>
            .
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1 !bg-transparent opacity-80 hover:text-background hover:opacity-100"
              onClick={() => setShowOfflineMsg(false)}
            >
              <CloseIcon />
            </Button>
          </div>
        </ShowAfter>
      )}
    </>
  );
}
