import { Public } from '@mui/icons-material';
import { Avatar, Button, Dialog, Divider, Paper, Stack, Typography, useTheme } from '@mui/material';
import React, { useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '../../../components/GlobalSnackbar';
import { focusGrid } from '../../../helpers/focusGrid';
import { useRootRouteLoaderData } from '../../../router';
import { ShareFileMenuPopover } from './ShareFileMenuPopover';

const shareOptions = [
  { label: 'Cannot view', value: '1' },
  { label: 'Can view', value: '2' },
  { label: 'Can edit (coming soon)', value: '3', disabled: true },
];

export function ShareFileMenu() {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const [value, setValue] = useState<string>('1');
  const { user } = useRootRouteLoaderData();
  const onClose = () => {
    setEditorInteractionState((prevState) => ({
      ...prevState,
      showShareFileMenu: false,
    }));
    // TODO get this working, proper focus trapping with modal
    focusGrid();
  };
  // const input = useRef<HTMLInputElement>();

  const theme = useTheme();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const shareLink = window.location.href;

  // https://stackoverflow.com/a/60066291/1339693
  // const onRefChange = useCallback((input: HTMLInputElement | null) => {
  //   if (input !== null) {
  //     input.focus();
  //     input.select();
  //     input.scrollLeft = 0;
  //   }
  // }, []);

  const isShareable = value === shareOptions[1].value;

  return (
    <Dialog open={true} onClose={onClose} fullWidth maxWidth={'sm'} BackdropProps={{ invisible: true }}>
      <Paper elevation={12} sx={{ px: theme.spacing(3), py: theme.spacing(2) }}>
        <Stack gap={theme.spacing(1)}>
          <Row>
            <Public />
            <Typography variant="body2">Anyone with the link</Typography>
            <ShareFileMenuPopover value={value} options={shareOptions} setValue={setValue} />
          </Row>
          <Row>
            <Avatar alt={user?.name} src={user?.picture} sx={{ width: 24, height: 24 }} />
            <Typography variant="body2">John Doe (You, TODO)</Typography>
            <ShareFileMenuPopover value={'1'} disabled options={[{ label: 'Owner', value: '1' }]} setValue={() => {}} />
          </Row>
          <Divider />
          <Row sx={{ mt: theme.spacing(1) }}>
            <Typography variant="body2" color="text.secondary">
              View access also allows sharing & duplicating.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              // disabled={currentFileIsPublic}
              onClick={() => {
                navigator.clipboard.writeText(shareLink).then(() => {
                  addGlobalSnackbar('Link copied to clipboard.');
                });
              }}
              sx={{ mt: theme.spacing(0), flexShrink: '0' }}
              disabled={!isShareable}
            >
              Copy share link
            </Button>
          </Row>
        </Stack>
      </Paper>
    </Dialog>
  );
}

function Row({ children, sx }: { children: React.ReactNode; sx?: any }) {
  const theme = useTheme();
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={theme.spacing(2)}
      sx={{ '> :last-child': { marginLeft: 'auto' }, ...sx }}
    >
      {children}
    </Stack>
  );
}
