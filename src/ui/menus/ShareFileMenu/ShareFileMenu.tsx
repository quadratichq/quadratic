import { Public } from '@mui/icons-material';
import { Avatar, Button, Dialog, Divider, Paper, Stack, Typography, useTheme } from '@mui/material';
import React from 'react';
import { useRecoilState } from 'recoil';
import { GetFileRes } from '../../../api/types';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '../../../components/GlobalSnackbar';
import { focusGrid } from '../../../helpers/focusGrid';
import { useRootRouteLoaderData } from '../../../router';
import { useFileContext } from '../../components/FileProvider';
import { ShareFileMenuPopover } from './ShareFileMenuPopover';

type ShareOption = {
  label: string;
  value: GetFileRes['file']['public_link_access'];
  disabled?: boolean;
};

const shareOptions: ShareOption[] = [
  { label: 'Cannot view', value: 'NOT_SHARED' },
  { label: 'Can view', value: 'READONLY' },
  { label: 'Can edit (coming soon)', value: 'EDIT', disabled: true },
];

export function ShareFileMenu() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { user } = useRootRouteLoaderData();
  const { publicLinkAccess, setPublicLinkAccess } = useFileContext();
  const theme = useTheme();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { permission } = editorInteractionState;

  const onClose = () => {
    setEditorInteractionState((prevState) => ({
      ...prevState,
      showShareFileMenu: false,
    }));
    // TODO get this working, proper focus trapping with modal
    focusGrid();
  };
  // const input = useRef<HTMLInputElement>();
  const shareLink = window.location.href;
  const isShared = publicLinkAccess !== 'NOT_SHARED';

  return (
    <Dialog open={true} onClose={onClose} fullWidth maxWidth={'sm'} BackdropProps={{ invisible: true }}>
      <Paper elevation={12} sx={{ px: theme.spacing(3), py: theme.spacing(2) }}>
        <Stack gap={theme.spacing(1)}>
          <Row>
            <Public />
            <Typography variant="body2">Anyone with the link</Typography>
            <ShareFileMenuPopover
              value={publicLinkAccess}
              disabled={permission === 'VIEWER'}
              options={shareOptions}
              setValue={setPublicLinkAccess}
            />
          </Row>
          {/* TODO what if owner isn't person logged in? */}
          {permission === 'OWNER' && (
            <Row>
              <Avatar alt={user?.name} src={user?.picture} sx={{ width: 24, height: 24 }} />
              <Typography variant="body2">{user?.name} (You)</Typography>
              <ShareFileMenuPopover
                value={'1'}
                disabled
                options={[{ label: 'Owner', value: '1' }]}
                setValue={() => {}}
              />
            </Row>
          )}
          <Divider />
          <Row sx={{ mt: theme.spacing(1) }}>
            <Typography variant="caption" color="text.secondary">
              View access also allows sharing & duplicating.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                navigator.clipboard.writeText(shareLink).then(() => {
                  addGlobalSnackbar('Link copied to clipboard.');
                });
              }}
              sx={{ mt: theme.spacing(0), flexShrink: '0' }}
              disabled={!isShared}
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
