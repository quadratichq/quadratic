import { downloadQuadraticFile } from '@/app/helpers/downloadFileInBrowser';
import { generateKeyBetween } from '@/shared/utils/fractionalIndexing';
import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { v4 as uuid } from 'uuid';
import { fetchFromApi } from './fetchFromApi';

const DEFAULT_FILE: any = {
  sheets: [
    {
      name: 'Sheet 1',
      id: { id: uuid() },
      order: generateKeyBetween(null, null),
      cells: [],
      code_cells: [],
      formats: [],
      columns: [],
      rows: [],
      offsets: [[], []],
      borders: {},
    },
  ],
  // TODO(ddimaria): make this dynamic
  version: '1.4',
};

export const apiClient = {
  teams: {
    async list() {
      return fetchFromApi(`/v0/teams`, { method: 'GET' }, ApiSchemas['/v0/teams.GET.response']);
    },
    async get(uuid: string) {
      return fetchFromApi(`/v0/teams/${uuid}`, { method: 'GET' }, ApiSchemas['/v0/teams/:uuid.GET.response']);
    },
    async update(uuid: string, body: ApiTypes['/v0/teams/:uuid.PATCH.request']) {
      return fetchFromApi(
        `/v0/teams/${uuid}`,
        { method: 'PATCH', body: JSON.stringify(body) },
        ApiSchemas['/v0/teams/:uuid.PATCH.response']
      );
    },
    async create(body: ApiTypes['/v0/teams.POST.request']) {
      return fetchFromApi(
        `/v0/teams`,
        { method: 'POST', body: JSON.stringify(body) },
        ApiSchemas['/v0/teams.POST.response']
      );
    },
    billing: {
      async getPortalSessionUrl(uuid: string) {
        return fetchFromApi(
          `/v0/teams/${uuid}/billing/portal/session`,
          { method: 'GET' },
          ApiSchemas['/v0/teams/:uuid/billing/portal/session.GET.response']
        );
      },
      async getCheckoutSessionUrl(uuid: string) {
        return fetchFromApi(
          `/v0/teams/${uuid}/billing/checkout/session`,
          { method: 'GET' },
          ApiSchemas['/v0/teams/:uuid/billing/checkout/session.GET.response']
        );
      },
    },
    invites: {
      async create(uuid: string, body: ApiTypes['/v0/teams/:uuid/invites.POST.request']) {
        return fetchFromApi(
          `/v0/teams/${uuid}/invites`,
          {
            method: 'POST',
            body: JSON.stringify(body),
          },
          ApiSchemas['/v0/teams/:uuid/invites.POST.response']
        );
      },
      async delete(uuid: string, inviteId: string) {
        console.log(`DELETE to /v0/teams/${uuid}/invites/${inviteId}`);
        return fetchFromApi(
          `/v0/teams/${uuid}/invites/${inviteId}`,
          {
            method: 'DELETE',
          },
          ApiSchemas['/v0/teams/:uuid/invites/:inviteId.DELETE.response']
        );
      },
    },
    users: {
      async update(uuid: string, userId: string, body: ApiTypes['/v0/teams/:uuid/users/:userId.PATCH.request']) {
        return fetchFromApi(
          `/v0/teams/${uuid}/users/${userId}`,
          { method: 'PATCH', body: JSON.stringify(body) },
          ApiSchemas['/v0/teams/:uuid/users/:userId.PATCH.response']
        );
      },
      async delete(uuid: string, userId: string) {
        return fetchFromApi(
          `/v0/teams/${uuid}/users/${userId}`,
          { method: 'DELETE' },
          ApiSchemas['/v0/teams/:uuid/users/:userId.DELETE.response']
        );
      },
    },
  },

  files: {
    async list({ shared }: { shared?: 'with-me' } = {}) {
      const url = `/v0/files${shared ? `?shared=${shared}` : ''}`;
      return fetchFromApi(url, { method: 'GET' }, ApiSchemas['/v0/files.GET.response']);
    },
    async get(uuid: string) {
      return fetchFromApi(`/v0/files/${uuid}`, { method: 'GET' }, ApiSchemas['/v0/files/:uuid.GET.response']);
    },
    async create({
      file,
      teamUuid,
      isPrivate,
    }: {
      file?: Pick<ApiTypes['/v0/files.POST.request'], 'name' | 'contents' | 'version'>;
      teamUuid: ApiTypes['/v0/files.POST.request']['teamUuid'];
      isPrivate: ApiTypes['/v0/files.POST.request']['isPrivate'];
    }) {
      if (file === undefined) {
        file = {
          name: 'Untitled',
          contents: JSON.stringify(DEFAULT_FILE),
          version: DEFAULT_FILE.version,
        };
      }
      return fetchFromApi(
        `/v0/files`,
        { method: 'POST', body: JSON.stringify({ ...file, teamUuid, isPrivate }) },
        ApiSchemas['/v0/files.POST.response']
      );
    },
    async delete(uuid: string) {
      mixpanel.track('[Files].deleteFile', { id: uuid });
      return fetchFromApi(`/v0/files/${uuid}`, { method: 'DELETE' }, ApiSchemas['/v0/files/:uuid.DELETE.response']);
    },
    async download(uuid: string) {
      mixpanel.track('[Files].downloadFile', { id: uuid });
      const { file } = await this.get(uuid);
      const checkpointUrl = file.lastCheckpointDataUrl;
      const checkpointData = await fetch(checkpointUrl).then((res) => res.text());
      downloadQuadraticFile(file.name, checkpointData);
    },
    async duplicate(uuid: string, isPrivate?: boolean) {
      mixpanel.track('[Files].duplicateFile', { id: uuid });
      // Get the file we want to duplicate
      const {
        file: { name, lastCheckpointDataUrl, lastCheckpointVersion, thumbnail },
        team,
      } = await apiClient.files.get(uuid);

      // Get the most recent checkpoint for the file
      const lastCheckpointContents = await fetch(lastCheckpointDataUrl).then((res) => res.text());

      // Create it on the server
      const {
        file: { uuid: newFileUuid },
      } = await apiClient.files.create({
        file: {
          name: name + ' (Copy)',
          version: lastCheckpointVersion,
          contents: lastCheckpointContents,
        },
        teamUuid: team.uuid,
        isPrivate,
      });

      // If present, fetch the thumbnail of the file we just dup'd and
      // save it to the new file we just created
      if (thumbnail) {
        try {
          const res = await fetch(thumbnail);
          const blob = await res.blob();
          await apiClient.files.thumbnail.update(newFileUuid, blob);
        } catch (err) {
          // Not a huge deal if it failed, just tell Sentry and move on
          Sentry.captureEvent({
            message: 'Failed to duplicate the thumbnail image when duplicating a file',
            level: 'info',
          });
        }
      }

      return { uuid: newFileUuid };
    },
    async update(uuid: string, body: ApiTypes['/v0/files/:uuid.PATCH.request']) {
      return fetchFromApi(
        `/v0/files/${uuid}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        },
        ApiSchemas['/v0/files/:uuid.PATCH.response']
      );
    },
    thumbnail: {
      async update(uuid: string, thumbnail: Blob) {
        const formData = new FormData();
        formData.append('thumbnail', thumbnail, 'thumbnail.png');

        return fetchFromApi(
          `/v0/files/${uuid}/thumbnail`,
          {
            method: 'POST',
            body: formData,
          },
          ApiSchemas['/v0/files/:uuid/thumbnail.POST.response']
        );
      },
    },
    sharing: {
      async get(uuid: string) {
        return fetchFromApi(
          `/v0/files/${uuid}/sharing`,
          {
            method: 'GET',
          },
          ApiSchemas['/v0/files/:uuid/sharing.GET.response']
        );
      },
      async update(uuid: string, body: ApiTypes['/v0/files/:uuid/sharing.PATCH.request']) {
        mixpanel.track('[FileSharing].publicLinkAccess.update', { value: body.publicLinkAccess });
        return fetchFromApi(
          `/v0/files/${uuid}/sharing`,
          {
            method: 'PATCH',
            body: JSON.stringify(body),
          },
          ApiSchemas['/v0/files/:uuid/sharing.PATCH.response']
        );
      },
    },
    invites: {
      async create(uuid: string, body: ApiTypes['/v0/files/:uuid/invites.POST.request']) {
        mixpanel.track('[FileSharing].invite.create');
        return fetchFromApi(
          `/v0/files/${uuid}/invites`,
          {
            method: 'POST',
            body: JSON.stringify(body),
          },
          ApiSchemas['/v0/files/:uuid/invites.POST.response']
        );
      },
      async delete(uuid: string, inviteId: string) {
        mixpanel.track('[FileSharing].invite.delete');
        return fetchFromApi(
          `/v0/files/${uuid}/invites/${inviteId}`,
          {
            method: 'DELETE',
          },
          ApiSchemas['/v0/files/:uuid/invites/:inviteId.DELETE.response']
        );
      },
    },
    users: {
      async update(uuid: string, userId: string, body: ApiTypes['/v0/files/:uuid/users/:userId.PATCH.request']) {
        mixpanel.track('[FileSharing].users.updateRole');
        return fetchFromApi(
          `/v0/files/${uuid}/users/${userId}`,
          { method: 'PATCH', body: JSON.stringify(body) },
          ApiSchemas['/v0/files/:uuid/users/:userId.PATCH.response']
        );
      },
      async delete(uuid: string, userId: string) {
        mixpanel.track('[FileSharing].users.remove');
        return fetchFromApi(
          `/v0/files/${uuid}/users/${userId}`,
          { method: 'DELETE' },
          ApiSchemas['/v0/files/:uuid/users/:userId.DELETE.response']
        );
      },
    },
  },

  examples: {
    async duplicate(body: ApiTypes['/v0/examples.POST.request']) {
      return fetchFromApi(
        `/v0/examples`,
        { method: 'POST', body: JSON.stringify(body) },
        ApiSchemas['/v0/examples.POST.response']
      );
    },
  },

  users: {
    async acknowledge() {
      return fetchFromApi(`/v0/users/acknowledge`, { method: 'GET' }, ApiSchemas['/v0/users/acknowledge.GET.response']);
    },
  },
  education: {
    async get() {
      return fetchFromApi(`/v0/education`, { method: 'GET' }, ApiSchemas['/v0/education.GET.response']);
    },
    async refresh() {
      return fetchFromApi(`/v0/education`, { method: 'POST' }, ApiSchemas['/v0/education.POST.response']);
    },
  },

  connections: {
    async list(teamUuid: string) {
      return fetchFromApi(
        `/v0/teams/${teamUuid}/connections`,
        { method: 'GET' },
        ApiSchemas['/v0/teams/:uuid/connections.GET.response']
      );
    },
    async get(uuid: string) {
      return fetchFromApi(
        `/v0/connections/${uuid}`,
        { method: 'GET' },
        ApiSchemas['/v0/connections/:uuid.GET.response']
      );
    },
    async create(body: ApiTypes['/v0/team/:uuid/connections.POST.request'], teamUuid: string) {
      return fetchFromApi(
        `/v0/teams/${teamUuid}/connections`,
        { method: 'POST', body: JSON.stringify(body) },
        ApiSchemas['/v0/connections.POST.response']
      );
    },
    async update(uuid: string, body: ApiTypes['/v0/connections/:uuid.PUT.request']) {
      return fetchFromApi(
        `/v0/connections/${uuid}`,
        { method: 'PUT', body: JSON.stringify(body) },
        ApiSchemas['/v0/connections/:uuid.PUT.response']
      );
    },
    async delete(uuid: string) {
      return fetchFromApi(
        `/v0/connections/${uuid}`,
        { method: 'DELETE' },
        ApiSchemas['/v0/connections/:uuid.DELETE.response']
      );
    },
  },

  async postFeedback(body: ApiTypes['/v0/feedback.POST.request']) {
    return fetchFromApi(
      `/v0/feedback`,
      { method: 'POST', body: JSON.stringify(body) },
      ApiSchemas['/v0/feedback.POST.response']
    );
  },

  getApiUrl() {
    const url = import.meta.env.VITE_QUADRATIC_API_URL;
    if (!url) {
      const message = 'VITE_QUADRATIC_API_URL env variable is not set.';
      Sentry.captureEvent({
        message,
        level: 'fatal',
      });
      throw new Error(message);
    }

    return url;
  },

  // Someday: figure out how to fit in the calls for the AI chat
};
