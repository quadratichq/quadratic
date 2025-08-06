import { captureException } from '@sentry/react';
import mixpanel from 'mixpanel-browser';

export const sendAnalyticsError = (origin: string, from: string, error: Error | unknown, description?: string) => {
  console.error(error);

  try {
    const errorString = JSON.stringify(
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error
    );
    mixpanel.track(`[${origin}].error`, {
      title: from,
      description,
      error: errorString,
    });
  } catch (error) {
    console.error('Error sending Mixpanel error', error);
  }

  try {
    captureException(error, {
      level: 'error',
      extra: {
        origin,
        from,
        description,
      },
      tags: {
        origin,
        from,
        description,
      },
    });
  } catch (error) {
    console.error('Error sending Sentry error', error);
  }
};
