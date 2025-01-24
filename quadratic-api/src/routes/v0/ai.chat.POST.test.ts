import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { clearDb, createFile, createTeam, createUser } from '../../tests/testDataGenerator';

const auth0Id = 'user';

const payload = {
  chatId: '00000000-0000-0000-0000-000000000000',
  fileUuid: '11111111-1111-1111-1111-111111111111',
  source: 'AIAnalyst',
  model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  messages: [],
  useStream: false,
  useTools: false,
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
          {
            type: 'text',
            text: 'This is a mocked response from Claude',
          },
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'example_tool',
            input: { param1: 'value1' },
          },
        ],
      }),
    },
  })),
}));

beforeAll(async () => {
  const user = await createUser({ auth0Id });
  const team = await createTeam({ users: [{ userId: user.id, role: 'OWNER' }] });
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
        .set('Authorization', `Bearer InvalidToken user`)
        .expect(401);
    });

    it('responds with model response when the token is valid', async () => {
      await request(app)
        .post('/v0/ai/chat')
        .send({ ...payload, chatId: '00000000-0000-0000-0000-000000000002' })
        .set('Authorization', `Bearer ValidToken user`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            role: 'assistant',
            content: 'This is a mocked response from Claude',
            contextType: 'userPrompt',
            toolCalls: [
              {
                id: 'tool_123',
                name: 'example_tool',
                arguments: JSON.stringify({ param1: 'value1' }),
                loading: false,
              },
            ],
            model: payload.model,
          });
        });

      // wait for the chat to be saved
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
  });

  describe('Analytics AI Chat', () => {
    beforeEach(async () => {
      await dbClient.$transaction([
        dbClient.analyticsAIChatMessage.deleteMany(),
        dbClient.analyticsAIChat.deleteMany(),
      ]);
    });

    it('saves the chat in storage when analyticsAi is enabled', async () => {
      const analyticsAIChatsBefore = await dbClient.analyticsAIChat.findMany();
      expect(analyticsAIChatsBefore.length).toBe(0);

      const user = await dbClient.user.findUnique({
        where: {
          auth0Id,
        },
      });
      expect(user).not.toBeNull();
      if (!user) {
        throw new Error('User not found');
      }

      const {
        file: { ownerTeam },
      } = await getFile({ uuid: payload.fileUuid, userId: user.id });
      expect(ownerTeam).not.toBeNull();
      if (!ownerTeam) {
        throw new Error('Owner team not found');
      }
      expect(ownerTeam.settingAnalyticsAi).toBe(true);

      await request(app)
        .post('/v0/ai/chat')
        .send({ ...payload, chatId: '00000000-0000-0000-0000-000000000003' })
        .set('Authorization', `Bearer ValidToken user`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            role: 'assistant',
            content: 'This is a mocked response from Claude',
            contextType: 'userPrompt',
            toolCalls: [
              {
                id: 'tool_123',
                name: 'example_tool',
                arguments: JSON.stringify({ param1: 'value1' }),
                loading: false,
              },
            ],
            model: payload.model,
          });
        });

      // wait for the chat to be saved
      await new Promise((resolve) => setTimeout(resolve, 250));

      const analyticsAIChatsAfter = await dbClient.analyticsAIChat.findMany();
      expect(analyticsAIChatsAfter.length).toBe(1);
    });

    it('does not save the chat in storage when analyticsAi is disabled', async () => {
      const analyticsAIChatsBefore = await dbClient.analyticsAIChat.findMany();
      expect(analyticsAIChatsBefore.length).toBe(0);

      const user = await dbClient.user.findUnique({
        where: {
          auth0Id,
        },
      });
      expect(user).not.toBeNull();
      if (!user) {
        throw new Error('User not found');
      }

      const {
        file: { ownerTeam },
      } = await getFile({ uuid: payload.fileUuid, userId: user.id });
      expect(ownerTeam).not.toBeNull();
      if (!ownerTeam) {
        throw new Error('Owner team not found');
      }
      expect(ownerTeam.settingAnalyticsAi).toBe(true);

      await request(app)
        .patch(`/v0/teams/${ownerTeam.uuid}`)
        .set('Authorization', `Bearer ValidToken user`)
        .send({ settings: { analyticsAi: false } })

        .expect(200)
        .expect((res) => {
          expect(res.body.settings.analyticsAi).toBe(false);
        });

      await request(app)
        .post('/v0/ai/chat')
        .set('Authorization', `Bearer ValidToken user`)
        .send({ ...payload, chatId: '00000000-0000-0000-0000-000000000004' })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            role: 'assistant',
            content: 'This is a mocked response from Claude',
            contextType: 'userPrompt',
            toolCalls: [
              {
                id: 'tool_123',
                name: 'example_tool',
                arguments: JSON.stringify({ param1: 'value1' }),
                loading: false,
              },
            ],
            model: payload.model,
          });
        });

      // wait for the chat to be saved
      await new Promise((resolve) => setTimeout(resolve, 250));

      const analyticsAIChatsAfter = await dbClient.analyticsAIChat.findMany();
      expect(analyticsAIChatsAfter.length).toBe(0);
    });
  });
});
