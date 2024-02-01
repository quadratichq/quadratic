import sgMail from '@sendgrid/mail';
import * as Sentry from '@sentry/node';

let dontSendEmails = true;
if (process.env.SENDGRID_API_KEY) {
  dontSendEmails = false;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  // Don't try to send an email if we don't have the API key
  if (dontSendEmails) {
    console.log('[Development] console logging email:');
    console.log('  to: %s', to);
    console.log('  subject: %s', subject);
    console.log('  html: %s', html.slice(0, 10) + '...');
    return;
  }

  // Send it!
  try {
    await sgMail.send(msg);
  } catch (error) {
    Sentry.captureException(error);
  }
};
