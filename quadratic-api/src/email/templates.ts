import type { UserFileRole, UserTeamRole } from 'quadratic-shared/typesAndSchemas';
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
      })}
      `)}
      ${Button('Open in Quadratic', { to: fileUrl })} 
    `);

    return { subject, html };
  },
  inviteToTeam: ({
    teamName,
    teamRole,
    teamUuid,
    origin,
    senderEmail,
    senderName,
  }: {
    teamName: string;
    teamRole: UserTeamRole;
    teamUuid: string;
    origin: string;
    senderEmail: string;
    senderName: string | undefined;
  }) => {
    const teamUrl = `${origin}/teams/${teamUuid}`;
    const subject = `${senderName ? senderName : 'Somebody'} added you to a team in Quadratic`;
    const noun = teamRole === 'OWNER' ? 'an owner' : teamRole === 'EDITOR' ? 'an editor' : 'a viewer';
    const html = Layout(/*html*/ `
      ${Paragraph(/*html*/ `
        ${senderName ? senderName : senderEmail} added you as ${noun} to the team: ${Link(teamName, {
        to: teamUrl,
      })}
      `)}
      ${Button('Open in Quadratic', { to: teamUrl })} 
    `);

    return { subject, html };
  },
};
