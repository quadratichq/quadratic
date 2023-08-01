import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  TextField,
} from '@mui/material';
import { useTheme } from '@mui/system';
import { useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import apiClientSingleton from '../../../api-client/apiClientSingleton';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { BUG_REPORT_URL, DISCORD, TWITTER } from '../../../constants/urls';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { RootLoaderData } from '../../../routes';
import { useGlobalSnackbar } from '../../contexts/GlobalSnackbar';
import { SocialDiscord, SocialGithub, SocialTwitter } from '../../icons';

export const FeedbackMenu = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { showFeedbackMenu } = editorInteractionState;
  // We'll keep the user's state around unless they explicitly cancel or get a successful submit
  const [value, setValue] = useLocalStorage('feedback-message', '');
  const [loadState, setLoadState] = useState<'INITIAL' | 'LOADING' | 'LOAD_ERROR'>('INITIAL');
  const theme = useTheme();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { user } = useRouteLoaderData('root') as RootLoaderData;

  const closeMenu = () => {
    setEditorInteractionState((state) => ({
      ...state,
      showFeedbackMenu: false,
    }));
  };

  const onSubmit = async () => {
    setLoadState('LOADING');
    const success = await apiClientSingleton.postFeedback({ feedback: value, userEmail: user?.email });
    if (success) {
      setValue('');
      closeMenu();
      addGlobalSnackbar('Feedback submitted! Thank you.');
    } else {
      setLoadState('LOAD_ERROR');
    }
  };

  const isLoading = loadState === 'LOADING';
  const hasError = loadState === 'LOAD_ERROR';

  return (
    <Dialog open={showFeedbackMenu} onClose={closeMenu} fullWidth maxWidth={'sm'} BackdropProps={{ invisible: true }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Provide feedback</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.spacing(1) }}>
          <IconButton href={BUG_REPORT_URL} target="_blank" color="inherit">
            <SocialGithub />
          </IconButton>
          <IconButton href={TWITTER} target="_blank" color="inherit">
            <SocialTwitter />
          </IconButton>
          <IconButton href={DISCORD} target="_blank" color="inherit">
            <SocialDiscord />
          </IconButton>
        </span>
      </DialogTitle>
      <DialogContent>
        <DialogContentText>How can we make Quadratic better? Reach out, or let us know below:</DialogContentText>

        <TextField
          InputLabelProps={{ shrink: true }}
          id="feedback"
          variant="outlined"
          disabled={isLoading}
          fullWidth
          minRows={4}
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
