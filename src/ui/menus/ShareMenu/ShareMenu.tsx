import { Public } from '@mui/icons-material';
import { Button, Dialog, Paper, Switch, TextField, Typography, useTheme } from '@mui/material';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
// import { useLocalFiles } from '../../contexts/LocalFiles';
import { focusGrid } from '../../../helpers/focusGrid';
import { useGlobalSnackbar } from '../../../shared/GlobalSnackbar';

export function ShareMenu() {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const onClose = () => {
    setEditorInteractionState((prevState) => ({
      ...prevState,
      showShareMenu: false,
    }));
    // TODO get this working, proper focus trapping with modal
    focusGrid();
  };
  // const input = useRef<HTMLInputElement>();
  // const { file } = useLocalFiles();
  const currentFileIsPublic = false; // TODO
  const theme = useTheme();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const shareLink = window.location.href;

  // https://stackoverflow.com/a/60066291/1339693
  const onRefChange = useCallback((input: HTMLInputElement | null) => {
    if (input !== null) {
      input.focus();
      input.select();
      input.scrollLeft = 0;
    }
  }, []);

  return (
    <Dialog open={true} onClose={onClose} fullWidth maxWidth={'sm'} BackdropProps={{ invisible: true }}>
      <Paper elevation={12} sx={{ p: theme.spacing(2) }}>
        <div
          style={{
            display: 'flex',
            gap: theme.spacing(2),
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Public fontSize="large" color={currentFileIsPublic ? 'inherit' : 'disabled'} />

          <div>
            <Typography variant="body1">Share publicly</Typography>
            <Typography variant="body2" color={theme.palette.text.secondary}>
              Anyone with link can view or duplicate this sheet
            </Typography>
          </div>
          {/* TODO Make this switch styled like the other */}
          <Switch sx={{ ml: 'auto' }} checked={currentFileIsPublic} onChange={() => {}} />
        </div>
        {currentFileIsPublic && (
          <div style={{ display: 'flex', gap: theme.spacing(2), marginTop: theme.spacing(2) }}>
            <TextField inputRef={onRefChange} fullWidth size="small" id="outlined-disabled" defaultValue={shareLink} />
            <Button
              style={{ flexShrink: '0' }}
              onClick={() => {
                navigator.clipboard.writeText(shareLink).then(() => {
                  addGlobalSnackbar('Link copied to clipboard.');
                });
              }}
            >
              Copy link
            </Button>
          </div>
        )}
      </Paper>
    </Dialog>
  );
}
