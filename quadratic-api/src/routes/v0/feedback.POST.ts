import axios from 'axios';
import type express from 'express';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { NODE_ENV, SLACK_FEEDBACK_URL } from '../../env-vars';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import type { RequestWithUser } from '../../types/Request';
import logger from '../../utils/logger';

const RequestBodySchema = z.object({
  feedback: z.string(),
  userEmail: z.string().optional(),
});
type RequestBody = z.infer<typeof RequestBodySchema>;

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: express.Response) {
  const { feedback, userEmail }: RequestBody = RequestBodySchema.parse(req.body);

  // Add to DB
  await dbClient.qFeedback.create({
    data: {
      feedback,
      userId: req.user.id,
      created_date: new Date(),
    },
  });

  // See if the user has paid team(s)
  const userPaidTeams = await dbClient.userTeamRole.findMany({
    where: {
      userId: req.user.id,
      team: {
        stripeSubscriptionStatus: 'ACTIVE',
      },
    },
    include: {
      team: {
        select: {
          id: true,
        },
      },
    },
  });

  const payingUser = userPaidTeams.length > 0 ? '*💰 Paying user*' : '';

  // Post to Slack
  // SLACK_FEEDBACK_URL is the Quadratic product feedback slack app webhook URL
  // We filter out spammy feedback by requiring at least 15 characters
  if (SLACK_FEEDBACK_URL && feedback.length >= 15) {
    const payload = {
      text: [
        `📣 ${NODE_ENV === 'production' ? '' : '[STAGING]'} New product feedback`,
        `*From:* ${userEmail ? userEmail : `[no email]`} (${req.user.auth0Id}) ${payingUser}`,
        '*Message*:',
        feedback,
      ].join('\n\n'),
    };
    axios.post(SLACK_FEEDBACK_URL, payload).catch((error: Error) => {
      logger.warn('Failed to post feedback to Slack', { error });
    });
  }

  res.status(200).json({ message: 'Feedback submitted' });
}
