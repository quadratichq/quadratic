// import CloseIcon from '@mui/icons-material/Close';
import type { JsSnackbarSeverity } from '@/app/quadratic-core-types';
import { CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import type { AlertColor } from '@mui/material';
import { Alert, Snackbar } from '@mui/material';
import type { JSX } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

const DURATION = 6000;
export const snackbarMsgQueryParam = 'snackbar-msg';
export const snackbarSeverityQueryParam = 'snackbar-severity';

/// TODO: this should be centralized in a single place
const DEFINED_MESSAGES: Record<string, string> = {
  delete_rows_error: 'Cannot delete rows containing table names or columns',
};

/**
 * Context
 */

export interface SnackbarOptions {
  severity?: JsSnackbarSeverity;
  button?: { title: string; callback: Function };
  stayOpen?: boolean;
}

export interface GlobalSnackbar {
  addGlobalSnackbar: (message: string | JSX.Element, options?: SnackbarOptions) => void;
  closeCurrentSnackbar: () => void;
}
const defaultContext: GlobalSnackbar = {
  addGlobalSnackbar: () => {
    console.warn(
      '[GlobalSnackbarContext] `addGlobalSnackbar` was fired before it was initialized with a default value.'
    );
  },
  closeCurrentSnackbar: () => {
    console.warn(
      '[GlobalSnackbarContext] `closeCurrentSnackbar` was fired before it was initialized with a default value.'
    );
  },
};
export const GlobalSnackbarContext = createContext(defaultContext);

/**
 * Consumer
 */

export const useGlobalSnackbar: () => GlobalSnackbar = () => useContext(GlobalSnackbarContext);

/**
 * Provider
 */

interface Message {
  key: number;
  message: string | JSX.Element;
  severity?: AlertColor;
  button?: { title: string; callback: Function };
  stayOpen?: boolean;
}

export function GlobalSnackbarProvider({ children }: { children: React.ReactElement }) {
  const [messageQueue, setMessageQueue] = useState<readonly Message[]>([]);
  const [open, setOpen] = useState(false);
  const [stayOpen, setStayOpen] = useState(false);
  const [activeMessage, setActiveMessage] = useState<Message | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (messageQueue.length && !activeMessage) {
      // Set a new snack when we don't have an active one
      setActiveMessage({ ...messageQueue[0] });
      setMessageQueue((prev) => prev.slice(1));
      setStayOpen(!!messageQueue[0].stayOpen);
      setOpen(true);
    }

    // we don't want a new message to replace the current message until the timer expires
    // else if (messageQueue.length && activeMessage && open) {
    //   setOpen(false);
    // }
  }, [messageQueue, activeMessage, open]);

  /*
   * By default, take a message and display a snackbar that auto-hides
   * after a certain amount of time and is dismissible
   *
   * Example: `showSnackbar("Copied as PNG")`
   * Example: `showSnackbar("My message here", { severity: 'error' })
   *
   * Can add a button to the snackbar by passing options { button: { title: string, callback: Function } }
   */
  const addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'] = useCallback(
    (message: string | JSX.Element, options?: SnackbarOptions) => {
      setMessageQueue((prev) => [
        ...prev,
        {
          message,
          key: new Date().getTime(),
          stayOpen: options?.stayOpen ?? false,
          ...(options || {}),
        },
      ]);
    },
    []
  );

  const closeCurrentSnackbar: GlobalSnackbar['closeCurrentSnackbar'] = useCallback(() => {
    setOpen(false);
  }, []);

  const handleClose = useCallback((event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  }, []);

  const handleExited = useCallback(() => {
    setActiveMessage(undefined);
  }, []);

  const value: GlobalSnackbar = { addGlobalSnackbar, closeCurrentSnackbar };

  const customButton = activeMessage?.button ? (
    <Button
      variant="link"
      className="whitespace-nowrap !text-background underline"
      onClick={() => {
        activeMessage.button?.callback();
        setOpen(false);
      }}
    >
      {activeMessage.button.title}
    </Button>
  ) : null;

  const message =
    typeof activeMessage?.message === 'string'
      ? (DEFINED_MESSAGES[activeMessage.message] ?? activeMessage.message)
      : activeMessage?.message;

  // If we have the `severity`, we'll make it look like an Alert. Otherwise,
  // we'll use the default Snackbar styling.
  const otherProps = activeMessage?.severity
    ? {
        children: (
          <Alert severity={activeMessage.severity} variant="filled" onClose={handleClose}>
            <div className="flex w-full items-center gap-2">
              <span className="flex-1">{message}</span>
              {customButton}
            </div>
          </Alert>
        ),
      }
    : {
        message: message,
        action: (
          <>
            {customButton}
            {stayOpen && (
              <Button
                data-testid="close-snackbar-button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={handleClose}
                className="!bg-transparent !text-background"
              >
                <CloseIcon />
              </Button>
            )}
          </>
        ),
      };

  // If the route has these query params (when it loads), we'll throw up a snackbar too
  useEffect(() => {
    const msg = searchParams.get(snackbarMsgQueryParam);
    const severity = searchParams.get(snackbarSeverityQueryParam);

    if (msg) {
      addGlobalSnackbar(msg, severity ? { severity: 'error' } : undefined);
      searchParams.delete(snackbarMsgQueryParam);
      searchParams.delete(snackbarSeverityQueryParam);
      setSearchParams(searchParams);
    }
  }, [addGlobalSnackbar, searchParams, setSearchParams]);

  return (
    <GlobalSnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        // Style overrides until we replace this MUI element with a shadcn one
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: 'hsl(var(--foreground))',
            color: 'hsl(var(--background))',
          },
          // Override this so it sits over the sheetbar
          '&.MuiSnackbar-anchorOriginBottomCenter': {
            bottom: '66px !important',
          },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={stayOpen ? null : DURATION}
        key={activeMessage ? activeMessage.key : undefined}
        open={open}
        onClose={handleClose}
        TransitionProps={{ onExited: handleExited }}
        {...otherProps}
      />
    </GlobalSnackbarContext.Provider>
  );
}
