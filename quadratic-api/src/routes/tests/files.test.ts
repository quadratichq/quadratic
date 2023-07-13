import request from 'supertest';
import { app } from '../../index';

describe('GET /v0/files/ no auth', () => {
  it('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401); // Unauthorized

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});

describe('GET /v0/files/ with auth', () => {
  it.skip('responds with json', async () => {
    const res = await request(app)
      .get('/v0/files/')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200); // OK

    expect(res.body).toMatchObject({ error: { message: 'No authorization token was found' } });
  });
});
