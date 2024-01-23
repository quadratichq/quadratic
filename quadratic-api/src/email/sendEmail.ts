import sgMail from '@sendgrid/mail';
import * as Sentry from '@sentry/node';

const apiKey = String(process.env.SENDGRID_API_KEY);
sgMail.setApiKey(apiKey);

const from = 'support@quadratichq.com';

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
  if (!apiKey) {
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
