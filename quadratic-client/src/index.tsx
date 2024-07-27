import * as Sentry from '@sentry/react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { QuadraticLoading } from '@/app/ui/loading/QuadraticLoading';
import '@/index.css';
import { router } from '@/router';
import { ShowAfter } from '@/shared/components/ShowAfter';
import '@/shared/shadcn/styles.css';

// Enable sentry only if SENTRY_DSN is in ENV
if (import.meta.env.VITE_SENTRY_DSN && import.meta.env.VITE_SENTRY_DSN !== 'none')
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT ?? 'development',
    integrations: [Sentry.browserTracingIntegration()],

    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 0.1,
  });

Sentry.addTracingExtensions();

// This increases the size of the stack traces that are shown from Rust -> console.error
Error.stackTraceLimit = 100;

const container = document.getElementById('root');
const root = createRoot(container as HTMLElement);
root.render(
  <React.StrictMode>
    <RouterProvider
      router={router}
      fallbackElement={
        <ShowAfter delay={2000}>
          <QuadraticLoading />
        </ShowAfter>
      }
    />
  </React.StrictMode>
);
