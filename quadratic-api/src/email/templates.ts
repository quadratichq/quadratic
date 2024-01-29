import { UserFileRole } from 'quadratic-shared/typesAndSchemas';
import { Button, Layout, Link, Paragraph } from './components';

// Test any of these emails by doing a get with the template name to our
// internal endpoing: /v0/emails/:templateName
// e.g. `GET /v0/emails/inviteToFile`

export const templates = {
  inviteToFile: ({
    fileName,
    fileRole,
    fileUuid,
    origin,
    senderEmail,
    senderName,
  }: {
    fileName: string;
    fileRole: UserFileRole;
    fileUuid: string;
    origin: string;
    senderEmail: string;
    senderName: string | undefined;
  }) => {
    // TODO: we should probably use an env variable for this, but this works for now
    const fileUrl = `${origin}/file/${fileUuid}`;
    const subject = `${senderName ? senderName : 'Somebody'} shared a spreadsheet with you in Quadratic`;
    const verb = fileRole === 'EDITOR' ? 'edit' : 'view';
    const html = Layout(/*html*/ `
      ${Paragraph(/*html*/ `
        ${senderName ? senderName : senderEmail} invited you to ${verb} the spreadsheet: ${Link(fileName, {
        to: fileUrl,
      })}.
      `)}
      ${Button('Open in Quadratic', { to: fileUrl })} 
    `);

    return { subject, html };
  },
};
