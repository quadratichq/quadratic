import { Public } from '@mui/icons-material';
import { Avatar, Button, Dialog, Divider, Paper, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { isOwner as isOwnerTest } from '../actions';
import { apiClient } from '../api/apiClient';
import { ApiTypes, Permission, PublicLinkAccess } from '../api/types';
import ConditionalWrapper from '../ui/components/ConditionalWrapper';
import { useGlobalSnackbar } from './GlobalSnackbarProvider';
import { ShareFileMenuPopover } from './ShareFileMenuPopover';

type ShareOption = {
  label: string;
  value: PublicLinkAccess;
  disabled?: boolean;
};

const shareOptions: ShareOption[] = [
  { label: 'Cannot view', value: 'NOT_SHARED' },
  { label: 'Can view', value: 'READONLY' },
  { label: 'Can edit (coming soon)', value: 'EDIT', disabled: true },
];

type Props = {
  onClose: () => void;
  permission: Permission;
  fileUuid: string;
};

export function ShareFileMenu({ onClose, fileUuid, permission }: Props) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useState<ApiTypes['/v0/files/:uuid/sharing.GET.response'] | null>(null);
  const theme = useTheme();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const owner = data?.owner;
  const public_link_access = data?.public_link_access || 'NOT_SHARED';

  const isShared = public_link_access !== 'NOT_SHARED';
  const isOwner = isOwnerTest(permission);

  useEffect(() => {
    apiClient
      .getFileSharing(fileUuid)
      .then((data) => {
        setIsLoading(false);
        setData(data);
      })
      .catch();
  }, [fileUuid]);

  // TODO
  const setPublicLinkAccess = () => {};

  const handleClickShare = () => {
    const shareLink = window.location.href;
    navigator.clipboard.writeText(shareLink).then(() => {
      addGlobalSnackbar('Link copied to clipboard.');
    });
  };

  return (
    <Dialog open={true} onClose={onClose} fullWidth maxWidth={'sm'} BackdropProps={{ invisible: true }}>
      <Paper elevation={12} sx={{ px: theme.spacing(3), py: theme.spacing(2) }}>
        <Stack gap={theme.spacing(1)}>
          <Row>
            <Public />
            <Typography variant="body2">Anyone with the link</Typography>

            <ConditionalWrapper condition={isLoading} Wrapper={Skeleton}>
              <ShareFileMenuPopover
                value={public_link_access}
                disabled={!isOwner}
                options={shareOptions}
                setValue={setPublicLinkAccess}
              />
            </ConditionalWrapper>
          </Row>
          <Row>
            <ConditionalWrapper
              condition={isLoading}
              Wrapper={({ children }) => <Skeleton variant="circular">{children}</Skeleton>}
            >
              <Avatar alt={owner?.name} src={owner?.picture} sx={{ width: 24, height: 24 }} />
            </ConditionalWrapper>
            <ConditionalWrapper
              condition={isLoading}
              Wrapper={({ children }) => <Skeleton width={160}>{children}</Skeleton>}
            >
              <Typography variant="body2">
                {owner?.name}
                {isOwner && ' (You)'}
              </Typography>
            </ConditionalWrapper>
            <ConditionalWrapper condition={isLoading} Wrapper={Skeleton}>
              <ShareFileMenuPopover
                value={'1'}
                disabled
                options={[{ label: 'Owner', value: '1' }]}
                setValue={() => {}}
              />
            </ConditionalWrapper>
          </Row>
          <Divider />
          <Row sx={{ mt: theme.spacing(1) }}>
            <Typography variant="caption" color="text.secondary">
              View access also allows sharing & duplicating.
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={handleClickShare}
              sx={{ mt: theme.spacing(0), flexShrink: '0' }}
              disabled={isLoading ? true : !isShared}
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
