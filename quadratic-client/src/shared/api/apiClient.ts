import { downloadQuadraticFile } from '@/app/helpers/downloadFileInBrowser';
import { ApiError, fetchFromApi } from '@/shared/api/fetchFromApi';
import { xhrFromApi } from '@/shared/api/xhrFromApi';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { captureEvent } from '@sentry/react';
import { Buffer } from 'buffer';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';

// This should match the current version in quadratic-core/src/grid/file/mod.rs
const FILE_VERSION = '1.12';

export const apiClient = {
  teams: {
    list() {
      return fetchFromApi(`/v0/teams`, { method: 'GET' }, ApiSchemas['/v0/teams.GET.response']);
    },
    async get(uuid: string, options?: { updateBilling?: boolean }) {
      const queryParams = new URLSearchParams();
      if (options?.updateBilling) {
        queryParams.set('updateBilling', 'true');
      }
      const queryString = queryParams.toString();
      const url = `/v0/teams/${uuid}${queryString ? `?${queryString}` : ''}`;
      const response = await fetchFromApi(url, { method: 'GET' }, ApiSchemas['/v0/teams/:uuid.GET.response']);

      if (response.license.status === 'revoked') {
        throw new ApiError('License Revoked', 402, undefined);
      }

      return response;
    },
    update(uuid: string, body: ApiTypes['/v0/teams/:uuid.PATCH.request']) {
      return fetchFromApi(
        `/v0/teams/${uuid}`,
        { method: 'PATCH', body: JSON.stringify(body) },
        ApiSchemas['/v0/teams/:uuid.PATCH.response']
      );
    },
    create() {
      return fetchFromApi(
        `/v0/teams`,
        { method: 'POST', body: JSON.stringify({ name: 'My Team' }) },
        ApiSchemas['/v0/teams.POST.response']
      );
    },
    billing: {
      getPortalSessionUrl(uuid: string) {
        return fetchFromApi(
          `/v0/teams/${uuid}/billing/portal/session`,
          { method: 'GET' },
          ApiSchemas['/v0/teams/:uuid/billing/portal/session.GET.response']
        );
      },
      getCheckoutSessionUrl(uuid: string, redirectUrlSuccess: string, redirectUrlCancel: string) {
        return fetchFromApi(
          `/v0/teams/${uuid}/billing/checkout/session?redirect-success=${encodeURIComponent(redirectUrlSuccess)}&redirect-cancel=${encodeURIComponent(redirectUrlCancel)}`,
          { method: 'GET' },
          ApiSchemas['/v0/teams/:uuid/billing/checkout/session.GET.response']
        );
      },
      retentionDiscount: {
        async get(uuid: string) {
          return fetchFromApi(
            `/v0/teams/${uuid}/billing/retention-discount`,
            { method: 'GET' },
            ApiSchemas['/v0/teams/:uuid/billing/retention-discount.GET.response']
          );
        },
        async create(uuid: string) {
          return fetchFromApi(
            `/v0/teams/${uuid}/billing/retention-discount`,
            { method: 'POST' },
            ApiSchemas['/v0/teams/:uuid/billing/retention-discount.POST.response']
          );
        },
      },
      async aiUsage(uuid: string) {
        const data = await fetchFromApi(
          `/v0/teams/${uuid}/billing/ai/usage`,
          { method: 'GET' },
          ApiSchemas['/v0/teams/:uuid/billing/ai/usage.GET.response']
        );

        return data;
      },
    },
    files: {
      deleted: {
        list(teamUuid: string) {
          return fetchFromApi(
            `/v0/teams/${teamUuid}/files/deleted`,
            { method: 'GET' },
            ApiSchemas['/v0/teams/:uuid/files/deleted.GET.response']
          );
        },
      },
    },
    invites: {
      create(uuid: string, body: ApiTypes['/v0/teams/:uuid/invites.POST.request']) {
        return fetchFromApi(
          `/v0/teams/${uuid}/invites`,
          {
            method: 'POST',
            body: JSON.stringify(body),
          },
          ApiSchemas['/v0/teams/:uuid/invites.POST.response']
        );
      },
      delete(uuid: string, inviteId: string) {
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
      update(uuid: string, userId: string, body: ApiTypes['/v0/teams/:uuid/users/:userId.PATCH.request']) {
        return fetchFromApi(
          `/v0/teams/${uuid}/users/${userId}`,
          { method: 'PATCH', body: JSON.stringify(body) },
          ApiSchemas['/v0/teams/:uuid/users/:userId.PATCH.response']
        );
      },
      delete(uuid: string, userId: string) {
        return fetchFromApi(
          `/v0/teams/${uuid}/users/${userId}`,
          { method: 'DELETE' },
          ApiSchemas['/v0/teams/:uuid/users/:userId.DELETE.response']
        );
      },
    },
    fileLimit(uuid: string) {
      return fetchFromApi(
        `/v0/teams/${uuid}/file-limit`,
        { method: 'GET' },
        ApiSchemas['/v0/teams/:uuid/file-limit.GET.response']
      );
    },
  },

  files: {
    list({ shared }: { shared?: 'with-me' } = {}) {
      const url = `/v0/files${shared ? `?shared=${shared}` : ''}`;
      return fetchFromApi(url, { method: 'GET' }, ApiSchemas['/v0/files.GET.response']);
    },
    async get(uuid: string, options?: { updateBilling?: boolean }) {
      const queryParams = new URLSearchParams();
      if (options?.updateBilling) {
        queryParams.set('updateBilling', 'true');
      }
      const queryString = queryParams.toString();
      const url = `/v0/files/${uuid}${queryString ? `?${queryString}` : ''}`;
      let response = await fetchFromApi(url, { method: 'GET' }, ApiSchemas['/v0/files/:uuid.GET.response']);

      if (response.license.status === 'revoked') {
        throw new ApiError('License Revoked', 402, undefined);
      }

      return response;
    },
    create({
      file,
      teamUuid,
      isPrivate,
      abortController,
      onUploadProgress,
    }: {
      // TODO(ddimaria): remove Partial and "contents" once we duplicate directly on S3
      file?: Partial<Pick<ApiTypes['/v0/files.POST.request'], 'name' | 'contents' | 'version'>>;
      teamUuid: ApiTypes['/v0/files.POST.request']['teamUuid'];
      isPrivate: ApiTypes['/v0/files.POST.request']['isPrivate'];
      abortController?: AbortController;
      onUploadProgress?: (uploadProgress: number) => void;
    }) {
      if (file === undefined) {
        file = {
          name: 'Untitled',
          version: FILE_VERSION,
        };
      }

      return xhrFromApi(
        `/v0/files`,
        {
          method: 'POST',
          data: { ...file, teamUuid, isPrivate },
          abortController,
          onUploadProgress,
        },
        ApiSchemas['/v0/files.POST.response']
      );
    },

    delete(uuid: string) {
      trackEvent('[Files].deleteFile', { id: uuid });
      return fetchFromApi(`/v0/files/${uuid}`, { method: 'DELETE' }, ApiSchemas['/v0/files/:uuid.DELETE.response']);
    },

    restore(fileUuid: string) {
      return fetchFromApi(
        `/v0/files/${fileUuid}/restore`,
        { method: 'POST' },
        ApiSchemas['/v0/files/:uuid/restore.POST.response']
      );
    },

    async download(uuid: string, args: { checkpointDataUrl?: string } = {}) {
      // Get file info from the server
      const { file } = await this.get(uuid);
      const name = file.name;
      const checkpointDataUrl = args.checkpointDataUrl ?? file.lastCheckpointDataUrl;

      // Download the file from the server, then save it through the browser
      const checkpointData = await fetch(checkpointDataUrl).then((res) => res.arrayBuffer());
      downloadQuadraticFile(name, new Uint8Array(checkpointData));
    },

    async duplicate(
      uuid: string,
      args: { teamUuid: string; isPrivate: boolean; checkpoint?: { dataUrl: string; version: string } }
    ) {
      // Get the file we want to duplicate
      const {
        file: { name, lastCheckpointDataUrl, lastCheckpointVersion, thumbnail },
      } = await apiClient.files.get(uuid);

      // Get the file checkpoint we’re downloading (the latest if not specified)
      const checkpointVersion = args.checkpoint ? args.checkpoint.version : lastCheckpointVersion;
      const checkpointDataUrl = args.checkpoint ? args.checkpoint.dataUrl : lastCheckpointDataUrl;
      const lastCheckpointContents = await fetch(checkpointDataUrl).then((res) => res.arrayBuffer());
      const buffer = new Uint8Array(lastCheckpointContents);
      const contents = Buffer.from(new Uint8Array(buffer)).toString('base64');

      // Create file on the server
      const {
        file: { uuid: newFileUuid },
      } = await apiClient.files.create({
        file: {
          name: name + ' (Copy)',
          version: checkpointVersion,
          contents,
        },
        teamUuid: args.teamUuid,
        isPrivate: args.isPrivate,
      });

      // If we duplicated the latest checkpoint of the file, we'll copy its
      // thumbnail to the file we just created
      if (!args.checkpoint && thumbnail) {
        try {
          const res = await fetch(thumbnail);
          const blob = await res.blob();
          await apiClient.files.thumbnail.update(newFileUuid, blob);
        } catch (err) {
          // Not a huge deal if it failed, just tell Sentry and move on
          captureEvent({
            message: 'Failed to duplicate the thumbnail image when duplicating a file',
            level: 'info',
          });
        }
      }

      return { uuid: newFileUuid };
    },

    update(uuid: string, body: ApiTypes['/v0/files/:uuid.PATCH.request']) {
      return fetchFromApi(
        `/v0/files/${uuid}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        },
        ApiSchemas['/v0/files/:uuid.PATCH.response']
      );
    },

    checkpoints: {
      list(uuid: string) {
        return fetchFromApi(
          `/v0/files/${uuid}/checkpoints`,
          { method: 'GET' },
          ApiSchemas['/v0/files/:uuid/checkpoints.GET.response']
        );
      },
      getBySequenceNumber(uuid: string, sequenceNumber: number) {
        return fetchFromApi(
          `/v0/files/${uuid}/checkpoints/sequences/${sequenceNumber}`,
          { method: 'GET' },
          ApiSchemas['/v0/files/:uuid/checkpoints/sequences/:sequenceNumber.GET.response']
        );
      },
    },

    thumbnail: {
      update(uuid: string, thumbnail: Blob) {
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
      get(uuid: string) {
        return fetchFromApi(
          `/v0/files/${uuid}/sharing`,
          {
            method: 'GET',
          },
          ApiSchemas['/v0/files/:uuid/sharing.GET.response']
        );
      },
      update(uuid: string, body: ApiTypes['/v0/files/:uuid/sharing.PATCH.request']) {
        trackEvent('[FileSharing].publicLinkAccess.update', { value: body.publicLinkAccess });
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
      create(uuid: string, body: ApiTypes['/v0/files/:uuid/invites.POST.request']) {
        trackEvent('[FileSharing].invite.create');
        return fetchFromApi(
          `/v0/files/${uuid}/invites`,
          {
            method: 'POST',
            body: JSON.stringify(body),
          },
          ApiSchemas['/v0/files/:uuid/invites.POST.response']
        );
      },
      delete(uuid: string, inviteId: string) {
        trackEvent('[FileSharing].invite.delete');
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
      update(uuid: string, userId: string, body: ApiTypes['/v0/files/:uuid/users/:userId.PATCH.request']) {
        trackEvent('[FileSharing].users.updateRole');
        return fetchFromApi(
          `/v0/files/${uuid}/users/${userId}`,
          { method: 'PATCH', body: JSON.stringify(body) },
          ApiSchemas['/v0/files/:uuid/users/:userId.PATCH.response']
        );
      },
      delete(uuid: string, userId: string) {
        trackEvent('[FileSharing].users.remove');
        return fetchFromApi(
          `/v0/files/${uuid}/users/${userId}`,
          { method: 'DELETE' },
          ApiSchemas['/v0/files/:uuid/users/:userId.DELETE.response']
        );
      },
    },
  },

  templates: {
    duplicate(body: ApiTypes['/v0/examples.POST.request']) {
      return fetchFromApi(
        `/v0/examples`,
        { method: 'POST', body: JSON.stringify(body) },
        ApiSchemas['/v0/examples.POST.response']
      );
    },
  },

  user: {
    acknowledge() {
      return fetchFromApi(`/v0/user/acknowledge`, { method: 'GET' }, ApiSchemas['/v0/user/acknowledge.GET.response']);
    },
    update(body: ApiTypes['/v0/user.POST.request']) {
      return fetchFromApi(
        `/v0/user`,
        { method: 'POST', body: JSON.stringify(body) },
        ApiSchemas['/v0/user.POST.response']
      );
    },
    clientDataKv: {
      get() {
        return fetchFromApi(
          `/v0/user/client-data-kv`,
          { method: 'GET' },
          ApiSchemas['/v0/user/client-data-kv.GET.response']
        );
      },
      update(body: ApiTypes['/v0/user/client-data-kv.POST.request']) {
        return fetchFromApi(
          `/v0/user/client-data-kv`,
          { method: 'POST', body: JSON.stringify(body) },
          ApiSchemas['/v0/user/client-data-kv.POST.response']
        );
      },
    },
    aiRules: {
      get() {
        return fetchFromApi(`/v0/user/ai-rules`, { method: 'GET' }, ApiSchemas['/v0/user/ai-rules.GET.response']);
      },
      update(body: ApiTypes['/v0/user/ai-rules.PATCH.request']) {
        return fetchFromApi(
          `/v0/user/ai-rules`,
          { method: 'PATCH', body: JSON.stringify(body) },
          ApiSchemas['/v0/user/ai-rules.PATCH.response']
        );
      },
    },
    aiLanguages: {
      get() {
        return fetchFromApi(
          `/v0/user/ai-languages`,
          { method: 'GET' },
          ApiSchemas['/v0/user/ai-languages.GET.response']
        );
      },
      update(body: ApiTypes['/v0/user/ai-languages.PATCH.request']) {
        return fetchFromApi(
          `/v0/user/ai-languages`,
          { method: 'PATCH', body: JSON.stringify(body) },
          ApiSchemas['/v0/user/ai-languages.PATCH.response']
        );
      },
    },
  },

  education: {
    get() {
      return fetchFromApi(`/v0/education`, { method: 'GET' }, ApiSchemas['/v0/education.GET.response']);
    },
    refresh() {
      return fetchFromApi(`/v0/education`, { method: 'POST' }, ApiSchemas['/v0/education.POST.response']);
    },
  },

  connections: {
    list(teamUuid: string) {
      return fetchFromApi(
        `/v0/teams/${teamUuid}/connections`,
        { method: 'GET' },
        ApiSchemas['/v0/teams/:uuid/connections.GET.response']
      );
    },
    get({ connectionUuid, teamUuid }: { connectionUuid: string; teamUuid: string }) {
      return fetchFromApi(
        `/v0/teams/${teamUuid}/connections/${connectionUuid}`,
        { method: 'GET' },
        ApiSchemas['/v0/teams/:uuid/connections/:connectionUuid.GET.response']
      );
    },
    create({ body, teamUuid }: { body: ApiTypes['/v0/teams/:uuid/connections.POST.request']; teamUuid: string }) {
      return fetchFromApi(
        `/v0/teams/${teamUuid}/connections`,
        { method: 'POST', body: JSON.stringify(body) },
        ApiSchemas['/v0/teams/:uuid/connections.POST.response']
      );
    },
    update({
      connectionUuid,
      body,
      teamUuid,
    }: {
      connectionUuid: string;
      body: ApiTypes['/v0/teams/:uuid/connections/:connectionUuid.PUT.request'];
      teamUuid: string;
    }) {
      return fetchFromApi(
        `/v0/teams/${teamUuid}/connections/${connectionUuid}`,
        { method: 'PUT', body: JSON.stringify(body) },
        ApiSchemas['/v0/teams/:uuid/connections/:connectionUuid.PUT.response']
      );
    },
    delete({ connectionUuid, teamUuid }: { connectionUuid: string; teamUuid: string }) {
      return fetchFromApi(
        `/v0/teams/${teamUuid}/connections/${connectionUuid}`,
        { method: 'DELETE' },
        ApiSchemas['/v0/teams/:uuid/connections/:connectionUuid.DELETE.response']
      );
    },
    getLogs({
      connectionUuid,
      teamUuid,
      pageNumber = 1,
      pageSize = 10,
    }: {
      connectionUuid: string;
      teamUuid: string;
      pageNumber?: number;
      pageSize?: number;
    }) {
      return fetchFromApi(
        `/v0/teams/${teamUuid}/connections/${connectionUuid}/log?page=${pageNumber}&limit=${pageSize}`,
        { method: 'GET' },
        ApiSchemas['/v0/teams/:uuid/connections/:connectionUuid/log.GET.response']
      );
    },
    plaid: {
      createLinkToken({
        teamUuid,
        primary_product,
      }: {
        teamUuid: string;
        primary_product?: 'transactions' | 'investments' | 'liabilities';
      }) {
        return fetchFromApi(
          `/v0/teams/${teamUuid}/plaid/link-token`,
          {
            method: 'POST',
            body: JSON.stringify({ primary_product }),
          },
          ApiSchemas['/v0/teams/:uuid/plaid/link-token.POST.response']
        );
      },
      exchangeToken({ teamUuid, publicToken }: { teamUuid: string; publicToken: string }) {
        return fetchFromApi(
          `/v0/teams/${teamUuid}/plaid/exchange-token`,
          {
            method: 'POST',
            body: JSON.stringify({ publicToken }),
          },
          ApiSchemas['/v0/teams/:uuid/plaid/exchange-token.POST.response']
        );
      },
    },
    google: {
      getAuthUrl({ teamUuid }: { teamUuid: string }) {
        return fetchFromApi(
          `/v0/teams/${teamUuid}/google/auth-url`,
          { method: 'GET' },
          ApiSchemas['/v0/teams/:uuid/google/auth-url.GET.response']
        );
      },
      exchangeToken({ teamUuid, code, state }: { teamUuid: string; code: string; state: string }) {
        return fetchFromApi(
          `/v0/teams/${teamUuid}/google/exchange-token`,
          {
            method: 'POST',
            body: JSON.stringify({ code, state }),
          },
          ApiSchemas['/v0/teams/:uuid/google/exchange-token.POST.response']
        );
      },
    },
  },

  ai: {
    feedback(body: ApiTypes['/v0/ai/feedback.PATCH.request']) {
      return fetchFromApi(
        `/v0/ai/feedback`,
        { method: 'PATCH', body: JSON.stringify(body) },
        ApiSchemas['/v0/ai/feedback.PATCH.response']
      );
    },
    codeRunError(body: ApiTypes['/v0/ai/codeRunError.PATCH.request']) {
      return fetchFromApi(
        `/v0/ai/codeRunError`,
        { method: 'PATCH', body: JSON.stringify(body) },
        ApiSchemas['/v0/ai/codeRunError.PATCH.response']
      );
    },
  },

  postFeedback(body: ApiTypes['/v0/feedback.POST.request']) {
    return fetchFromApi(
      `/v0/feedback`,
      { method: 'POST', body: JSON.stringify(body) },
      ApiSchemas['/v0/feedback.POST.response']
    );
  },

  urlMetadata: {
    get(url: string) {
      return fetchFromApi(
        `/v0/url-metadata?url=${encodeURIComponent(url)}`,
        { method: 'GET' },
        ApiSchemas['/v0/url-metadata.GET.response']
      );
    },
  },

  getApiUrl() {
    const url = import.meta.env.VITE_QUADRATIC_API_URL;
    if (!url) {
      const message = 'VITE_QUADRATIC_API_URL env variable is not set.';
      captureEvent({
        message,
        level: 'fatal',
      });
      throw new Error(message);
    }

    return url;
  },
};
