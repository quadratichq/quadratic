import request from 'supertest';
import { app } from '../../app';
import { AI_ALLOWANCE_BUSINESS, AI_ALLOWANCE_PRO } from '../../env-vars';
import { expectError } from '../../tests/helpers';
import { clearDb, createUser } from '../../tests/testDataGenerator';

beforeEach(async () => {
  await createUser({ auth0Id: 'configUser' });
});

afterEach(clearDb);

describe('GET /v0/billing/config', () => {
  it('responds with a 401 when the token is invalid', async () => {
    await request(app)
      .get('/v0/billing/config')
      .set('Authorization', 'Bearer InvalidToken configUser')
      .expect(401)
      .expect(expectError);
  });

  it('responds with a 200 and returns AI allowance config', async () => {
    await request(app)
      .get('/v0/billing/config')
      .set('Authorization', 'Bearer ValidToken configUser')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          proAiAllowance: AI_ALLOWANCE_PRO,
          businessAiAllowance: AI_ALLOWANCE_BUSINESS,
        });
      });
  });
});
