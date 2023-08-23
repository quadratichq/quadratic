import axios from 'axios';
import express from 'express';
import { z } from 'zod';
import dbClient from '../dbClient';
import { userMiddleware } from '../middleware/user';
import { validateAccessToken } from '../middleware/validateAccessToken';
import { Request } from '../types/Request';

const files_router = express.Router();

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
  await dbClient.qFeedback.create({
    data: {
      feedback,
      userId: req.user.id,
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

  res.status(200).json({ message: 'Feedback submitted' });
});

export default files_router;
