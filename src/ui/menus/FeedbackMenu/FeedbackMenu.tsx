import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useTheme } from '@mui/system';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { LinkNewTab } from '../../components/LinkNewTab';
import { BUG_REPORT_URL, DISCORD } from '../../../constants/urls';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { useGlobalSnackbar } from '../../contexts/GlobalSnackbar';

export const FeedbackMenu = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { showFeedbackMenu } = editorInteractionState;
  // We'll keep the user's state around unless they explicitly cancel or get a successful submit
  const [value, setValue] = useLocalStorage('feedback-message', '');
  const [loadState, setLoadState] = useState<'INITIAL' | 'LOADING' | 'LOAD_ERROR'>('INITIAL');
  const theme = useTheme();
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const closeMenu = () => {
    setEditorInteractionState((state) => ({
      ...state,
      showFeedbackMenu: false,
    }));
  };

  const onSubmit = () => {
    setLoadState('LOADING');

    // TODO post to DB
    const postToServer = () =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve('');
        }, 2000);
      });

    postToServer()
      .then(() => {
        setValue('');
        closeMenu();
        addGlobalSnackbar('Feedback submitted! Thank you.');
      })
      .catch((e) => {
        console.error(e);
        setLoadState('LOAD_ERROR');
      });
  };

  const isLoading = loadState === 'LOADING';
  const hasError = loadState === 'LOAD_ERROR';

  return (
    <Dialog open={showFeedbackMenu} onClose={closeMenu} fullWidth maxWidth={'sm'} BackdropProps={{ invisible: true }}>
      <DialogTitle>Provide feedback</DialogTitle>
      <DialogContent>
        <DialogContentText>
          We’re listening on <LinkNewTab href={BUG_REPORT_URL}>GitHub</LinkNewTab> or{' '}
          <LinkNewTab href={DISCORD}>Discord</LinkNewTab>. Or, provide feedback below (we read all feedback and may
          follow up via email).
        </DialogContentText>

        <TextField
          InputLabelProps={{ shrink: true }}
          id="feedback"
          label="Your feedback"
          variant="outlined"
          disabled={isLoading}
          fullWidth
          multiline
          sx={{ mt: theme.spacing(2) }}
          autoFocus
          value={value}
          onFocus={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            // If an error exists, reset
            if (loadState === 'LOAD_ERROR') {
              setLoadState('INITIAL');
            }
            // Ensure cursor position to the end on focus
            if (value.length > 0) {
              event.target.setSelectionRange(value.length, value.length);
            }
          }}
          // Allow submit via keyboard CMD + Enter
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              onSubmit();
            }
          }}
          onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setValue(event.target.value);
          }}
          {...(hasError ? { error: true, helperText: 'Failed to send. Try again.' } : {})}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="text"
          color="inherit"
          onClick={() => {
            setValue('');
            closeMenu();
          }}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          variant="text"
          sx={{ mr: theme.spacing(1) }}
          onClick={onSubmit}
          disabled={value.length === 0 || isLoading}
        >
          {isLoading ? 'Submitting…' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
