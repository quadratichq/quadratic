import request from 'supertest';
import { app } from '../../app';
import { clearDb, createUser } from '../../tests/testDataGenerator';

beforeEach(async () => {
  await createUser({ auth0Id: 'test_user' });
});

afterEach(clearDb);

describe('PATCH /v0/user/ai-rules', () => {
  describe('bad request', () => {
    it('responds with 401 if no token is provided', async () => {
      await request(app).patch(`/v0/user/ai-rules`).send({ aiRules: 'test' }).expect(401);
    });

    it('responds with 400 if the payload is malformed', async () => {
      await request(app)
        .patch(`/v0/user/ai-rules`)
        .send({ foo: 'bar' })
        .set('Authorization', `Bearer ValidToken test_user`)
        .expect(400);
    });

    it('responds with 400 if the payload is empty', async () => {
      await request(app)
        .patch(`/v0/user/ai-rules`)
        .send({})
        .set('Authorization', `Bearer ValidToken test_user`)
        .expect(400);
    });
  });

  describe('update user AI rules', () => {
    it('accepts setting AI rules', async () => {
      await request(app)
        .patch(`/v0/user/ai-rules`)
        .send({ aiRules: 'Always be helpful and concise' })
        .set('Authorization', `Bearer ValidToken test_user`)
        .expect(200)
        .expect((res) => {
          expect(res.body.aiRules).toBe('Always be helpful and concise');
        });
    });

    it('accepts updating existing AI rules', async () => {
      // Set initial rules
      await request(app)
        .patch(`/v0/user/ai-rules`)
        .send({ aiRules: 'Initial rules' })
        .set('Authorization', `Bearer ValidToken test_user`)
        .expect(200);

      // Update rules
      await request(app)
        .patch(`/v0/user/ai-rules`)
        .send({ aiRules: 'Updated rules' })
        .set('Authorization', `Bearer ValidToken test_user`)
        .expect(200)
        .expect((res) => {
          expect(res.body.aiRules).toBe('Updated rules');
        });
    });

    it('accepts setting AI rules to null', async () => {
      // Set initial rules
      await request(app)
        .patch(`/v0/user/ai-rules`)
        .send({ aiRules: 'Some rules' })
        .set('Authorization', `Bearer ValidToken test_user`)
        .expect(200);

      // Clear rules
      await request(app)
        .patch(`/v0/user/ai-rules`)
        .send({ aiRules: null })
        .set('Authorization', `Bearer ValidToken test_user`)
        .expect(200)
        .expect((res) => {
          expect(res.body.aiRules).toBeNull();
        });
    });

    it('accepts empty string for AI rules', async () => {
      await request(app)
        .patch(`/v0/user/ai-rules`)
        .send({ aiRules: '' })
        .set('Authorization', `Bearer ValidToken test_user`)
        .expect(200)
        .expect((res) => {
          expect(res.body.aiRules).toBe('');
        });
    });
  });
});
