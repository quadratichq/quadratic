import { Response } from 'express';
import z from 'zod';
import { templates } from '../../email/templates';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        id: z.string(),
      }),
    })
  ),
  handler,
];

async function handler(req: RequestWithUser, res: Response) {
  const {
    params: { id },
  } = req;

  if (id === 'inviteToFile') {
    return res.status(200).json(
      templates.inviteToFile({
        fileName: '{{fileName}}',
        // @ts-expect-error
        fileRole: '{{fileRole}}',
        fileUuid: '{{fileUuid}}',
        origin: '{{origin}}',
        senderName: '{{senderName}}',
        senderEmail: '{{senderEmail}}',
      })
    );
  }

  const keys = Object.keys(templates);
  return res.status(400).json({ error: 'Invalid email template ID. Valid IDs are: ' + keys.join(', ') + '.' });
}
