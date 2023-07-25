import express from 'express';
import axios from 'axios';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { validateAccessToken } from '../middleware/auth';
import { userMiddleware } from '../middleware/user';
import { Request } from '../types/Request';

const files_router = express.Router();
const prisma = new PrismaClient();

const RequestBodySchema = z.object({
  feedback: z.string(),
  userEmail: z.string().optional(),
});
type RequestBody = z.infer<typeof RequestBodySchema>;

files_router.post('/', validateAccessToken, userMiddleware, async (req: Request, res) => {
  const { feedback, userEmail }: RequestBody = RequestBodySchema.parse(req.body);

  if (!req.user) {
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }

  // Add to DB
  await prisma.qFeedback.create({
    data: {
      feedback,
      qUserId: req.user.id,
      created_date: new Date(),
    },
  });

  // Post to Slack
  // SLACK_FEEDBACK_URL is the Quadratic product feedback slack app webhook URL
  if (process.env.SLACK_FEEDBACK_URL) {
    const payload = {
      text: [
        `📣 ${process.env.NODE_ENV === 'production' ? '' : '[STAGING]'} New product feedback`,
        `*From:* ${userEmail ? userEmail : `[no email]`} (${req.user.auth0_id})`,
        '*Message*:',
        feedback,
      ].join('\n\n'),
    };
    axios.post(process.env.SLACK_FEEDBACK_URL, payload).catch((e: Error) => {
      console.log('Failed to post feedback to Slack', e);
    });
  }

  res.status(200).end();
});

export default files_router;
