import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createUser } from '../../tests/testDataGenerator';

beforeEach(async () => {
  await createUser({ auth0Id: 'user1' });
});

afterEach(clearDb);

describe('GET /v0/user/tutorial-bonus-prompts', () => {
  describe('authentication', () => {
    it('responds with 401 if no token is provided', async () => {
      await request(app).get('/v0/user/tutorial-bonus-prompts').expect(401);
    });
  });

  describe('fetching bonus prompts', () => {
    it('responds with all active bonus prompts when user has received none', async () => {
      const response = await request(app)
        .get('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .expect(200);

      expect(response.body.bonusPrompts).toHaveLength(3);

      // Check share-file prompt
      const shareFile = response.body.bonusPrompts.find((bp: any) => bp.category === 'share-file');
      expect(shareFile).toEqual({
        category: 'share-file',
        name: 'Share',
        prompts: 3,
        received: false,
        active: true,
      });

      // Check watch-tutorial prompt
      const watchTutorial = response.body.bonusPrompts.find((bp: any) => bp.category === 'watch-tutorial');
      expect(watchTutorial).toEqual({
        category: 'watch-tutorial',
        name: 'Watch ~90s intro video',
        prompts: 1,
        received: false,
        active: true,
      });

      // Check prompt-ai prompt
      const promptAi = response.body.bonusPrompts.find((bp: any) => bp.category === 'prompt-ai');
      expect(promptAi).toEqual({
        category: 'prompt-ai',
        name: 'Prompt the AI',
        prompts: 3,
        received: false,
        active: true,
      });
    });

    it('shows received status for claimed bonuses', async () => {
      const user = await dbClient.user.findUnique({ where: { auth0Id: 'user1' } });
      const userId = user!.id;

      // Create a bonus prompt record for share-file
      await dbClient.tutorialBonusPrompt.create({
        data: {
          userId,
          category: 'share-file',
          promptsAwarded: 3,
        },
      });

      const response = await request(app)
        .get('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .expect(200);

      expect(response.body.bonusPrompts).toHaveLength(3);

      // Check share-file is marked as received
      const shareFile = response.body.bonusPrompts.find((bp: any) => bp.category === 'share-file');
      expect(shareFile).toEqual({
        category: 'share-file',
        name: 'Share',
        prompts: 3,
        received: true,
        active: true,
      });

      // Check watch-tutorial is not received
      const watchTutorial = response.body.bonusPrompts.find((bp: any) => bp.category === 'watch-tutorial');
      expect(watchTutorial).toEqual({
        category: 'watch-tutorial',
        name: 'Watch ~90s intro video',
        prompts: 1,
        received: false,
        active: true,
      });

      // Check prompt-ai is not received
      const promptAi = response.body.bonusPrompts.find((bp: any) => bp.category === 'prompt-ai');
      expect(promptAi).toEqual({
        category: 'prompt-ai',
        name: 'Prompt the AI',
        prompts: 3,
        received: false,
        active: true,
      });
    });

    it('shows all received bonuses even when all have been claimed', async () => {
      const user = await dbClient.user.findUnique({ where: { auth0Id: 'user1' } });
      const userId = user!.id;

      // Create bonus prompt records for all categories
      await dbClient.tutorialBonusPrompt.createMany({
        data: [
          {
            userId,
            category: 'share-file',
            promptsAwarded: 3,
          },
          {
            userId,
            category: 'watch-tutorial',
            promptsAwarded: 1,
          },
          {
            userId,
            category: 'prompt-ai',
            promptsAwarded: 3,
          },
        ],
      });

      const response = await request(app)
        .get('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .expect(200);

      expect(response.body.bonusPrompts).toHaveLength(3);

      // All should be marked as received
      response.body.bonusPrompts.forEach((bp: any) => {
        expect(bp.received).toBe(true);
        expect(bp.active).toBe(true);
      });
    });

    it('includes inactive bonuses that were received', async () => {
      const user = await dbClient.user.findUnique({ where: { auth0Id: 'user1' } });
      const userId = user!.id;

      // Create a bonus prompt record for a category that no longer exists in BONUS_PROMPTS
      await dbClient.tutorialBonusPrompt.create({
        data: {
          userId,
          category: 'old-inactive-category',
          promptsAwarded: 5,
        },
      });

      const response = await request(app)
        .get('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .expect(200);

      // Should have 4 prompts: 3 active + 1 inactive
      expect(response.body.bonusPrompts).toHaveLength(4);

      // Check the inactive bonus is included
      const inactiveBonus = response.body.bonusPrompts.find((bp: any) => bp.category === 'old-inactive-category');
      expect(inactiveBonus).toEqual({
        category: 'old-inactive-category',
        name: 'old-inactive-category', // Falls back to category name
        prompts: 5, // Uses the awarded amount
        received: true,
        active: false,
      });
    });

    it('sorts active bonuses before inactive bonuses', async () => {
      const user = await dbClient.user.findUnique({ where: { auth0Id: 'user1' } });
      const userId = user!.id;

      // Create bonus records including an inactive one
      await dbClient.tutorialBonusPrompt.createMany({
        data: [
          {
            userId,
            category: 'share-file',
            promptsAwarded: 3,
          },
          {
            userId,
            category: 'old-inactive-category',
            promptsAwarded: 5,
          },
        ],
      });

      const response = await request(app)
        .get('/v0/user/tutorial-bonus-prompts')
        .set('Authorization', 'Bearer ValidToken user1')
        .expect(200);

      const bonusPrompts = response.body.bonusPrompts;
      expect(bonusPrompts).toHaveLength(4);

      // Active ones should come first
      const activeCount = bonusPrompts.filter((bp: any) => bp.active).length;
      const inactiveCount = bonusPrompts.filter((bp: any) => !bp.active).length;

      expect(activeCount).toBe(3);
      expect(inactiveCount).toBe(1);

      // Check that all active ones come before inactive ones
      let foundInactive = false;
      for (const bp of bonusPrompts) {
        if (!bp.active) {
          foundInactive = true;
        } else if (foundInactive) {
          // If we found an inactive one and then found an active one, sorting is wrong
          fail('Active bonus prompts should come before inactive ones');
        }
      }
    });
  });
});

