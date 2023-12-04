import { TYPE } from '@/constants/appConstants';
import { Button } from '@/shadcn/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shadcn/ui/dialog';
import * as Sentry from '@sentry/react';
import { ApiTypes, PublicLinkAccess } from 'quadratic-shared/typesAndSchemas';
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { ROUTES } from '../constants/routes';
import { useGlobalSnackbar } from './GlobalSnackbarProvider';
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share file</DialogTitle>
          <DialogDescription>{fileName}</DialogDescription>
        </DialogHeader>
        <div>
          <ShareMenu fetcherUrl={fetcherUrl} uuid={uuid} />
          <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
            {/* <Input value={window.location.href} readOnly /> */}
            <p className={`${TYPE.caption} mr-auto text-muted-foreground`}>
              View access also allows sharing & duplicating.
            </p>
            <Button
              variant="secondary"
              className={`flex-shrink-0`}
              onClick={handleCopyShareLink}
              disabled={isDisabledCopyShareLink}
            >
              Copy link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
