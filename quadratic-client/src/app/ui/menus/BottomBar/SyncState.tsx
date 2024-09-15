import { events } from '@/app/events/events';
import { pluralize } from '@/app/helpers/pluralize';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { MultiplayerState } from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { DOCUMENTATION_OFFLINE } from '@/shared/constants/urls';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { timeAgo } from '@/shared/utils/timeAgo';
import { CircularProgress } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import BottomBarItem from './BottomBarItem';

const TIMEOUT_TO_SHOW_DISCONNECT_MESSAGE = 1000;

export default function SyncState() {
  const [syncState, setSyncState] = useState<MultiplayerState>(multiplayer.state);
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const [disconnectMessage, setDisconnectMessage] = useState(false);
  const timeout = useRef<number | null>(null);
  useEffect(() => {
    const updateState = (state: MultiplayerState) => {
      if (state === 'waiting to reconnect' || state === 'no internet') {
        if (!timeout.current && !disconnectMessage) {
          timeout.current = window.setTimeout(() => {
            const message = (
              <div>
                Connection to the Quadratic server was lost. Your changes are only saved locally.{' '}
                <a className="underline" href={DOCUMENTATION_OFFLINE}>
                  Learn more
                </a>
                .
              </div>
            );
            addGlobalSnackbar(message, {
              severity: 'warning',
              button: { title: 'Refresh', callback: () => window.location.reload() },
            });
            timeout.current = null;
            setDisconnectMessage(true);
          }, TIMEOUT_TO_SHOW_DISCONNECT_MESSAGE);
        }
      }
      if (state === 'connected' && timeout.current) {
        window.clearTimeout(timeout.current);
        timeout.current = null;
      }
      if (state === 'connected' && disconnectMessage) {
        setDisconnectMessage(false);
        addGlobalSnackbar('Connection to the Quadratic server was reestablished.', { severity: 'success' });
      }
      setSyncState(state);
    };
    events.on('multiplayerState', updateState);
    return () => {
      events.off('multiplayerState', updateState);
    };
  }, [addGlobalSnackbar, disconnectMessage]);

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
          <a className="underline" href={DOCUMENTATION_OFFLINE}>
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
              quadraticCore.undo();
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

  const [open, setOpen] = useState(false);

  let tooltip: string;
  let message: string;
  let icon = null;
  let className = '';

  const loadingIcon = <CircularProgress size="0.5rem" />;
  const errorClassName = 'bg-destructive text-background';

  if (['waiting to reconnect', 'connecting'].includes(syncState) && multiplayer.brokenConnection) {
    className = 'bg-warning text-background';
    message = 'Reconnecting…';
    tooltip = 'Your changes may only be saved locally…';
  } else if (['not connected', 'connecting', 'waiting to reconnect', 'startup'].includes(syncState)) {
    message = 'Connecting…';
    tooltip = 'Attempting to connect…';
    icon = loadingIcon;
  } else if (syncState === 'syncing') {
    message = 'Syncing...';
    tooltip = 'Your recent changes are saved locally.';
    icon = loadingIcon;
  } else if (syncState === 'connected') {
    message = 'Connected';
    tooltip = 'Your changes are saved.';
  } else if (syncState === 'no internet') {
    className = errorClassName;
    message = 'Offline';
    tooltip = 'Connection down. Your changes are only saved locally.';
  } else {
    className = errorClassName;
    message = 'Offline';
    tooltip = 'Connection lost. Your changes are only saved locally.';
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <BottomBarItem className={className} icon={icon} onClick={() => {}}>
          <TooltipPopover label={tooltip}>
            <div>{message}</div>
          </TooltipPopover>
        </BottomBarItem>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          {unsavedTransactions === 0
            ? 'Nothing waiting to sync'
            : `Syncing ${unsavedTransactions} ${pluralize('item', unsavedTransactions)}.`}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
