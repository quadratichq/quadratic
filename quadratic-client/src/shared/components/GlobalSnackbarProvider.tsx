// import CloseIcon from '@mui/icons-material/Close';
import { Alert, AlertColor, Snackbar } from '@mui/material';
import { useEffect, createContext, useContext, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../shadcn/ui/button';

const DURATION = 6000;
export const snackbarMsgQueryParam = 'snackbar-msg';
export const snackbarSeverityQueryParam = 'snackbar-severity';

/**
 * Context
 */

interface SnackbarOptions {
  severity?: 'error' | 'warning' | 'success';
  button?: { title: string; callback: Function };
}

export interface GlobalSnackbar {
  addGlobalSnackbar: (message: string | JSX.Element, options?: SnackbarOptions) => void;
}
const defaultContext: GlobalSnackbar = {
  addGlobalSnackbar: () => {
    console.warn(
      '[GlobalSnackbarContext] `addGlobalSnackbar` was fired before it was initialized with a default value.'
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
          ...(options || {}),
        },
      ]);
    },
    []
  );

  const handleClose = (event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  const handleExited = () => {
    setActiveMessage(undefined);
  };

  const value: GlobalSnackbar = { addGlobalSnackbar };

  // If we have the `severity`, we'll make it look like an Alert. Otherwise,
  // we'll use the default Snackbar styling.
  const otherProps = activeMessage?.severity
    ? {
        children: (
          <Alert severity={activeMessage.severity} variant="filled" onClose={handleClose}>
            <div className="column center flex px-0.5">
              {activeMessage.message}
              {activeMessage?.button && (
                <Button variant="outline" onClick={() => activeMessage.button?.callback()}>
                  {activeMessage.button.title}
                </Button>
              )}
            </div>
          </Alert>
        ),
      }
    : { message: activeMessage?.message };

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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={stayOpen ? 0 : DURATION}
        key={activeMessage ? activeMessage.key : undefined}
        open={open}
        onClose={handleClose}
        TransitionProps={{ onExited: handleExited }}
        {...otherProps}
      />
    </GlobalSnackbarContext.Provider>
  );
}
