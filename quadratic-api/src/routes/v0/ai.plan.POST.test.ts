import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createTeam, createUser, upgradeTeamToPro } from '../../tests/testDataGenerator';

const auth0Id = 'user';

jest.mock('@anthropic-ai/bedrock-sdk', () => ({
  AnthropicBedrock: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        id: 'msg_mock123',
        content: [
          {
            type: 'text',
            text: 'Goal: Create a sales tracking spreadsheet\n\nData:\n- Sales data from CRM\n- Product catalog\n\nAnalysis:\n- Monthly sales trends chart\n- Top products by revenue\n\nSteps:\n1. Import sales data\n2. Create pivot table\n3. Generate charts',
          },
        ],
        usage: {
          input_tokens: 150,
          output_tokens: 80,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      }),
    },
  })),
}));

let teamId: number;
let userId: number;
let teamUuid: string;

beforeAll(async () => {
  const user = await createUser({ auth0Id });
  userId = user.id;
  const team = await createTeam({ users: [{ userId: user.id, role: 'OWNER' }] });
  teamId = team.id;
  teamUuid = team.uuid;
});

afterAll(clearDb);

describe('POST /v0/ai/plan', () => {
  describe('authentication', () => {
    it('responds with a 401 when the token is invalid', async () => {
      await request(app)
        .post('/v0/ai/plan')
        .send({
          teamUuid,
          prompt: 'Create a sales tracker',
          context: {},
        })
        .set('Authorization', `Bearer InvalidToken user`)
        .expect(401);
    });

    it('responds with plan when the token is valid', async () => {
      await upgradeTeamToPro(teamId);
      await request(app)
        .post('/v0/ai/plan')
        .send({
          teamUuid,
          prompt: 'Create a sales tracker',
          context: {},
        })
        .set('Authorization', `Bearer ValidToken user`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toHaveProperty('plan');
          expect(body.plan).toContain('Goal:');
          expect(body.isOnPaidPlan).toBe(true);
          expect(body.exceededBillingLimit).toBe(false);
        });

      // wait for cost tracking to complete
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    it('tracks AI cost in database after successful request', async () => {
      await upgradeTeamToPro(teamId);

      await request(app)
        .post('/v0/ai/plan')
        .send({
          teamUuid,
          prompt: 'Create a budget tracker',
          context: {},
        })
        .set('Authorization', `Bearer ValidToken user`)
        .expect(200);

      // wait for cost tracking to complete
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Verify cost was tracked
      const costs = await dbClient.aICost.findMany({
        where: {
          userId,
          teamId: teamId,
          source: 'AIAnalyst',
        },
        orderBy: {
          createdDate: 'desc',
        },
      });

      expect(costs.length).toBeGreaterThan(0);
      const cost = costs[0]; // Get the most recent cost
      expect(cost.userId).toBe(userId);
      expect(cost.teamId).toBe(teamId);
      expect(cost.fileId).toBeNull(); // Plans are team-scoped, not file-scoped
      expect(cost.cost).toBeGreaterThan(0);
      expect(cost.source).toBe('AIAnalyst');
      expect(cost.inputTokens).toBe(150);
      expect(cost.outputTokens).toBe(80);
    });

    it('returns 403 when user is not a member of the team', async () => {
      const otherUser = await createUser({ auth0Id: 'other-user' });
      const otherTeam = await createTeam({ users: [{ userId: otherUser.id, role: 'OWNER' }] });

      await request(app)
        .post('/v0/ai/plan')
        .send({
          teamUuid: otherTeam.uuid,
          prompt: 'Create a tracker',
          context: {},
        })
        .set('Authorization', `Bearer ValidToken user`)
        .expect(403);
    });
  });
});
