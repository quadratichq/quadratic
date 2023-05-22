import { useState } from 'react';
import { Button, Dialog, Paper, Switch, TextField, Typography, useTheme } from '@mui/material';
import { useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { Public } from '@mui/icons-material';
import { useLocalFiles } from '../../contexts/LocalFiles';
import { useGlobalSnackbar } from '../../contexts/GlobalSnackbar';
// import { focusGrid } from '../../../helpers/focusGrid';

// import { useGlobalSnackbar } from '../../contexts/GlobalSnackbar';

export function ShareMenu() {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const [isPublic, setIsPublic] = useState(false);
  const onClose = () => {
    setEditorInteractionState((prevState) => ({
      ...prevState,
      showFileMenu: false,
    }));
  };
  const { currentFileId } = useLocalFiles();
  const theme = useTheme();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const shareLink = `https://app.quadratichq.com?share=${currentFileId}`;
  // const styles = getStyles(theme);

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
          <Public fontSize="large" color="disabled" />
          <div>
            <Typography variant="body1">Share publicly</Typography>
            <Typography variant="body2" color={theme.palette.text.secondary}>
              Anyone with link can view or duplicate this sheet
            </Typography>
          </div>
          <Switch sx={{ ml: 'auto' }} checked={isPublic} onChange={() => setIsPublic(!isPublic)} />
        </div>
        {isPublic && (
          <div style={{ display: 'flex', gap: theme.spacing(2), marginTop: theme.spacing(2) }}>
            <TextField
              fullWidth
              InputProps={{
                onClick: (e) => {
                  // console.log(typeof e.target);
                  // // @ts-expect-error
                  // e.target.select();
                },
              }}
              size="small"
              disabled
              id="outlined-disabled"
              defaultValue={shareLink}
            />
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
