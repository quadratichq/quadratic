import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFile, createFolder, createUsers, upgradeTeamToPro } from '../../tests/testDataGenerator';

const teamUuid = '00000000-0000-4000-8000-000000000001';
const folderUuid = '00000000-0000-4000-8000-000000000010';
const subfolderUuid = '00000000-0000-4000-8000-000000000011';

const getFolder = (uuid: string, user: string = 'userOwner') =>
  request(app).get(`/v0/folders/${uuid}`).set('Authorization', `Bearer ValidToken ${user}`);

describe('GET /v0/folders/:uuid', () => {
  let teamId: number;
  let userOwnerId: number;
  let folderId: number;

  beforeAll(async () => {
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

    // Create a folder
    const folder = await createFolder({
      data: {
        name: 'Test Folder',
        uuid: folderUuid,
        ownerTeamId: teamId,
      },
    });
    folderId = folder.id;

    // Create a subfolder
    await createFolder({
      data: {
        name: 'Subfolder',
        uuid: subfolderUuid,
        ownerTeamId: teamId,
        parentFolderId: folderId,
      },
    });

    // Create a file inside the folder
    await createFile({
      data: {
        name: 'File in Folder',
        uuid: '00000000-0000-4000-8000-000000000020',
        ownerTeamId: teamId,
        creatorUserId: userOwnerId,
        folderId: folderId,
      },
    });

    // Create a private file inside the folder
    await createFile({
      data: {
        name: 'Private File in Folder',
        uuid: '00000000-0000-4000-8000-000000000021',
        ownerTeamId: teamId,
        creatorUserId: userOwnerId,
        ownerUserId: userOwnerId,
        folderId: folderId,
      },
    });
  });

  afterAll(clearDb);

  describe('bad requests', () => {
    it('rejects unauthorized request', async () => {
      await request(app).get(`/v0/folders/${folderUuid}`).expect(401).expect(expectError);
    });

    it('rejects request for a folder that does not exist', async () => {
      await getFolder('00000000-0000-4000-8000-000000000099').expect(404).expect(expectError);
    });

    it('rejects request when user does not have team access', async () => {
      await getFolder(folderUuid, 'userNoTeam').expect(403).expect(expectError);
    });

    it('rejects request with invalid UUID', async () => {
      await getFolder('invalid-uuid').expect(400);
    });
  });

  describe('get folder contents', () => {
    it('returns folder metadata', async () => {
      await getFolder(folderUuid)
        .expect(200)
        .expect((res) => {
          expect(res.body.folder.uuid).toBe(folderUuid);
          expect(res.body.folder.name).toBe('Test Folder');
          expect(res.body.folder.parentFolderUuid).toBeNull();
        });
    });

    it('returns subfolders', async () => {
      await getFolder(folderUuid)
        .expect(200)
        .expect((res) => {
          expect(res.body.subfolders).toHaveLength(1);
          expect(res.body.subfolders[0].name).toBe('Subfolder');
          expect(res.body.subfolders[0].uuid).toBe(subfolderUuid);
        });
    });

    it('returns files in the folder', async () => {
      await getFolder(folderUuid)
        .expect(200)
        .expect((res) => {
          expect(res.body.files.length + res.body.filesPrivate.length).toBeGreaterThanOrEqual(1);
        });
    });

    it('returns breadcrumbs', async () => {
      await getFolder(folderUuid)
        .expect(200)
        .expect((res) => {
          expect(res.body.breadcrumbs).toEqual([]);
        });
    });

    it('returns breadcrumbs for a subfolder', async () => {
      await getFolder(subfolderUuid)
        .expect(200)
        .expect((res) => {
          expect(res.body.breadcrumbs).toHaveLength(1);
          expect(res.body.breadcrumbs[0].uuid).toBe(folderUuid);
          expect(res.body.breadcrumbs[0].name).toBe('Test Folder');
        });
    });

    it('returns empty subfolders and files for a subfolder with none', async () => {
      await getFolder(subfolderUuid)
        .expect(200)
        .expect((res) => {
          expect(res.body.subfolders).toHaveLength(0);
          expect(res.body.files).toHaveLength(0);
          expect(res.body.filesPrivate).toHaveLength(0);
        });
    });
  });
});
