import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createAIChat } from '../../tests/testDataGenerator';

let chatId: number;
const chatUuid = '00000000-0000-0000-0000-000000000000';
const messageIndex = 1;

const payload = {
  chatId: chatUuid,
  messageIndex,
};

beforeAll(async () => {
  const aiChat = await createAIChat({ chatId: payload.chatId });
  chatId = aiChat.id;
});

afterAll(clearDb);

describe('POST /v0/ai/codeRunError', () => {
  describe('authentication', () => {
    it('responds with a 401 when the token is invalid', async () => {
      await request(app)
        .patch('/v0/ai/codeRunError')
        .set('Authorization', `Bearer InvalidToken user`)
        .send({
          ...payload,
          codeRunError: 'Error',
        })
        .expect(401);
    });
  });

  describe('saves the codeRunError', () => {
    it('saves codeRunError', async () => {
      let message = await dbClient.analyticsAIChatMessage.findUnique({
        where: {
          chatId_messageIndex: {
            chatId,
            messageIndex,
          },
        },
      });
      expect(message).toBeDefined();
      expect(message?.codeRunError).toBe(null);

      // save error
      await request(app)
        .patch('/v0/ai/codeRunError')
        .set('Authorization', `Bearer ValidToken user`)
        .send({
          ...payload,
          codeRunError: 'Error',
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.message).toBe('Code run error received');
        });
      message = await dbClient.analyticsAIChatMessage.findUnique({
        where: {
          chatId_messageIndex: {
            chatId,
            messageIndex,
          },
        },
      });
      expect(message).toBeDefined();
      expect(message?.codeRunError).toBe('Error');
    });
  });
});
