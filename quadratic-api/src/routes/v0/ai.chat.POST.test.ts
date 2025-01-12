import request from 'supertest';
import { app } from '../../app';
import { clearDb, createFile, createTeam, createUser } from '../../tests/testDataGenerator';

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

beforeAll(async () => {
  const user = await createUser({ auth0Id: 'user' });
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

describe('POST /v0/ai/chat', () => {
  describe('an unauthorized user', () => {
    it('responds with a 401', async () => {
      await request(app).post('/v0/ai/chat').send(payload).set('Authorization', `Bearer InvalidToken user`).expect(401);
    });
  });

  describe('an authorized user', () => {
    it('responds with a 200', async () => {
      await request(app)
        .post('/v0/ai/chat')
        .send(payload)
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
    });
  });
});
