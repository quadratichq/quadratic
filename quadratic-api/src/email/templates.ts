import { UserFileRole } from 'quadratic-shared/typesAndSchemas';
import { Bold, Button, Layout, Link, Paragraph } from './components';

// TODO: strategy for testing these emails ourselves
// POST {data} /api/v0/emails/invite-to-file

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
        ${Bold(senderName ? senderName : senderEmail)} has invited you to ${verb} the spreadsheet “${Bold(
        Link(fileName, { to: fileUrl })
      )}”.
      `)}
      ${Button('Open in Quadratic', { to: fileUrl })} 
    `);

    return { subject, html };
  },
};
