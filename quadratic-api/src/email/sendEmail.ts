import sgMail from '@sendgrid/mail';
import * as Sentry from '@sentry/node';
import { NODE_ENV, SENDGRID_API_KEY } from '../env-vars';
import logger from '../utils/logger';

let dontSendEmails = true;
if (SENDGRID_API_KEY) {
  dontSendEmails = false;
  sgMail.setApiKey(SENDGRID_API_KEY);
}

const from = {
  email: 'notify@email.quadratichq.com',
  name: 'Quadratic',
};

export const sendEmail = async (to: string, template: { subject: string; html: string }) => {
  const { subject, html } = template;
  const msg = {
    to,
    from,
    subject,
    html,
  };

  // Don't log anything if we're testing
  if (NODE_ENV === 'test') {
    return;
  }

  // Don't try to send an email if we don't have the API key
  if (dontSendEmails) {
    logger.info('Development email logging', {
      to,
      subject,
      htmlPreview: html.slice(0, 10) + '...',
    });
    return;
  }

  // Send it!
  try {
    await sgMail.send(msg);
  } catch (error) {
    Sentry.captureException(error);
  }
};
