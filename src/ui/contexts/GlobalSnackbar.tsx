import * as React from 'react';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { SnackbarProps } from '@mui/material/Snackbar';

const DURATION = 6000;

/**
 * Context
 */

export interface GlobalSnackbar {
  addGlobalSnackbar: (message: string /* options: {} */) => void;
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
  snackbarProps: SnackbarProps;
}

export function GlobalSnackbarProvider({ children }: { children: React.ReactElement }) {
  const [messageQueue, setMessageQueue] = React.useState<readonly Message[]>([]);
  const [open, setOpen] = React.useState(false);
  const [activeMessage, setActiveMessage] = React.useState<Message | undefined>(undefined);

  React.useEffect(() => {
    if (messageQueue.length && !activeMessage) {
      // Set a new snack when we don't have an active one
      setActiveMessage({ ...messageQueue[0] });
      setMessageQueue((prev) => prev.slice(1));
      setOpen(true);
    } else if (messageQueue.length && activeMessage && open) {
      // Close an active snack when a new one is added
      setOpen(false);
    }
  }, [messageQueue, activeMessage, open]);

  /*
   * By default, take a message and display a snackbar that auto-hides
   * after a certain amount of time and is dismissable
   *
   * Example: `showSnackbar("Copied as PNG")`
   *
   * Future: customize the snackbar by passing your own props to override the defaults:
   *
   * Example: `showSnackbar({ message: "Thing completed", action: <Button>Undo</Button> })`
   *
   * Or
   * ```
   * showSnackbar(
   *   children:
   *     <Alert severity="error" onClose={onClose} elevation={6}>
   *       Failed to load the file specified in URL.
   *     </Alert>
   * )
   * ```
   */
  const addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'] = (message) => {
    if (typeof message === 'string') {
      setMessageQueue((prev) => [...prev, { snackbarProps: { message }, key: new Date().getTime() }]);
    }
    //else if (arg && (arg.children || arg.message || arg.action)) {
    // Handle customization
    //}
    else {
      throw new Error('Unexpected arguments to `addGlobalSnackbar`');
    }
  };

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

  return (
    <GlobalSnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={DURATION}
        key={activeMessage ? activeMessage.key : undefined}
        open={open}
        onClose={handleClose}
        TransitionProps={{ onExited: handleExited }}
        message={activeMessage ? activeMessage.snackbarProps.message : undefined}
        action={
          <React.Fragment>
            {/* if activeMessage.snackbarProps.action <Button color="secondary" size="small" onClick={handleClose}>
              UNDO
        </Button> */}
            <IconButton aria-label="close" color="inherit" sx={{ p: 0.5 }} onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </React.Fragment>
        }
      />
    </GlobalSnackbarContext.Provider>
  );
}
