import { Response, NextFunction } from 'express';
import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { Request } from '../../../src/types/Request';

beforeAll(async () => {
  // Create a test user
  const user_1 = await dbClient.user.create({
    data: {
      auth0_id: 'test_user_1',
    },
  });

  // Create a test files
  await dbClient.file.create({
    data: {
      ownerUserId: user_1.id,
      name: 'test_file_1',
      contents: Buffer.from('contents_0'),
      uuid: '00000000-0000-4000-8000-000000000000',
      public_link_access: 'NOT_SHARED',
    },
  });

  await dbClient.file.create({
    data: {
      ownerUserId: user_1.id,
      name: 'test_file_2',
      contents: Buffer.from('contents_1'),
      uuid: '00000000-0000-4000-8000-000000000001',
      public_link_access: 'READONLY',
    },
  });
});

afterAll(async () => {
  const deleteUsers = dbClient.user.deleteMany();
  const deleteFiles = dbClient.file.deleteMany();

  await dbClient.$transaction([deleteFiles, deleteUsers]);
});

// For auth we expect the following Authorization header format:
// Bearer ValidToken {user.sub}
jest.mock('../../middleware/auth', () => {
  return {
    validateAccessToken: jest.fn().mockImplementation(async (req: Request, res: Response, next: NextFunction) => {
      // expected format is `Bearer ValidToken {user.sub}`
      if (req.headers.authorization?.substring(0, 17) === 'Bearer ValidToken') {
        req.auth = {
          sub: req.headers.authorization?.substring(18), // Extract user.sub from the Authorization header
        };
        return next();
      } else {
        return res.status(401).json({ error: { message: 'No authorization token was found' } });
      }
    }),
  };
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
      public_link_access: 'NOT_SHARED',
    });
    expect(res.body[0]).toHaveProperty('created_date');
    expect(res.body[0]).toHaveProperty('updated_date');
    expect(res.body[1]).toMatchObject({
      uuid: '00000000-0000-4000-8000-000000000001',
      name: 'test_file_2',
      public_link_access: 'READONLY',
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

describe('READ - GET /v0/files/:uuid no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-0000-0000-000000000000')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401); // Unauthorized

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
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
    const res = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body).toHaveProperty('file');
    expect(res.body).toHaveProperty('permission');
    expect(res.body.permission).toEqual('OWNER');
    expect(res.body.file.contents).toEqual({ data: [99, 111, 110, 116, 101, 110, 116, 115, 95, 48], type: 'Buffer' }); // contents_1
  });
});

describe('READ - GET /v0/files/:uuid with auth and another users file shared readonly', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000001')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body).toHaveProperty('file');
    expect(res.body).toHaveProperty('permission');
    expect(res.body.permission).toEqual('READONLY');
    expect(res.body.file.contents).toEqual({ data: [99, 111, 110, 116, 101, 110, 116, 115, 95, 49], type: 'Buffer' });
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

describe('UPDATE - POST /v0/files/:uuid no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/00000000-0000-0000-0000-000000000000')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401); // Unauthorized

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('UPDATE - POST /v0/files/:uuid file not found', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/00000000-0000-4000-8000-000000000009')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(404); // Not Found

    expect(res.body).toMatchObject({ error: { message: 'File not found' } });
  });
});

describe('UPDATE - POST /v0/files/:uuid with auth and owned file rename file', () => {
  it('responds with json', async () => {
    // change file name
    const res = await request(app)
      .post('/v0/files/00000000-0000-4000-8000-000000000000')
      .send({ name: 'test_file_1_new_name' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body).toMatchObject({ message: 'File updated.' });

    // check file name changed
    const res2 = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res2.body).toHaveProperty('file');
    expect(res2.body).toHaveProperty('permission');
    expect(res2.body.permission).toEqual('OWNER');
    expect(res2.body.file.name).toEqual('test_file_1_new_name');
    expect(Buffer.from(res2.body.file.contents).toString()).toEqual('contents_0');
  });
});

describe('UPDATE - POST /v0/files/:uuid with auth and owned file update file contents', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/00000000-0000-4000-8000-000000000000')
      .send({ contents: Buffer.from('contents_0_updated').toString('base64') })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body).toMatchObject({ message: 'File updated.' });

    // check file name changed
    const res2 = await request(app)
      .get('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res2.body).toHaveProperty('file');
    expect(res2.body).toHaveProperty('permission');
    expect(res2.body.permission).toEqual('OWNER');
    expect(res2.body.file.name).toEqual('test_file_1_new_name');
    expect(Buffer.from(res2.body.file.contents).toString()).toEqual('contents_0_updated');
  });
});

describe('UPDATE - POST /v0/files/:uuid with auth and another users file shared readonly', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/00000000-0000-4000-8000-000000000001')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(403); // OK

    expect(res.body).toMatchObject({ error: { message: 'Permission denied' } });
  });
});

describe('UPDATE - POST /v0/files/:uuid with auth and another users file not shared', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/00000000-0000-4000-8000-000000000000')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(403); // Forbidden

    expect(res.body).toMatchObject({ error: { message: 'Permission denied' } });
  });
});

describe('CREATE - POST /v0/files/ with no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('CREATE - POST /v0/files/ with auth (no file name, no contents)', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res.body).toMatchObject({ name: 'Untitled' });
    expect(res.body).toHaveProperty('uuid');
    expect(res.body).toHaveProperty('created_date');
    expect(res.body).toHaveProperty('updated_date');
  });
});

describe('CREATE - POST /v0/files/ with auth (file name, no contents)', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/')
      .send({ name: 'new_file_with_name' })
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res.body).toMatchObject({ name: 'new_file_with_name' });
    expect(res.body).toHaveProperty('uuid');
    expect(res.body).toHaveProperty('created_date');
    expect(res.body).toHaveProperty('updated_date');
  });
});

describe('CREATE - POST /v0/files/ with auth (file name, contents)', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .post('/v0/files/')
      .send({ name: 'new_file_with_name', contents: Buffer.from('new_file_contents').toString('base64') })
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res.body).toMatchObject({ name: 'new_file_with_name' });
    expect(res.body).toHaveProperty('uuid');
    expect(res.body).toHaveProperty('created_date');
    expect(res.body).toHaveProperty('updated_date');

    // check file name changed
    const res2 = await request(app)
      .get(`/v0/files/${res.body.uuid}`)
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res2.body).toHaveProperty('file');
    expect(res2.body).toHaveProperty('permission');
    expect(res2.body.permission).toEqual('OWNER');
    expect(res2.body.file.name).toEqual('new_file_with_name');
    expect(Buffer.from(res2.body.file.contents).toString()).toEqual('new_file_contents');
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
      .expect(400); // Not Found

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
