import { trackEvent } from '@/shared/utils/analyticsEvents';
import { captureException } from '@sentry/react';

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
    trackEvent(`[${origin}].error`, {
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
