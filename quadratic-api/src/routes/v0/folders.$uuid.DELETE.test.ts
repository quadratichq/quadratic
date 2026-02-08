import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFile, createFolder, createUsers, upgradeTeamToPro } from '../../tests/testDataGenerator';

const teamUuid = '00000000-0000-4000-8000-000000000001';
const folderUuid = '00000000-0000-4000-8000-000000000010';
const subfolderUuid = '00000000-0000-4000-8000-000000000011';
const fileInFolderUuid = '00000000-0000-4000-8000-000000000020';
const fileInSubfolderUuid = '00000000-0000-4000-8000-000000000021';

const deleteFolder = (uuid: string, user: string = 'userOwner') =>
  request(app).delete(`/v0/folders/${uuid}`).set('Authorization', `Bearer ValidToken ${user}`);

describe('DELETE /v0/folders/:uuid', () => {
  let teamId: number;
  let userOwnerId: number;

  beforeEach(async () => {
    const [userOwner, userViewer] = await createUsers(['userOwner', 'userViewer']);
    userOwnerId = userOwner.id;

    const team = await dbClient.team.create({
      data: {
        name: 'test_team',
        uuid: teamUuid,
        UserTeamRole: {
          create: [
            { userId: userOwner.id, role: 'OWNER' },
            { userId: userViewer.id, role: 'VIEWER' },
          ],
        },
      },
    });
    teamId = team.id;
    await upgradeTeamToPro(team.id);

    // Create folder with subfolder and files
    const folder = await createFolder({
      data: {
        name: 'Folder to Delete',
        uuid: folderUuid,
        ownerTeamId: teamId,
      },
    });

    const subfolder = await createFolder({
      data: {
        name: 'Subfolder',
        uuid: subfolderUuid,
        ownerTeamId: teamId,
        parentFolderId: folder.id,
      },
    });

    await createFile({
      data: {
        name: 'File in Folder',
        uuid: fileInFolderUuid,
        ownerTeamId: teamId,
        creatorUserId: userOwnerId,
        folderId: folder.id,
      },
    });

    await createFile({
      data: {
        name: 'File in Subfolder',
        uuid: fileInSubfolderUuid,
        ownerTeamId: teamId,
        creatorUserId: userOwnerId,
        folderId: subfolder.id,
      },
    });
  });

  afterEach(clearDb);

  describe('bad requests', () => {
    it('rejects unauthenticated request', async () => {
      await request(app).delete(`/v0/folders/${folderUuid}`).expect(401).expect(expectError);
    });

    it('rejects request for a folder that does not exist', async () => {
      await deleteFolder('00000000-0000-4000-8000-000000000099').expect(404).expect(expectError);
    });

    it('rejects request when user does not have team access', async () => {
      await deleteFolder(folderUuid, 'userNoTeam').expect(403).expect(expectError);
    });

    it('rejects request from a viewer for a public folder', async () => {
      await deleteFolder(folderUuid, 'userViewer').expect(403).expect(expectError);
    });

    it('rejects request with invalid UUID', async () => {
      await deleteFolder('invalid-uuid').expect(400);
    });
  });

  describe('delete folder', () => {
    it('hard-deletes the folder', async () => {
      await deleteFolder(folderUuid)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Folder deleted.');
        });

      // Verify folder is gone (hard-delete; only files can be restored)
      const folder = await dbClient.folder.findUnique({ where: { uuid: folderUuid } });
      expect(folder).toBeNull();
    });

    it('recursively hard-deletes subfolders', async () => {
      await deleteFolder(folderUuid).expect(200);

      const subfolder = await dbClient.folder.findUnique({ where: { uuid: subfolderUuid } });
      expect(subfolder).toBeNull();
    });

    it('soft-deletes files inside the folder', async () => {
      await deleteFolder(folderUuid).expect(200);

      // Verify file in folder is soft-deleted
      const file = await dbClient.file.findUnique({ where: { uuid: fileInFolderUuid } });
      expect(file?.deleted).toBe(true);
      expect(file?.deletedDate).not.toBeNull();
    });

    it('soft-deletes files inside subfolders', async () => {
      await deleteFolder(folderUuid).expect(200);

      // Verify file in subfolder is soft-deleted
      const file = await dbClient.file.findUnique({ where: { uuid: fileInSubfolderUuid } });
      expect(file?.deleted).toBe(true);
      expect(file?.deletedDate).not.toBeNull();
    });

    it('returns 404 when trying to delete an already-deleted folder', async () => {
      await deleteFolder(folderUuid).expect(200);
      // Folder is hard-deleted, so second request gets 404
      await deleteFolder(folderUuid).expect(404).expect(expectError);
    });
  });
});
