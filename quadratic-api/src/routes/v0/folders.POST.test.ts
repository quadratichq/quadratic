import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFolder, createUsers, upgradeTeamToPro } from '../../tests/testDataGenerator';

const teamUuid = '00000000-0000-4000-8000-000000000001';

const validPayload = {
  name: 'Test Folder',
  teamUuid,
};

const createFolderRequest = (payload: any, user: string = 'userOwner') =>
  request(app).post('/v0/folders').send(payload).set('Authorization', `Bearer ValidToken ${user}`);

describe('POST /v0/folders', () => {
  let teamId: number;
  let userOwnerId: number;
  let userViewerId: number;

  beforeAll(async () => {
    const [userOwner, userViewer, userNoTeam] = await createUsers(['userOwner', 'userViewer', 'userNoTeam']);
    userOwnerId = userOwner.id;
    userViewerId = userViewer.id;
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
  });

  afterAll(clearDb);

  describe('bad requests', () => {
    it('rejects unauthorized request', async () => {
      await request(app).post('/v0/folders').send(validPayload).expect(401).expect(expectError);
    });

    it('rejects request with missing name', async () => {
      await createFolderRequest({ teamUuid }).expect(400).expect(expectError);
    });

    it('rejects request with missing teamUuid', async () => {
      await createFolderRequest({ name: 'Test' }).expect(400).expect(expectError);
    });

    it('rejects request for a team that does not exist', async () => {
      await createFolderRequest({ name: 'Test', teamUuid: '00000000-0000-4000-8000-000000000099' })
        .expect(404)
        .expect(expectError);
    });

    it('rejects request when user does not have access to the team', async () => {
      await createFolderRequest(validPayload, 'userNoTeam').expect(403).expect(expectError);
    });

    it('rejects a public folder from a viewer', async () => {
      await createFolderRequest(validPayload, 'userViewer').expect(403).expect(expectError);
    });
  });

  describe('create folder', () => {
    it('creates a public folder', async () => {
      await createFolderRequest(validPayload)
        .expect(201)
        .expect((res) => {
          expect(res.body.folder).toHaveProperty('uuid');
          expect(res.body.folder.name).toBe('Test Folder');
          expect(res.body.folder.parentFolderUuid).toBeNull();
        });
    });

    it('creates a private folder', async () => {
      await createFolderRequest({ ...validPayload, name: 'Private Folder', isPrivate: true })
        .expect(201)
        .expect((res) => {
          expect(res.body.folder.name).toBe('Private Folder');
        });
    });

    it('creates a private folder as a viewer', async () => {
      await createFolderRequest({ ...validPayload, name: 'Viewer Private Folder', isPrivate: true }, 'userViewer')
        .expect(201)
        .expect((res) => {
          expect(res.body.folder.name).toBe('Viewer Private Folder');
        });
    });

    it('creates a subfolder', async () => {
      // Create parent folder first
      const parentFolder = await createFolder({
        data: {
          name: 'Parent Folder',
          ownerTeamId: teamId,
          uuid: '00000000-0000-4000-8000-000000000010',
        },
      });

      await createFolderRequest({
        ...validPayload,
        name: 'Child Folder',
        parentFolderUuid: parentFolder.uuid,
      })
        .expect(201)
        .expect((res) => {
          expect(res.body.folder.name).toBe('Child Folder');
          expect(res.body.folder.parentFolderUuid).toBe(parentFolder.uuid);
        });
    });

    it('rejects subfolder with non-existent parent', async () => {
      await createFolderRequest({
        ...validPayload,
        parentFolderUuid: '00000000-0000-4000-8000-000000000099',
      })
        .expect(404)
        .expect(expectError);
    });
  });

  describe('parent folder privacy validation', () => {
    it('rejects private subfolder under a team folder', async () => {
      const teamParent = await createFolder({
        data: {
          name: 'Team Parent',
          ownerTeamId: teamId,
          uuid: '00000000-0000-4000-8000-000000000020',
        },
      });

      await createFolderRequest({
        ...validPayload,
        name: 'Private Child',
        parentFolderUuid: teamParent.uuid,
        isPrivate: true,
      })
        .expect(400)
        .expect(expectError);
    });

    it('rejects private subfolder under another user’s private folder', async () => {
      const otherUserPrivateFolder = await createFolder({
        data: {
          name: 'Viewer Private Parent',
          ownerTeamId: teamId,
          ownerUserId: userViewerId,
          uuid: '00000000-0000-4000-8000-000000000021',
        },
      });

      await createFolderRequest(
        {
          ...validPayload,
          name: 'My Private Child',
          parentFolderUuid: otherUserPrivateFolder.uuid,
          isPrivate: true,
        },
        'userOwner',
      )
        .expect(400)
        .expect(expectError);
    });

    it('rejects team subfolder under a private folder', async () => {
      const privateParent = await createFolder({
        data: {
          name: 'Private Parent',
          ownerTeamId: teamId,
          ownerUserId: userOwnerId,
          uuid: '00000000-0000-4000-8000-000000000022',
        },
      });

      await createFolderRequest({
        ...validPayload,
        name: 'Team Child',
        parentFolderUuid: privateParent.uuid,
        isPrivate: false,
      })
        .expect(400)
        .expect(expectError);
    });

    it('creates private subfolder under own private folder', async () => {
      const privateParent = await createFolder({
        data: {
          name: 'My Private Parent',
          ownerTeamId: teamId,
          ownerUserId: userOwnerId,
          uuid: '00000000-0000-4000-8000-000000000023',
        },
      });

      await createFolderRequest({
        ...validPayload,
        name: 'My Private Child',
        parentFolderUuid: privateParent.uuid,
        isPrivate: true,
      })
        .expect(201)
        .expect((res) => {
          expect(res.body.folder.name).toBe('My Private Child');
          expect(res.body.folder.parentFolderUuid).toBe(privateParent.uuid);
          expect(res.body.folder.ownerUserId).not.toBeNull();
        });
    });

    it('creates team subfolder under team folder', async () => {
      const teamParent = await createFolder({
        data: {
          name: 'Team Parent For Child',
          ownerTeamId: teamId,
          uuid: '00000000-0000-4000-8000-000000000024',
        },
      });

      await createFolderRequest({
        ...validPayload,
        name: 'Team Child',
        parentFolderUuid: teamParent.uuid,
        isPrivate: false,
      })
        .expect(201)
        .expect((res) => {
          expect(res.body.folder.name).toBe('Team Child');
          expect(res.body.folder.parentFolderUuid).toBe(teamParent.uuid);
          expect(res.body.folder.ownerUserId).toBeNull();
        });
    });
  });
});
