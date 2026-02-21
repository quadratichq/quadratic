import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { AIRequestBody } from 'quadratic-shared/typesAndSchemasAI';
import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createFile, createTeam, createUser, upgradeTeamToPro } from '../../tests/testDataGenerator';

const auth0Id = 'ai-chat-post-test-user';

const payload: AIRequestBody = {
  chatId: '00000000-0000-0000-0000-000000000000',
  fileUuid: '11111111-1111-1111-1111-111111111111',
  source: 'AIAnalyst',
  messageSource: 'User',
  modelKey: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-5-20250929-v1:0:thinking-toggle-on',
  messages: [
    {
      role: 'user',
      content: [createTextContent('Hello')],
      contextType: 'userPrompt',
    },
  ],
  useStream: false,
  toolName: undefined,
  useToolsPrompt: false,
  language: undefined,
  useQuadraticContext: false,
};

jest.mock('@anthropic-ai/bedrock-sdk', () => ({
  AnthropicBedrock: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        id: 'msg_mock123',
        content: [
          createTextContent('This is a mocked response from Claude'),
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'example_tool',
            input: { param1: 'value1' },
          },
        ],
        usage: {
          input_tokens: 100,
          output_tokens: 100,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
      }),
    },
  })),
}));

let teamId: number;
beforeAll(async () => {
  const user = await createUser({ auth0Id });
  const team = await createTeam({ users: [{ userId: user.id, role: 'OWNER' }] });
  teamId = team.id;
  await createFile({
    data: {
      uuid: payload.fileUuid,
      name: 'Untitled',
      ownerTeamId: team.id,
      creatorUserId: user.id,
    },
  });
});

afterAll(clearDb);

describe('POST /v0/ai/chat', () => {
  describe('authentication', () => {
    it('responds with a 401 when the token is invalid', async () => {
      await request(app)
        .post('/v0/ai/chat')
        .send({ ...payload, chatId: '00000000-0000-0000-0000-000000000001' })
        .set('Authorization', `Bearer InvalidToken ${auth0Id}`)
        .expect(401);
    });

    it('responds with model response when the token is valid', async () => {
      await upgradeTeamToPro(teamId);
      await request(app)
        .post('/v0/ai/chat')
        .send({ ...payload, chatId: '00000000-0000-0000-0000-000000000002' })
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            role: 'assistant',
            content: [createTextContent('This is a mocked response from Claude')],
            contextType: 'userPrompt',
            toolCalls: [
              {
                id: 'tool_123',
                name: 'example_tool',
                arguments: JSON.stringify({ param1: 'value1' }),
                loading: false,
              },
            ],
            modelKey: payload.modelKey,
            isOnPaidPlan: true,
            exceededBillingLimit: false,
            usage: {
              inputTokens: 100,
              outputTokens: 100,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
            },
          });
        });

      // wait for the chat to be saved
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    it('tracks AI cost in database after successful request', async () => {
      await upgradeTeamToPro(teamId);
      const user = await dbClient.user.findUnique({ where: { auth0Id } });
      if (!user) throw new Error('User not found');

      await request(app)
        .post('/v0/ai/chat')
        .send({ ...payload, chatId: '00000000-0000-0000-0000-000000000003' })
        .set('Authorization', `Bearer ValidToken ${auth0Id}`)
        .expect(200);

      // wait for cost tracking to complete
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Verify cost was tracked
      const costs = await dbClient.aICost.findMany({
        where: {
          userId: user.id,
          teamId: teamId,
        },
      });

      expect(costs.length).toBeGreaterThan(0);
      const cost = costs[costs.length - 1]; // Get the most recent cost
      expect(cost.userId).toBe(user.id);
      expect(cost.teamId).toBe(teamId);
      expect(cost.fileId).toBeDefined();
      expect(cost.cost).toBeGreaterThan(0);
      expect(cost.model).toBe(payload.modelKey);
      expect(cost.source).toBe('AIAnalyst');
      expect(cost.inputTokens).toBe(100);
      expect(cost.outputTokens).toBe(100);
    });
  });
});
