import { aiAnalystOfflineChats } from '@/app/ai/offline/aiAnalystChats';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import type { ActionFunctionArgs} from 'react-router-dom';
import { redirectDocument } from 'react-router-dom';

export const loader = async () => null;

export type Action = {
  response: { ok: boolean } | null;
  'request.delete': ReturnType<typeof getActionFileDelete>;
  'request.download': {
    action: 'download';
  };
  'request.duplicate': ReturnType<typeof getActionFileDuplicate>;
  'request.move': ReturnType<typeof getActionFileMove>;
  'request.rename': {
    action: 'rename';
    name: string;
  };
  request:
    | Action['request.delete']
    | Action['request.download']
    | Action['request.duplicate']
    | Action['request.move']
    | Action['request.rename'];
};

export const action = async ({ params, request }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
  const { uuid } = params as { uuid: string };
  const { action } = json;

  if (action === 'delete') {
    try {
      const { userEmail, redirect } = json;
      await Promise.all([aiAnalystOfflineChats.deleteFile(userEmail, uuid), apiClient.files.delete(uuid)]);
      return redirect ? redirectDocument('/') : { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  if (action === 'download') {
    try {
      await apiClient.files.download(uuid);
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  if (action === 'duplicate') {
    try {
      const { redirect, isPrivate } = json as Action['request.duplicate'];
      const { uuid: newFileUuid } = await apiClient.files.duplicate(uuid, isPrivate);
      return redirect ? redirectDocument(ROUTES.FILE(newFileUuid)) : { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  if (action === 'rename') {
    try {
      const { name } = json as Action['request.rename'];
      await apiClient.files.update(uuid, { name });
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  if (action === 'move') {
    try {
      const { ownerUserId } = json as Action['request.move'];
      await apiClient.files.update(uuid, { ownerUserId });
      return { ok: true };
    } catch (error) {
      return { ok: false };
    }
  }

  return null;
};

/**
 * @param ownerUserId - The ID of the user where you want to move the file
 * (as a private file on the team). `null` moves it to the team's public files.
 * @returns
 */
export const getActionFileMove = (ownerUserId: number | null) => {
  return {
    action: 'move' as const,
    ownerUserId,
  };
};

/**
 * @param {Object} args
 * @param {boolean} args.redirect - Whether to redirect the user to the new file after duplication
 * @param {boolean} args.isPrivate - Whether the file is private to the user on the team where its created
 * @returns
 */
export const getActionFileDuplicate = ({ isPrivate, redirect }: { isPrivate: boolean; redirect: boolean }) => {
  return {
    action: 'duplicate' as const,
    isPrivate,
    redirect,
  };
};

export const getActionFileDelete = ({ userEmail, redirect }: { userEmail: string; redirect: boolean }) => {
  return {
    action: 'delete' as const,
    userEmail,
    redirect,
  };
};
