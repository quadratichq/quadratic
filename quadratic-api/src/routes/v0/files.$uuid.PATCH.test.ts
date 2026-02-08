import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFile, createFolder, createUsers, upgradeTeamToPro } from '../../tests/testDataGenerator';

describe('PATCH /v0/files/:uuid', () => {
  beforeAll(async () => {
    const [userOwner, userViewer] = await createUsers(['userOwner', 'userViewer', 'userNoTeam']);
    const team = await dbClient.team.create({
      data: {
        name: 'team1',
        UserTeamRole: {
          create: [
            {
              userId: userOwner.id,
              role: 'OWNER',
            },
            {
              userId: userViewer.id,
              role: 'VIEWER',
            },
          ],
        },
      },
    });
    await createFile({
      data: {
        creatorUserId: userOwner.id,
        ownerUserId: userOwner.id,
        ownerTeamId: team.id,
        name: 'private_file',
        contents: Buffer.from('contents_1'),
        uuid: '00000000-0000-4000-8000-000000000001',
        publicLinkAccess: 'READONLY',
      },
    });
    await createFile({
      data: {
        creatorUserId: userOwner.id,
        ownerTeamId: team.id,
        name: 'public_file',
        contents: Buffer.from('contents_1'),
        uuid: '00000000-0000-4000-8000-000000000002',
        publicLinkAccess: 'READONLY',
      },
    });

    await dbClient.team.create({
      data: {
        name: 'team2',
        UserTeamRole: {
          create: [
            {
              userId: userOwner.id,
              role: 'OWNER',
            },
          ],
        },
      },
    });
  });

  afterAll(clearDb);

  describe('bad request', () => {
    it('rejects unauthenticated request', async () => {
      await request(app).patch('/v0/files/00000000-0000-0000-0000-000000000000').expect(401).expect(expectError);
    });
    it('rejects invalid request', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .send({ foo: 'new_name' })
        .expect(400)
        .expect(expectError);
    });
    it('rejects request for a file that doesn’t exist', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000009')
        .send({ name: 'new_name' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(404)
        .expect(expectError);
    });
    it('rejects renaming and moving at the same time', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ ownerUserId: 100, name: 'test' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(400)
        .expect(expectError);
    });
    it('rejects a user changing a file they don’t have access to', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ name: 'new_name' })
        .set('Authorization', `Bearer ValidToken userNoTeam`)
        .expect(403)
        .expect(expectError);
    });
  });

  describe('rename file', () => {
    it('accepts someone with permission renaming the file', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ name: 'test_file_1_new_name' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('test_file_1_new_name');
        });
    });
    it('rejects someone without permission renaming the file', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ name: 'test_file_1_new_name' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('test_file_1_new_name');
        });
    });
  });

  describe('update timezone', () => {
    it('accepts setting timezone with valid IANA identifier', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ timezone: 'America/New_York' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.timezone).toBe('America/New_York');
        });
    });
    it('accepts updating timezone to different IANA identifier', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ timezone: 'Europe/London' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.timezone).toBe('Europe/London');
        });
    });
    it('accepts setting timezone to null', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ timezone: null })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.timezone).toBe(null);
        });
    });
    it('rejects someone without permission updating timezone', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ timezone: 'Asia/Tokyo' })
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect(403)
        .expect(expectError);
    });
    it('rejects updating timezone and name at the same time', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ timezone: 'Asia/Tokyo', name: 'new_name' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(400)
        .expect(expectError);
    });
  });

  describe('move file inside team', () => {
    it('accepts public -> private', async () => {
      const ownerAuth0Id = 'userOwner';
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000002')
        .send({ ownerUserId: null })
        .set('Authorization', `Bearer ValidToken ${ownerAuth0Id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.ownerUserId).toBe(undefined);
        });
    });
    it("accepts private -> public if it's your private file", async () => {
      const ownerAuth0Id = 'userOwner';
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ ownerUserId: null })
        .set('Authorization', `Bearer ValidToken ${ownerAuth0Id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.ownerUserId).toBe(undefined);
        });
    });
    it("rejects private -> public if it's not your private file", async () => {
      const ownerAuth0Id = 'userViewer';
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001')
        .send({ ownerUserId: null })
        .set('Authorization', `Bearer ValidToken ${ownerAuth0Id}`)
        .expect(403)
        .expect(expectError);
    });
  });

  describe('move file — requires access to current folder', () => {
    const fileInPrivateFolderUuid = '00000000-0000-4000-8000-000000000010';
    const privateFolderUuid = '00000000-0000-4000-8000-000000000011';

    beforeAll(async () => {
      const [userEditor] = await createUsers(['userEditor']);
      const userOwner = await dbClient.user.findFirst({ where: { auth0Id: 'userOwner' } });
      const team = await dbClient.team.findFirst({ where: { name: 'team1' } });
      if (!userOwner || !team) throw new Error('Test setup: userOwner or team1 not found');

      const privateFolder = await createFolder({
        data: {
          name: 'Private folder',
          uuid: privateFolderUuid,
          ownerTeamId: team.id,
          ownerUserId: userOwner.id,
        },
      });

      await createFile({
        data: {
          creatorUserId: userOwner.id,
          ownerUserId: userOwner.id,
          ownerTeamId: team.id,
          name: 'file_in_private_folder',
          contents: Buffer.from('contents'),
          uuid: fileInPrivateFolderUuid,
          publicLinkAccess: 'NOT_SHARED',
          folderId: privateFolder.id,
          UserFileRole: {
            create: [{ userId: userEditor.id, role: 'EDITOR' }],
          },
        },
      });
    });

    it('rejects moving a file out of a folder the user does not have access to', async () => {
      const res = await request(app)
        .patch(`/v0/files/${fileInPrivateFolderUuid}`)
        .send({ folderUuid: null })
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect(403)
        .expect(expectError);

      expect(res.body.error.message).toBe('You do not have access to the current folder.');
    });
  });
});

/**
 * Dedicated test suite for cross-ownership file moves between team and private
 * subfolders. The file PATCH endpoint automatically adjusts the file's
 * ownerUserId to match the target folder's ownerUserId when moving to a folder.
 */
describe('PATCH /v0/files/:uuid — cross-ownership folder moves', () => {
  const teamFolderUuid = '00000000-0000-4000-8000-000000000020';
  const privateFolderUuid = '00000000-0000-4000-8000-000000000021';
  const moveFileUuid = '00000000-0000-4000-8000-000000000030';

  let userId: number;
  let teamFolderId: number;
  let privateFolderId: number;

  const patchFile = (uuid: string, payload: any) =>
    request(app).patch(`/v0/files/${uuid}`).send(payload).set('Authorization', `Bearer ValidToken userOwner`);

  beforeAll(async () => {
    const [userOwner] = await createUsers(['userOwner']);
    userId = userOwner.id;

    const team = await dbClient.team.create({
      data: {
        name: 'cross_move_team',
        UserTeamRole: { create: [{ userId: userOwner.id, role: 'OWNER' }] },
      },
    });
    await upgradeTeamToPro(team.id);

    // Create a team folder (ownerUserId = null)
    const teamFolder = await createFolder({
      data: {
        name: 'Team Subfolder',
        uuid: teamFolderUuid,
        ownerTeamId: team.id,
      },
    });
    teamFolderId = teamFolder.id;

    // Create a private folder (ownerUserId = userId)
    const privateFolder = await createFolder({
      data: {
        name: 'Private Subfolder',
        uuid: privateFolderUuid,
        ownerTeamId: team.id,
        ownerUserId: userId,
      },
    });
    privateFolderId = privateFolder.id;

    // Create a team file inside the team folder
    await createFile({
      data: {
        name: 'File To Move',
        uuid: moveFileUuid,
        ownerTeamId: team.id,
        creatorUserId: userId,
        folderId: teamFolderId,
      },
    });
  });

  afterAll(clearDb);

  it('starts with the file in the team folder with no ownerUserId', async () => {
    const file = await dbClient.file.findUnique({ where: { uuid: moveFileUuid } });
    expect(file!.ownerUserId).toBeNull();
    expect(file!.folderId).toBe(teamFolderId);
  });

  it('auto-adjusts ownerUserId when moving a team file to a private subfolder', async () => {
    // A single folderUuid call should move AND change ownership
    await patchFile(moveFileUuid, { folderUuid: privateFolderUuid }).expect(200);

    const file = await dbClient.file.findUnique({ where: { uuid: moveFileUuid } });
    // ownerUserId should match the private folder's owner
    expect(file!.ownerUserId).toBe(userId);
    expect(file!.folderId).toBe(privateFolderId);
  });

  it('auto-adjusts ownerUserId when moving a private file to a team subfolder', async () => {
    // A single folderUuid call should move AND change ownership back to team
    await patchFile(moveFileUuid, { folderUuid: teamFolderUuid }).expect(200);

    const file = await dbClient.file.findUnique({ where: { uuid: moveFileUuid } });
    // ownerUserId should be null (team-owned) to match the team folder
    expect(file!.ownerUserId).toBeNull();
    expect(file!.folderId).toBe(teamFolderId);
  });

  it('does not change ownerUserId when moving between folders with the same ownership', async () => {
    // First move to private folder
    await patchFile(moveFileUuid, { folderUuid: privateFolderUuid }).expect(200);
    let file = await dbClient.file.findUnique({ where: { uuid: moveFileUuid } });
    expect(file!.ownerUserId).toBe(userId);

    // Move back to private folder (same ownership) — no ownership change
    // Create a second private folder for this
    const secondPrivateFolder = await createFolder({
      data: {
        name: 'Private Subfolder 2',
        uuid: '00000000-0000-4000-8000-000000000022',
        ownerTeamId: file!.ownerTeamId,
        ownerUserId: userId,
      },
    });

    await patchFile(moveFileUuid, { folderUuid: '00000000-0000-4000-8000-000000000022' }).expect(200);

    file = await dbClient.file.findUnique({ where: { uuid: moveFileUuid } });
    expect(file!.ownerUserId).toBe(userId);
    expect(file!.folderId).toBe(secondPrivateFolder.id);
  });

  it('moves to root without changing ownership when folderUuid is null', async () => {
    // File is currently private (from previous test). Move to root.
    await patchFile(moveFileUuid, { folderUuid: null }).expect(200);

    const file = await dbClient.file.findUnique({ where: { uuid: moveFileUuid } });
    // Ownership should remain private (unchanged) since there's no target folder
    expect(file!.ownerUserId).toBe(userId);
    expect(file!.folderId).toBeNull();
  });
});
