import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createUser } from '../../tests/testDataGenerator';

beforeEach(async () => {
  await createUser({ auth0Id: 'user1' });
});

afterEach(clearDb);

describe('POST /v0/user/tutorial-bonus-prompts', () => {
  describe('authentication', () => {
    it('responds with 401 if no token is provided', async () => {
      await request(app).post('/v0/user/tutorial-bonus-prompts').send({ category: 'share-file' }).expect(401);
    });
  });

  describe('validation', () => {
    it('responds with 400 if no category is provided', async () => {
      await request(app)
        .post('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .send({})
        .expect(400);
    });

    it('responds with 400 if category is invalid', async () => {
      await request(app)
        .post('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .send({ category: 'invalid-category' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toBe('Invalid bonus prompt category');
        });
    });
  });

  describe('awarding bonus prompts', () => {
    it('responds with 200 and awards bonus prompts for share-file', async () => {
      const user = await dbClient.user.findUnique({ where: { auth0Id: 'user1' } });
      const userId = user!.id;

      const response = await request(app)
        .post('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .send({ category: 'share-file' })
        .expect(200);

      expect(response.body).toEqual({
        category: 'share-file',
        promptsAwarded: 3,
        received: true,
      });

      // Verify the record was created in the database
      const bonusRecord = await dbClient.tutorialBonusPrompt.findUnique({
        where: {
          userId_category: {
            userId,
            category: 'share-file',
          },
        },
      });

      expect(bonusRecord).toBeDefined();
      expect(bonusRecord!.promptsAwarded).toBe(3);
    });

    it('responds with 200 and awards bonus prompts for watch-tutorial', async () => {
      const user = await dbClient.user.findUnique({ where: { auth0Id: 'user1' } });
      const userId = user!.id;

      const response = await request(app)
        .post('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .send({ category: 'watch-tutorial' })
        .expect(200);

      expect(response.body).toEqual({
        category: 'watch-tutorial',
        promptsAwarded: 1,
        received: true,
      });

      // Verify the record was created in the database
      const bonusRecord = await dbClient.tutorialBonusPrompt.findUnique({
        where: {
          userId_category: {
            userId,
            category: 'watch-tutorial',
          },
        },
      });

      expect(bonusRecord).toBeDefined();
      expect(bonusRecord!.promptsAwarded).toBe(1);
    });

    it('responds with 400 if bonus already claimed', async () => {
      const user = await dbClient.user.findUnique({ where: { auth0Id: 'user1' } });
      const userId = user!.id;

      // First claim
      await request(app)
        .post('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .send({ category: 'share-file' })
        .expect(200);

      // Second claim should fail
      await request(app)
        .post('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .send({ category: 'share-file' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toBe('Bonus already claimed for this category');
        });

      // Verify only one record exists
      const bonusRecords = await dbClient.tutorialBonusPrompt.findMany({
        where: {
          userId,
          category: 'share-file',
        },
      });

      expect(bonusRecords.length).toBe(1);
    });

    it('allows claiming different bonus categories', async () => {
      // Claim share-file
      await request(app)
        .post('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .send({ category: 'share-file' })
        .expect(200);

      // Claim watch-tutorial
      const response = await request(app)
        .post('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .send({ category: 'watch-tutorial' })
        .expect(200);

      expect(response.body).toEqual({
        category: 'watch-tutorial',
        promptsAwarded: 1,
        received: true,
      });
    });
  });
});

