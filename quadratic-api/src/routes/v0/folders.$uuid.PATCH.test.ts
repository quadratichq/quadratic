import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFolder, createUsers, upgradeTeamToPro } from '../../tests/testDataGenerator';

const teamUuid = '00000000-0000-4000-8000-000000000001';
const folderUuid = '00000000-0000-4000-8000-000000000010';
const subfolderUuid = '00000000-0000-4000-8000-000000000011';
const siblingUuid = '00000000-0000-4000-8000-000000000012';

const patchFolder = (uuid: string, payload: any, user: string = 'userOwner') =>
  request(app).patch(`/v0/folders/${uuid}`).send(payload).set('Authorization', `Bearer ValidToken ${user}`);

describe('PATCH /v0/folders/:uuid', () => {
  let teamId: number;
  let userOwnerId: number;
  let folderId: number;

  beforeAll(async () => {
    const [userOwner, userViewer, userNoTeam] = await createUsers(['userOwner', 'userViewer', 'userNoTeam']);
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

    // Create folders
    const folder = await createFolder({
      data: {
        name: 'Folder A',
        uuid: folderUuid,
        ownerTeamId: teamId,
        creatorUserId: userOwnerId,
      },
    });
    folderId = folder.id;

    await createFolder({
      data: {
        name: 'Subfolder B',
        uuid: subfolderUuid,
        ownerTeamId: teamId,
        creatorUserId: userOwnerId,
        parentFolderId: folderId,
      },
    });

    await createFolder({
      data: {
        name: 'Sibling C',
        uuid: siblingUuid,
        ownerTeamId: teamId,
        creatorUserId: userOwnerId,
      },
    });
  });

  afterAll(clearDb);

  describe('bad requests', () => {
    it('rejects unauthenticated request', async () => {
      await request(app).patch(`/v0/folders/${folderUuid}`).send({ name: 'New Name' }).expect(401).expect(expectError);
    });

    it('rejects request for a folder that does not exist', async () => {
      await patchFolder('00000000-0000-4000-8000-000000000099', { name: 'New' }).expect(404).expect(expectError);
    });

    it('rejects request when user does not have team access', async () => {
      await patchFolder(folderUuid, { name: 'New' }, 'userNoTeam').expect(403).expect(expectError);
    });

    it('rejects request from a viewer for a public folder', async () => {
      await patchFolder(folderUuid, { name: 'New' }, 'userViewer').expect(403).expect(expectError);
    });
  });

  describe('rename folder', () => {
    it('renames a folder', async () => {
      await patchFolder(folderUuid, { name: 'Renamed Folder' })
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.name).toBe('Renamed Folder');
          expect(res.body.folder.uuid).toBe(folderUuid);
        });
    });
  });

  describe('move folder', () => {
    it('moves a folder to another parent', async () => {
      await patchFolder(subfolderUuid, { parentFolderUuid: siblingUuid })
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.parentFolderUuid).toBe(siblingUuid);
        });
    });

    it('moves a folder to root', async () => {
      await patchFolder(subfolderUuid, { parentFolderUuid: null })
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.parentFolderUuid).toBeNull();
        });
    });

    it('rejects moving a folder into itself', async () => {
      await patchFolder(folderUuid, { parentFolderUuid: folderUuid }).expect(400).expect(expectError);
    });

    it('rejects moving a folder into its own subfolder (circular reference)', async () => {
      // Move subfolder back under folder first
      await patchFolder(subfolderUuid, { parentFolderUuid: folderUuid }).expect(200);

      // Now try to move folder into subfolder (circular)
      await patchFolder(folderUuid, { parentFolderUuid: subfolderUuid }).expect(400).expect(expectError);
    });

    it('rejects moving to a non-existent parent', async () => {
      await patchFolder(folderUuid, { parentFolderUuid: '00000000-0000-4000-8000-000000000099' })
        .expect(404)
        .expect(expectError);
    });
  });
});
