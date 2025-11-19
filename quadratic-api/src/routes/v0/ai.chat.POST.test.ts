import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { AIRequestBody } from 'quadratic-shared/typesAndSchemasAI';
import request from 'supertest';
import { app } from '../../app';
import { clearDb, createFile, createTeam, createUser, upgradeTeamToPro } from '../../tests/testDataGenerator';

const auth0Id = 'user';

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

// Mock LangChain AWS Bedrock
jest.mock('@langchain/aws', () => ({
  ChatBedrockConverse: jest.fn().mockImplementation(() => {
    const mockModel = {
      invoke: jest.fn().mockResolvedValue({
        content: 'This is a mocked response from Claude',
        tool_calls: [
          {
            id: 'tool_123',
            name: 'example_tool',
            args: { param1: 'value1' },
          },
        ],
        response_metadata: {
          usage: {
            input_tokens: 100,
            output_tokens: 100,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        },
      }),
      bindTools: jest.fn().mockReturnThis(),
    };
    // Make bindTools return the same mock model
    mockModel.bindTools.mockReturnValue(mockModel);
    return mockModel;
  }),
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
        .set('Authorization', `Bearer InvalidToken user`)
        .expect(401);
    });

    it('responds with model response when the token is valid', async () => {
      await upgradeTeamToPro(teamId);
      await request(app)
        .post('/v0/ai/chat')
        .send({ ...payload, chatId: '00000000-0000-0000-0000-000000000002' })
        .set('Authorization', `Bearer ValidToken user`)
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
          });
        });

      // wait for the chat to be saved
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
  });
});
