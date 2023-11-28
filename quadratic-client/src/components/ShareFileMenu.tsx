import { Button, Typography, useTheme } from '@mui/material';
import * as Sentry from '@sentry/react';
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { ApiTypes, PublicLinkAccess } from '../api/types';
import { ROUTES } from '../constants/routes';
import { useGlobalSnackbar } from './GlobalSnackbarProvider';
import { QDialog } from './QDialog';
import { ShareMenu } from './ShareMenu';

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
  fileName,
  fetcherUrl,
}: {
  onClose: () => void;
  uuid: string;
  fileName?: string;
  fetcherUrl: string;
}) {
  const theme = useTheme();
  const { addGlobalSnackbar } = useGlobalSnackbar();

  // TODO derive this from global useFetchers()
  const isDisabledCopyShareLink = false;
  // const showSkeletons = Boolean(!fetcher.data?.ok);
  // const publicLinkAccess = fetcher.data?.data?.public_link_access;
  // const isShared = publicLinkAccess && publicLinkAccess !== 'NOT_SHARED';
  // const isDisabledCopyShareLink = showSkeletons ? true : !isShared;

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
      <QDialog.Title>Share{fileName && ` “${fileName}”`}</QDialog.Title>
      <QDialog.Content>
        <ShareMenu fetcherUrl={fetcherUrl} uuid={uuid} />
      </QDialog.Content>
      <QDialog.Actions>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
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
      </QDialog.Actions>
    </QDialog>
  );
}
