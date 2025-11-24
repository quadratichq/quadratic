import request from 'supertest';
import { app } from '../../app';
import { clearDb, createUser } from '../../tests/testDataGenerator';

beforeEach(async () => {
  await createUser({ auth0Id: 'test_user' });
});

afterEach(clearDb);

describe('GET /v0/user/ai-rules', () => {
  describe('bad request', () => {
    it('responds with 401 if no token is provided', async () => {
      await request(app).get(`/v0/user/ai-rules`).expect(401);
    });
  });

  describe('get user AI rules', () => {
    it('responds with null when user has no AI rules', async () => {
      await request(app)
        .get(`/v0/user/ai-rules`)
        .set('Authorization', `Bearer ValidToken test_user`)
        .expect(200)
        .expect((res) => {
          expect(res.body.aiRules).toBeNull();
        });
    });

    it('responds with AI rules when user has them set', async () => {
      // Set AI rules first
      await request(app)
        .patch(`/v0/user/ai-rules`)
        .send({ aiRules: 'Always be helpful and concise' })
        .set('Authorization', `Bearer ValidToken test_user`)
        .expect(200);

      // Then get them
      await request(app)
        .get(`/v0/user/ai-rules`)
        .set('Authorization', `Bearer ValidToken test_user`)
        .expect(200)
        .expect((res) => {
          expect(res.body.aiRules).toBe('Always be helpful and concise');
        });
    });
  });
});
