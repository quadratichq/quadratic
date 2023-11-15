import { TYPE } from '@/constants/appConstants';
import { Button } from '@/shadcn/ui/button';
import { Public } from '@mui/icons-material';
import { Alert, Avatar, Skeleton, SkeletonProps, Stack, Typography, useTheme } from '@mui/material';
import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { ActionFunctionArgs, LoaderFunctionArgs, useFetcher } from 'react-router-dom';
import { isOwner as isOwnerTest } from '../actions';
import { apiClient } from '../api/apiClient';
import { ApiTypes, Permission, PublicLinkAccess } from '../api/types';
import { ROUTES } from '../constants/routes';
import ConditionalWrapper from '../ui/components/ConditionalWrapper';
import { useGlobalSnackbar } from './GlobalSnackbarProvider';
import { QDialog } from './QDialog';
import { ShareFileMenuPopover } from './ShareFileMenuPopover';

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

type Action = {
  response: { ok: boolean } | null;
  'request.update-public-link-access': {
    action: 'update-public-link-access';
    uuid: string;
    public_link_access: PublicLinkAccess;
  };
  // In the future, we'll have other updates here like updating an individual
  // user's permissions for the file
  request: Action['request.update-public-link-access'];
};
export const action = async ({ request, params }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
  const { action, uuid } = json;

  if (action === 'update-public-link-access') {
    const { public_link_access } = json as Action['request.update-public-link-access'];
    try {
      await apiClient.updateFileSharing(uuid, { public_link_access });
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  }

  return null;
};

export function ShareFileMenu({
  onClose,
  uuid,
  permission,
  fileName,
}: {
  onClose: () => void;
  permission: Permission;
  uuid: string;
  fileName?: string;
}) {
  const theme = useTheme();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const fetcher = useFetcher<LoaderData>();

  // On the initial mount, load the data
  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(ROUTES.API_FILE_SHARING(uuid));
    }
  }, [fetcher, uuid]);

  const showSkeletons = Boolean(!fetcher.data?.ok);
  const animation = fetcher.state !== 'idle' ? 'pulse' : false;
  const owner = fetcher.data?.data?.owner;
  const publicLinkAccess = fetcher.data?.data?.public_link_access;
  const isShared = publicLinkAccess && publicLinkAccess !== 'NOT_SHARED';
  const isOwner = isOwnerTest(permission);
  const isDisabledCopyShareLink = showSkeletons ? true : !isShared;
  const showLoadingError = fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok;

  const handleCopyShareLink = () => {
    const shareLink = window.location.origin + ROUTES.FILE(uuid);
    navigator.clipboard
      .writeText(shareLink)
      .then(() => {
        addGlobalSnackbar('Link copied to clipboard.');
      })
      .catch((e) => {
        Sentry.captureEvent({
          message: 'Failed to copy share link to user’s clipboard.',
          level: 'info',
        });
        addGlobalSnackbar('Failed to copy link.', { severity: 'error' });
      });
  };

  return (
    <QDialog onClose={onClose}>
      <QDialog.Title description={'File: ' + fileName}>Share</QDialog.Title>
      <QDialog.Content>
        <Stack gap={theme.spacing(1)} direction="column">
          {showLoadingError && (
            <Alert
              severity="error"
              action={
                <Button
                  onClick={() => {
                    fetcher.load(ROUTES.API_FILE_SHARING(uuid));
                  }}
                >
                  Reload
                </Button>
              }
              sx={{
                // Align the alert so it's icon/button match each row item
                px: theme.spacing(3),
                mx: theme.spacing(-3),
              }}
            >
              Failed to retrieve sharing info. Try reloading.
            </Alert>
          )}

          <Row>
            <PublicLink
              showSkeletons={showSkeletons}
              animation={animation}
              publicLinkAccess={publicLinkAccess}
              isOwner={isOwner}
              uuid={uuid}
            />
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
        </Stack>
      </QDialog.Content>

      <QDialog.Actions>
        <p className={`${TYPE.caption} mr-auto text-muted-foreground`}>
          View access also allows sharing & duplicating.
        </p>
        <Button
          variant="outline"
          size={'sm'}
          onClick={handleCopyShareLink}
          className={`flex-shrink-0`}
          disabled={isDisabledCopyShareLink}
        >
          Copy share link
        </Button>
      </QDialog.Actions>
    </QDialog>
  );
}

const shareOptions: Array<{
  label: string;
  value: PublicLinkAccess;
  disabled?: boolean;
}> = [
  { label: 'Cannot view', value: 'NOT_SHARED' },
  { label: 'Can view', value: 'READONLY' },
  { label: 'Can edit (coming soon)', value: 'EDIT', disabled: true },
];

function PublicLink({
  showSkeletons,
  animation,
  publicLinkAccess,
  isOwner,
  uuid,
}: {
  showSkeletons: boolean;
  animation: SkeletonProps['animation'];
  publicLinkAccess: PublicLinkAccess | undefined;
  isOwner: boolean;
  uuid: string;
}) {
  const fetcher = useFetcher();

  // If we don’t have the value, assume 'not shared' by default because we need
  // _some_ value for the popover
  let public_link_access = publicLinkAccess ? publicLinkAccess : 'NOT_SHARED';
  // If we're updating, optimistically show the next value
  if (fetcher.json) {
    public_link_access = (fetcher.json as Action['request.update-public-link-access']).public_link_access;
  }

  const setPublicLinkAccess = async (newValue: PublicLinkAccess) => {
    const data: Action['request.update-public-link-access'] = {
      action: 'update-public-link-access',
      uuid: uuid,
      public_link_access: newValue,
    };
    fetcher.submit(data, {
      method: 'POST',
      action: ROUTES.API_FILE_SHARING(uuid),
      encType: 'application/json',
    });
  };

  return (
    <>
      <Public />
      <Stack>
        <Typography variant="body2">Anyone with the link</Typography>
        {fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok && !showSkeletons && (
          <Typography variant="caption" color="error">
            Failed to update
          </Typography>
        )}
      </Stack>

      <ConditionalWrapper condition={showSkeletons} Wrapper={SkeletonWrapper({ animation })}>
        <ShareFileMenuPopover
          value={public_link_access}
          disabled={!isOwner}
          options={shareOptions}
          setValue={setPublicLinkAccess}
        />
      </ConditionalWrapper>
    </>
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
      gap={theme.spacing(1.5)}
      sx={{ '> :last-child': { marginLeft: 'auto' }, ...sx }}
    >
      {children}
    </Stack>
  );
}
