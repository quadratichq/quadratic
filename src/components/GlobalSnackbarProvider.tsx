import CloseIcon from '@mui/icons-material/Close';
import { Alert, AlertColor } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

const DURATION = 6000;
export const snackbarMsgQueryParam = 'snackbar-msg';
export const snackbarSeverityQueryParam = 'snackbar-severity';

/**
 * Context
 */

export interface GlobalSnackbar {
  addGlobalSnackbar: (message: string, options?: { severity?: 'error' | 'warning' }) => void;
}
const defaultContext: GlobalSnackbar = {
  addGlobalSnackbar: () => {
    console.warn(
      '[GlobalSnackbarContext] `addGlobalSnackbar` was fired before it was initialized with a default value.'
    );
  },
};
export const GlobalSnackbarContext = React.createContext(defaultContext);

/**
 * Consumer
 */

export const useGlobalSnackbar: () => GlobalSnackbar = () => React.useContext(GlobalSnackbarContext);

/**
 * Provider
 */

interface Message {
  key: number;
  message: string;
  // snackbarProps: SnackbarProps;
  severity?: AlertColor;
  stayOpen?: boolean;
}

export function GlobalSnackbarProvider({ children }: { children: React.ReactElement }) {
  const [messageQueue, setMessageQueue] = React.useState<readonly Message[]>([]);
  const [open, setOpen] = React.useState(false);
  const [stayOpen, setStayOpen] = React.useState(false);
  const [activeMessage, setActiveMessage] = React.useState<Message | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();

  React.useEffect(() => {
    if (messageQueue.length && !activeMessage) {
      // Set a new snack when we don't have an active one
      setActiveMessage({ ...messageQueue[0] });
      setMessageQueue((prev) => prev.slice(1));
      setStayOpen(!!messageQueue[0].stayOpen);
      setOpen(true);
    } else if (messageQueue.length && activeMessage && open) {
      // Close an active snack when a new one is added
      setOpen(false);
    }
  }, [messageQueue, activeMessage, open]);

  /*
   * By default, take a message and display a snackbar that auto-hides
   * after a certain amount of time and is dismissible
   *
   * Example: `showSnackbar("Copied as PNG")`
   * Example: `showSnackbar("My message here", { severity: 'error' })
   *
   * Future: customize the snackbar by passing your own props to override the defaults:
   * Example: `showSnackbar("Thing completed", { action: <Button>Undo</Button> })`
   */
  const addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'] = React.useCallback((message, options = {}) => {
    if (typeof message === 'string') {
      setMessageQueue((prev) => [
        ...prev,
        {
          message,
          key: new Date().getTime(),
          ...(options.severity ? { severity: options.severity } : {}),
        },
      ]);
    }
    // else if (arg && (arg.children || arg.message || arg.action)) {
    //   Handle customization
    // }
    else {
      throw new Error('Unexpected arguments to `addGlobalSnackbar`');
    }
  }, []);

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
            {activeMessage.message}
          </Alert>
        ),
      }
    : { message: activeMessage?.message };

  // If the route has these query params (when it loads), we'll throw up a snackbar too
  React.useEffect(() => {
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
        action={
          <React.Fragment>
            {/* if activeMessage.snackbarProps.action <Button color="secondary" size="small" onClick={handleClose}>
              UNDO
        </Button> */}
            <IconButton aria-label="close" color="inherit" sx={{ p: 0.5 }} onClick={handleClose}>
              <CloseIcon fontSize="small" sx={{ opacity: '.5', ':hover': { opacity: 1 } }} />
            </IconButton>
          </React.Fragment>
        }
      />
    </GlobalSnackbarContext.Provider>
  );
}
