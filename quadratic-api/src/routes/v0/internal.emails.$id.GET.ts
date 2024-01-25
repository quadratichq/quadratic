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
    return res
      .status(200)
      .type('html')
      .send(
        htmlDoc(
          templates.inviteToFile({
            fileName: '{{fileName}}',
            // @ts-expect-error
            fileRole: '{{fileRole}}',
            fileUuid: '{{fileUuid}}',
            origin: '{{origin}}',
            senderName: '{{senderName}}',
            senderEmail: '{{senderEmail}}',
          })
        )
      );
  }

  const keys = Object.keys(templates);
  return res
    .status(400)
    .type('html')
    .json({ error: 'Invalid email template ID. Valid IDs are: ' + keys.join(', ') + '.' });
}

function htmlDoc({ subject, html }: { subject: string; html: string }) {
  return /*html*/ `<!doctype html><html>
  <head>
    <meta charset="utf-8">
    <title>Invite to File</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline';">
    <style>
      body {
        font-family: sans-serif;
        margin: 0;
        padding: 0;
        max-width: 800px;
        margin: 0 auto;
        background: #f7f7f7;
      }
      iframe {
        background: #fff;
        padding: 64px;
        width: 100%;
        height: 60vh;
        border: none;
      }
    </style>
  </head>
  <body>
    <p><strong>Subject:</strong> ${subject}</p>
    <iframe srcDoc='${html.replace(/'/g, '')}'></iframe>
  </body>
  </html>`;
}
