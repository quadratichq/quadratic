import { Button, IconButton, Stack, TextField } from '@mui/material';
import { useTheme } from '@mui/system';
import { useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { apiClient } from '../../../api/apiClient';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '../../../components/GlobalSnackbarProvider';
import { QDialog } from '../../../components/QDialog';
import { BUG_REPORT_URL, DISCORD, TWITTER } from '../../../constants/urls';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { useRootRouteLoaderData } from '../../../router';
import focusInput from '../../../utils/focusInput';
import { SocialDiscord, SocialGithub, SocialTwitter } from '../../icons';

export const FeedbackMenu = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  // We'll keep the user's state around unless they explicitly cancel or get a successful submit
  const [value, setValue] = useLocalStorage('feedback-message', '');
  const [loadState, setLoadState] = useState<'INITIAL' | 'LOADING' | 'LOAD_ERROR'>('INITIAL');
  const theme = useTheme();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { user } = useRootRouteLoaderData();

  const closeMenu = () => {
    setEditorInteractionState((state) => ({
      ...state,
      showFeedbackMenu: false,
    }));
  };

  const onSubmit = async () => {
    setLoadState('LOADING');
    try {
      await apiClient.postFeedback({ feedback: value, userEmail: user?.email });
      setValue('');
      closeMenu();
      addGlobalSnackbar('Feedback submitted! Thank you.');
    } catch (error) {
      setLoadState('LOAD_ERROR');
    }
  };

  const isLoading = loadState === 'LOADING';
  const hasError = loadState === 'LOAD_ERROR';

  return (
    <QDialog onClose={closeMenu}>
      <QDialog.Title>Provide feedback</QDialog.Title>
      <QDialog.Content>
        <TextField
          aria-label="Feedback"
          placeholder="Please make Quadratic better by..."
          InputLabelProps={{ shrink: true }}
          InputProps={{ sx: { fontSize: '.875rem' } }}
          inputRef={focusInput}
          id="feedback"
          variant="outlined"
          disabled={isLoading}
          fullWidth
          minRows={4}
          multiline
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
      </QDialog.Content>
      <QDialog.Actions>
        <Stack direction="row" alignItems="center" gap={theme.spacing(1)} mr="auto">
          <IconButton href={BUG_REPORT_URL} target="_blank" color={theme.palette.text.secondary} size="small">
            <SocialGithub />
          </IconButton>
          <IconButton href={TWITTER} target="_blank" color={theme.palette.text.secondary} size="small">
            <SocialTwitter />
          </IconButton>
          <IconButton href={DISCORD} target="_blank" color={theme.palette.text.secondary} size="small">
            <SocialDiscord />
          </IconButton>
        </Stack>
        <Stack direction="row" gap={theme.spacing(1)}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setValue('');
              closeMenu();
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={onSubmit}
            disabled={value.length === 0 || isLoading}
            disableElevation
          >
            {isLoading ? 'Submitting…' : 'Submit'}
          </Button>
        </Stack>
      </QDialog.Actions>
    </QDialog>
  );
};
