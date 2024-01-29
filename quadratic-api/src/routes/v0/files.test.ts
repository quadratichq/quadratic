import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { createFile } from '../../tests/testDataGenerator';

beforeAll(async () => {
  // Create a test user
  const user_1 = await dbClient.user.create({
    data: {
      auth0Id: 'test_user_1',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'test_user_2',
    },
  });

  // Create a test files
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerUserId: user_1.id,
      name: 'test_file_2',
      contents: Buffer.from('contents_1'),
      uuid: '00000000-0000-4000-8000-000000000001',
      publicLinkAccess: 'READONLY',
    },
  });
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerUserId: user_1.id,
      name: 'test_file_1',
      contents: Buffer.from('contents_0'),
      uuid: '00000000-0000-4000-8000-000000000000',
      publicLinkAccess: 'NOT_SHARED',
    },
  });
});

afterAll(async () => {
  await dbClient.$transaction([
    dbClient.fileInvite.deleteMany(),
    dbClient.userFileRole.deleteMany(),
    dbClient.team.deleteMany(),
    dbClient.fileCheckpoint.deleteMany(),
    dbClient.file.deleteMany(),
    dbClient.user.deleteMany(),
  ]);
});

describe('READ - GET /v0/files/ no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401); // Unauthorized

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('READ - GET /v0/files/ with auth and files', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body.length).toEqual(2);
    expect(res.body[0]).toMatchObject({
      uuid: '00000000-0000-4000-8000-000000000000',
      name: 'test_file_1',
      publicLinkAccess: 'NOT_SHARED',
      thumbnail: null,
    });
    expect(res.body[0]).toHaveProperty('createdDate');
    expect(res.body[0]).toHaveProperty('updatedDate');
    expect(res.body[1]).toMatchObject({
      uuid: '00000000-0000-4000-8000-000000000001',
      name: 'test_file_2',
      publicLinkAccess: 'READONLY',
      thumbnail: null,
    });
  });
});

describe('READ - GET /v0/files/ with auth and no files', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body.length).toEqual(0);
  });
});

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
        expect(res.body.file.name).toBe('test_file_2');
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
        expect(res.body.userMakingRequest.filePermissions).toEqual(['FILE_VIEW', 'FILE_EDIT', 'FILE_DELETE']);
        expect(res.body.userMakingRequest.isFileOwner).toBe(true);
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
        expect(res.body.userMakingRequest.isFileOwner).toBe(false);
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

describe('UPDATE - PATCH /v0/files/:uuid bad request', () => {
  it('responds with json', async () => {
    await request(app)
      .patch('/v0/files/00000000-0000-0000-0000-000000000000')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400);
  });
});

describe('UPDATE - PATCH /v0/files/:uuid no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .patch('/v0/files/00000000-0000-0000-0000-000000000000')
      .send({ name: 'new_name' })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401); // Unauthorized

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('UPDATE - PATCH /v0/files/:uuid file not found', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .patch('/v0/files/00000000-0000-4000-8000-000000000009')
      .send({ name: 'new_name' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(404); // Not Found

    expect(res.body).toMatchObject({ error: { message: 'File not found' } });
  });
});

describe('UPDATE - PATCH /v0/files/:uuid with auth and owned file rename file', () => {
  it('responds with json', async () => {
    // change file name
    const res = await request(app)
      .patch('/v0/files/00000000-0000-4000-8000-000000000000')
      .send({ name: 'test_file_1_new_name' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body.name).toBe('test_file_1_new_name');

    // check file name changed
    const res2 = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res2.body).toHaveProperty('file');
    expect(res2.body.userMakingRequest.filePermissions).toEqual(['FILE_VIEW', 'FILE_EDIT', 'FILE_DELETE']);
    expect(res2.body.file.name).toEqual('test_file_1_new_name');
  });
});

describe('UPDATE - PATCH /v0/files/:uuid with auth and another users file shared readonly', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .patch('/v0/files/00000000-0000-4000-8000-000000000001')
      .send({ name: 'new_name' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(403); // OK

    expect(res.body).toMatchObject({ error: { message: 'Permission denied' } });
  });
});

describe('UPDATE - PATCH /v0/files/:uuid with auth and another users file not shared', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .patch('/v0/files/00000000-0000-4000-8000-000000000000')
      .send({ name: 'new_name' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(403); // Forbidden

    expect(res.body).toMatchObject({ error: { message: 'Permission denied' } });
  });
});

describe('CREATE - POST /v0/files/ with no auth', () => {
  it('responds with json for a bad request', async () => {
    const res = await request(app)
      .post('/v0/files/')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/')
      .send({ name: 'new_file_with_name', contents: 'new_file_contents', version: '1.0.0' })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('CREATE - POST /v0/files/ with auth (no file name, no contents, no version)', () => {
  it('responds with json', async () => {
    await request(app)
      .post('/v0/files/')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400);
  });
});

describe('CREATE - POST /v0/files/ with auth (file name, no contents, no version)', () => {
  it('responds with json', async () => {
    await request(app)
      .post('/v0/files/')
      .send({ name: 'new_file_with_name' })
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400);
  });
});

describe('CREATE - POST /v0/files/ with auth (no file name, contents, no version)', () => {
  it('responds with json', async () => {
    await request(app)
      .post('/v0/files/')
      .send({ contents: 'new_file_contents' })
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400);
  });
});

describe('CREATE - POST /v0/files/ with auth (no file name, contents, with version)', () => {
  it('responds with json', async () => {
    await request(app)
      .post('/v0/files/')
      .send({ contents: 'new_file_contents', version: '1.0.0' })
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400);
  });
});

describe('CREATE - POST /v0/files/ with auth (file name, contents, no version)', () => {
  it('responds with json', async () => {
    await request(app)
      .post('/v0/files/')
      .send({ name: 'new_file_with_name', contents: 'new_file_contents' })
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400);
  });
});

describe('CREATE - POST /v0/files/ with auth (file name, contents, version)', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/')
      .send({ name: 'new_file_with_name', contents: 'new_file_contents', version: '1.0.0' })
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res.body).toMatchObject({ name: 'new_file_with_name' });
    expect(res.body).toHaveProperty('uuid');
    expect(res.body).toHaveProperty('createdDate');
    expect(res.body).toHaveProperty('updatedDate');

    // check file name changed
    const res2 = await request(app)
      .get(`/v0/files/${res.body.uuid}`)
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res2.body).toHaveProperty('file');
    expect(res2.body).toHaveProperty('userMakingRequest');
    expect(res2.body.userMakingRequest).toHaveProperty('filePermissions');
    expect(res2.body.file.name).toEqual('new_file_with_name');
    expect(res2.body.file.lastCheckpointVersion).toEqual('1.0.0');
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
    const res = await request(app)
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
