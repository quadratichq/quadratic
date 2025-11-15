import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createFile, createUsers } from '../../tests/testDataGenerator';
import { createScheduledTask } from '../../utils/scheduledTasks';

beforeAll(async () => {
  // Create a test user
  const [user_1] = await createUsers(['test_user_1', 'test_user_2']);

  const team = await dbClient.team.create({
    data: {
      name: 'Test team',
      UserTeamRole: {
        create: [
          {
            userId: user_1.id,
            role: 'OWNER',
          },
        ],
      },
    },
  });

  // Create a test files
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      ownerUserId: user_1.id,
      name: 'private_file',
      contents: Buffer.from('contents_1'),
      uuid: '00000000-0000-4000-8000-000000000001',
      publicLinkAccess: 'READONLY',
    },
  });
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      name: 'public_file',
      contents: Buffer.from('contents_0'),
      uuid: '00000000-0000-4000-8000-000000000000',
      publicLinkAccess: 'NOT_SHARED',
    },
  });
});

afterAll(clearDb);

describe('READ - GET /v0/files/:uuid file not found, no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-0000-0000-000000000000')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(res.body).toMatchObject({ error: { message: 'File not found' } });
  });
});

describe('READ - GET /v0/files/:uuid file not shared, no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(403);

    expect(res.body).toMatchObject({ error: { message: 'Permission denied' } });
  });
});

describe('READ - GET /v0/files/:uuid file shared, no auth', () => {
  it('responds with json', async () => {
    await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000001')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .expect((res) => {
        expect(res.body.file.uuid).toBe('00000000-0000-4000-8000-000000000001');
        expect(res.body.file.name).toBe('private_file');
        expect(res.body).toHaveProperty('userMakingRequest');
        expect(res.body.userMakingRequest).toHaveProperty('filePermissions');
      });
  });
});

describe('READ - GET /v0/files/:uuid file not found', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000009')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(404); // Not Found

    expect(res.body).toMatchObject({ error: { message: 'File not found' } });
  });
});

describe('READ - GET /v0/files/:uuid with auth and owned file', () => {
  it('responds with json', async () => {
    await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('file');
        expect(res.body).toHaveProperty('userMakingRequest');
        expect(res.body.file).toHaveProperty('timezone');
        expect(res.body.userMakingRequest.filePermissions).toEqual([
          'FILE_VIEW',
          'FILE_EDIT',
          'FILE_MOVE',
          'FILE_DELETE',
        ]);
        expect(res.body.userMakingRequest.fileTeamPrivacy).toBe('PUBLIC_TO_TEAM');
      }); // OK
  });
});

describe('READ - GET /v0/files/:uuid with auth and another users file shared readonly', () => {
  it('responds with json', async () => {
    await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000001')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(200) // OK
      .expect((res) => {
        expect(res.body).toHaveProperty('file');
        expect(res.body).toHaveProperty('userMakingRequest');
        expect(res.body.userMakingRequest.filePermissions).toEqual(['FILE_VIEW']);
        expect(res.body.userMakingRequest.fileTeamPrivacy).toBe(undefined);
      });
  });
});

describe('READ - GET /v0/files/:uuid with auth and another users file not shared', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(403); // Forbidden

    expect(res.body).toMatchObject({ error: { message: 'Permission denied' } });
  });
});

describe('UPDATE - POST /v0/files/:uuid/thumbnail no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/00000000-0000-0000-0000-000000000000/thumbnail')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401); // Unauthorized

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('UPDATE - POST /v0/files/:uuid/thumbnail file not found', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/00000000-0000-4000-8000-000000000009/thumbnail')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(404); // Not Found

    expect(res.body).toMatchObject({ error: { message: 'File not found' } });
  });
});

describe('UPDATE - POST /v0/files/:uuid/thumbnail with auth and owned file update preview', () => {
  it('responds with json', async () => {
    const filePath = 'test_thumbnail.png';

    // update preview
    await request(app)
      .post('/v0/files/00000000-0000-4000-8000-000000000001/thumbnail')
      .attach('thumbnail', filePath)
      .set('Accept', 'application/json')
      .set('Content-Type', 'multipart/form-data')
      .set('Authorization', `Bearer ValidToken test_user_1`);
    // .expect(200); // OK

    // expect(res.body).toMatchObject({ message: 'Preview updated' });
    // TODO fix test with mocks
  });
});

describe('DELETE - DELETE /v0/files/:uuid with no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .delete('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('DELETE - DELETE /v0/files/:uuid file not found', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .delete('/v0/files/00000000-0000-4000-8000-000000000009')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(404); // Not Found

    expect(res.body).toMatchObject({ error: { message: 'File not found' } });
  });
});

describe('DELETE - DELETE /v0/files/:uuid with auth and owned file', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .delete('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body).toMatchObject({ message: 'File deleted' });

    // verify file deleted
    const res2 = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(410);

    expect(res2.body).toMatchObject({ error: { message: 'File has been deleted' } });
  });
});

describe('DELETE - DELETE /v0/files/:uuid with auth and another users file', () => {
  it('responds with json', async () => {
    await request(app)
      .delete('/v0/files/00000000-0000-4000-8000-000000000001')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(403); // Forbidden

    // verify file not deleted
    await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000001')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK
  });
});

describe('DELETE - DELETE /v0/files/:uuid with scheduled tasks', () => {
  it('deletes all associated scheduled tasks when file is deleted', async () => {
    // Create a new file with a scheduled task
    const user = await dbClient.user.findFirst({ where: { auth0Id: 'test_user_1' } });
    const team = await dbClient.team.findFirst();

    if (!user || !team) {
      throw new Error('Test setup failed: user or team not found');
    }

    const testFile = await createFile({
      data: {
        creatorUserId: user.id,
        ownerTeamId: team.id,
        ownerUserId: user.id,
        name: 'file_with_scheduled_task',
        contents: Buffer.from('test_contents'),
        uuid: '00000000-0000-4000-8000-000000000099',
        publicLinkAccess: 'NOT_SHARED',
      },
    });

    // Create a scheduled task for the file
    const scheduledTask = await createScheduledTask({
      userId: user.id,
      fileId: testFile.id,
      cronExpression: '0 0 * * *',
      operations: [1, 2, 3],
    });

    // Verify scheduled task exists and is active
    const taskBefore = await dbClient.scheduledTask.findUnique({
      where: { uuid: scheduledTask.uuid },
    });
    expect(taskBefore).toBeTruthy();
    expect(taskBefore?.status).toBe('ACTIVE');

    // Delete the file
    await request(app)
      .delete('/v0/files/00000000-0000-4000-8000-000000000099')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Verify scheduled task is marked as DELETED
    const taskAfter = await dbClient.scheduledTask.findUnique({
      where: { uuid: scheduledTask.uuid },
    });
    expect(taskAfter).toBeTruthy();
    expect(taskAfter?.status).toBe('DELETED');
  });
});
