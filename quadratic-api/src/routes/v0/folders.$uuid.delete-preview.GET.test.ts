import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFile, createFolder, createUsers, upgradeTeamToPro } from '../../tests/testDataGenerator';

const teamUuid = '00000000-0000-4000-8000-000000000001';
const folderUuid = '00000000-0000-4000-8000-000000000010';
const subfolderUuid = '00000000-0000-4000-8000-000000000011';
const fileInSubfolderUuid = '00000000-0000-4000-8000-000000000021';

const getDeletePreview = (uuid: string, user: string = 'userOwner') =>
  request(app).get(`/v0/folders/${uuid}/delete-preview`).set('Authorization', `Bearer ValidToken ${user}`);

describe('GET /v0/folders/:uuid/delete-preview', () => {
  let teamId: number;
  let userOwnerId: number;

  beforeEach(async () => {
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

    const folder = await createFolder({
      data: {
        name: 'Parent Folder',
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
        name: 'File in Subfolder',
        uuid: fileInSubfolderUuid,
        ownerTeamId: teamId,
        creatorUserId: userOwnerId,
        folderId: subfolder.id,
      },
    });
  });

  afterEach(clearDb);

  it('returns files in a subfolder when requesting delete preview for that subfolder', async () => {
    await getDeletePreview(subfolderUuid)
      .expect(200)
      .expect((res) => {
        expect(res.body.files).toHaveLength(1);
        expect(res.body.files[0].uuid).toBe(fileInSubfolderUuid);
        expect(res.body.files[0].name).toBe('File in Subfolder');
        expect(res.body.subfolderCount).toBe(0);
      });
  });

  it('returns all files recursively when requesting delete preview for parent folder', async () => {
    await getDeletePreview(folderUuid)
      .expect(200)
      .expect((res) => {
        expect(res.body.files).toHaveLength(1);
        expect(res.body.files[0].name).toBe('File in Subfolder');
        expect(res.body.subfolderCount).toBe(1);
      });
  });

  it('rejects unauthenticated request', async () => {
    await request(app).get(`/v0/folders/${subfolderUuid}/delete-preview`).expect(401).expect(expectError);
  });

  it('rejects when user does not have team access', async () => {
    await getDeletePreview(subfolderUuid, 'userNoTeam').expect(403).expect(expectError);
  });
});
