import { Public } from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Button,
  Dialog,
  Divider,
  Paper,
  Skeleton,
  SkeletonProps,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import * as Sentry from '@sentry/browser';
import { useEffect } from 'react';
import { ActionFunctionArgs, LoaderFunctionArgs, useFetcher } from 'react-router-dom';
import { isOwner as isOwnerTest } from '../actions';
import { apiClient } from '../api/apiClient';
import { ApiTypes, Permission, PublicLinkAccess } from '../api/types';
import ConditionalWrapper from '../ui/components/ConditionalWrapper';
import { useGlobalSnackbar } from './GlobalSnackbarProvider';
import { ShareFileMenuPopover } from './ShareFileMenuPopover';

type LoadState = 'LOADING' | 'LOADED' | 'LOAD_ERROR' | 'UPDATE_ERROR';

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

type LoaderData = {
  ok: boolean;
  data?: ApiTypes['/v0/files/:uuid/sharing.GET.response'];
};
export const loader = async ({ params }: LoaderFunctionArgs): Promise<LoaderData> => {
  const { uuid } = params as { uuid: string };

  try {
    const data = await apiClient.getFileSharing(uuid);
    return { ok: true, data };
  } catch (e) {
    return { ok: false };
  }
};
type ActionRequestJson = {
  public_link_access: PublicLinkAccess;
};
type ActionResponseData = {
  ok: boolean;
};
export const action = async ({ request, params }: ActionFunctionArgs): Promise<ActionResponseData> => {
  const { public_link_access }: ActionRequestJson = await request.json();
  const { uuid } = params as { uuid: string };

  try {
    await apiClient.updateFileSharing(uuid, { public_link_access });
    return { ok: true };
  } catch (e) {
    return { ok: false };
  }
};

export function ShareFileMenu({
  onClose,
  fileUuid,
  permission,
}: {
  onClose: () => void;
  permission: Permission;
  fileUuid: string;
}) {
  const theme = useTheme();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const fetcherGet = useFetcher<LoaderData>();
  const fetcherUpdate = useFetcher<ActionResponseData>();

  // The 4 states we account for in this component
  let loadState: LoadState = 'LOADING';
  if (fetcherUpdate.data && !fetcherUpdate.data.ok) {
    loadState = 'UPDATE_ERROR';
  } else if (fetcherGet.data && fetcherGet.data.ok) {
    loadState = 'LOADED';
  } else if (fetcherGet.data && !fetcherGet.data.ok) {
    loadState = 'LOAD_ERROR';
  }

  // On the initial mount, load the data
  useEffect(() => {
    if (fetcherGet.state === 'idle' && !fetcherGet.data) {
      fetcherGet.load(`/api/files/${fileUuid}/sharing`);
    }
  }, [fetcherGet, fileUuid]);

  // If we ended up with a load state error, log it to sentry
  useEffect(() => {
    if (loadState === 'LOAD_ERROR' || loadState === 'UPDATE_ERROR') {
      Sentry.captureEvent({
        message: `Failed to load/update data in the file share menu.`,
        level: Sentry.Severity.Error,
      });
    }
  }, [loadState]);

  // Assume not shared by default
  let public_link_access = 'NOT_SHARED';
  // If we're updating, optimistically show the next value
  if (fetcherUpdate.json) {
    public_link_access = (fetcherUpdate.json as ActionRequestJson).public_link_access;
    // Otherwise show the current alue
  } else if (fetcherGet.data && fetcherGet.data.data && fetcherGet.data.data.public_link_access) {
    public_link_access = fetcherGet.data.data.public_link_access;
  }
  const showSkeletons = loadState !== 'LOADED';
  const animation = loadState === 'LOADING' ? 'pulse' : false;
  const owner = fetcherGet.data?.data?.owner;
  const isShared = public_link_access !== 'NOT_SHARED';
  const isOwner = isOwnerTest(permission);
  const isDisabledCopyShareLink = showSkeletons ? true : !isShared;

  const setPublicLinkAccess = async (newValue: PublicLinkAccess) => {
    const data: ActionRequestJson = {
      public_link_access: newValue,
    };
    fetcherUpdate.submit(data, {
      method: 'POST',
      action: `/api/files/${fileUuid}/sharing`,
      encType: 'application/json',
    });
  };

  const handleCopyShareLink = () => {
    const shareLink = window.location.href;
    navigator.clipboard.writeText(shareLink).then(() => {
      addGlobalSnackbar('Link copied to clipboard.');
    });
  };

  console.log('fetcherGet', fetcherGet);

  return (
    <Dialog open={true} onClose={onClose} fullWidth maxWidth={'sm'} BackdropProps={{ invisible: true }}>
      <Paper elevation={12} sx={{ px: theme.spacing(3), py: theme.spacing(2) }}>
        <Stack gap={theme.spacing(1)}>
          {(loadState === 'LOAD_ERROR' || loadState === 'UPDATE_ERROR') && (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    console.log('fired');
                    fetcherGet.load(`/api/files/${fileUuid}/sharing`);
                    fetcherUpdate.submit(null, { action: '/api/reset-fetcher', method: 'POST' });
                    // console.log(fetcherGet);
                  }}
                >
                  Reload
                </Button>
              }
            >
              Failed to {loadState === 'LOAD_ERROR' ? 'load' : 'update'} sharing info. Try reloading.
            </Alert>
          )}

          <Row>
            <Public />
            <Typography variant="body2">Anyone with the link</Typography>

            <ConditionalWrapper condition={showSkeletons} Wrapper={SkeletonWrapper({ animation })}>
              <ShareFileMenuPopover
                value={public_link_access}
                disabled={!isOwner}
                options={shareOptions}
                setValue={setPublicLinkAccess}
              />
            </ConditionalWrapper>
          </Row>
          <Row>
            <ConditionalWrapper condition={showSkeletons} Wrapper={SkeletonWrapper({ animation, variant: 'circular' })}>
              <Avatar alt={owner?.name} src={owner?.picture} sx={{ width: 24, height: 24 }} />
            </ConditionalWrapper>
            <ConditionalWrapper condition={showSkeletons} Wrapper={SkeletonWrapper({ animation, width: 160 })}>
              <Typography variant="body2">
                {owner?.name}
                {isOwner && ' (You)'}
              </Typography>
            </ConditionalWrapper>
            <ConditionalWrapper condition={showSkeletons} Wrapper={SkeletonWrapper({ animation })}>
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
              onClick={handleCopyShareLink}
              sx={{ mt: theme.spacing(0), flexShrink: '0' }}
              disabled={isDisabledCopyShareLink}
            >
              Copy share link
            </Button>
          </Row>
        </Stack>
      </Paper>
    </Dialog>
  );
}

function SkeletonWrapper({ ...skeltonProps }: SkeletonProps) {
  return ({ children }: { children: React.ReactNode }) => <Skeleton {...skeltonProps}>{children}</Skeleton>;
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
