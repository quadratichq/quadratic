import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createTeam, createUser, upgradeTeamToPro } from '../../tests/testDataGenerator';

const auth0Id = 'user';

const mockPlanText =
  'Goal: Create a sales tracking spreadsheet\n\nData:\n- Sales data from CRM\n- Product catalog\n\nAnalysis:\n- Monthly sales trends chart\n- Top products by revenue\n\nSteps:\n1. Import sales data\n2. Create pivot table\n3. Generate charts';

jest.mock('../../ai/handler/ai.handler', () => ({
  handleAIRequest: jest
    .fn()
    .mockImplementation(async ({ isOnPaidPlan, exceededBillingLimit, response }: Record<string, unknown>) => {
      const parsedResponse = {
        responseMessage: {
          role: 'assistant',
          content: [{ type: 'text', text: mockPlanText }],
          contextType: 'userPrompt',
          toolCalls: [],
        },
        usage: {
          inputTokens: 150,
          outputTokens: 80,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      };

      // The plan handler enters the streaming path (SSE) by default.
      // Write a JSON response so the test can validate the plan content.
      const res = response as { headersSent?: boolean; writeHead?: Function; end?: Function } | undefined;
      if (res && !res.headersSent) {
        res.writeHead?.(200, { 'Content-Type': 'application/json' });
        res.end?.(
          JSON.stringify({
            plan: mockPlanText,
            isOnPaidPlan,
            exceededBillingLimit,
          })
        );
      }

      return parsedResponse;
    }),
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
