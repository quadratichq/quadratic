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
  const aiChat = await createAIChat({
    chatId: chatUuid,
    messageIndex,
  });
  chatId = aiChat.id;
});

afterAll(clearDb);

describe('POST /v0/ai/feedback', () => {
  describe('authentication', () => {
    it('responds with a 401 when the token is invalid', async () => {
      await request(app)
        .patch('/v0/ai/feedback')
        .set('Authorization', `Bearer InvalidToken user`)
        .send({
          ...payload,
          like: true,
        })
        .expect(401);
    });
  });

  describe('saves the feedback', () => {
    it('saves a like', async () => {
      let message = await dbClient.analyticsAIChatMessage.findUnique({
        where: {
          chatId_messageIndex: {
            chatId,
            messageIndex,
          },
        },
      });
      expect(message).toBeDefined();
      expect(message?.like).toBe(null);

      // create a like
      await request(app)
        .patch('/v0/ai/feedback')
        .set('Authorization', `Bearer ValidToken user`)
        .send({
          ...payload,
          like: true,
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.message).toBe('Feedback received');
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
      expect(message?.like).toBe(true);

      // set to dislike
      await request(app)
        .patch('/v0/ai/feedback')
        .set('Authorization', `Bearer ValidToken user`)
        .send({
          ...payload,
          like: false,
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.message).toBe('Feedback received');
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
      expect(message?.like).toBe(false);

      // unset like
      await request(app)
        .patch('/v0/ai/feedback')
        .set('Authorization', `Bearer ValidToken user`)
        .send({
          ...payload,
          like: null,
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body.message).toBe('Feedback received');
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
      expect(message?.like).toBe(null);
    });
  });
});
