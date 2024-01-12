import { apiClient } from '@/api/apiClient';
import { Loader as FilesLoader } from '@/routes/files';
import * as Sentry from '@sentry/react';
import { ActionFunctionArgs } from 'react-router-dom';

export const loader = async () => null;

export type Action = {
  response: { ok: boolean } | null;
  'request.delete': {
    action: 'delete';
  };
  'request.download': {
    action: 'download';
  };
  'request.duplicate': {
    action: 'duplicate';
    file: FilesLoader[0];
  };
  'request.rename': {
    action: 'rename';
    name: string;
  };
  request:
    | Action['request.delete']
    | Action['request.download']
    | Action['request.duplicate']
    | Action['request.rename'];
};

export const action = async ({ params, request }: ActionFunctionArgs): Promise<Action['response']> => {
  const json: Action['request'] = await request.json();
  const { uuid } = params as { uuid: string };
  const { action } = json;

  if (action === 'delete') {
    try {
      await apiClient.files.delete(uuid);
      return { ok: true };
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
      const {
        file: { name },
      } = json as Action['request.duplicate'];

      // Get the file we want to duplicate
      const {
        file: { thumbnail },
        file,
      } = await apiClient.files.get(uuid);

      // Get the most recent checkpoint for the file
      const lastCheckpointContents = await fetch(file.lastCheckpointDataUrl).then((res) => res.text());

      // Create it on the server
      const newFile = await apiClient.files.create({
        name,
        version: file.lastCheckpointVersion,
        contents: lastCheckpointContents,
      });

      // If present, fetch the thumbnail of the file we just dup'd and
      // save it to the new file we just created
      if (thumbnail) {
        try {
          const res = await fetch(thumbnail);
          const blob = await res.blob();
          await apiClient.files.thumbnail.update(newFile.uuid, blob);
        } catch (err) {
          // Not a huge deal if it failed, just tell Sentry and move on
          Sentry.captureEvent({
            message: 'Failed to duplicate the thumbnail image when duplicating a file',
            level: 'info',
          });
        }
      }
      return { ok: true };
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

  return null;
};
