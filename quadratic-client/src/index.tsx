// Import the styles first in the order we want
import '@/index.css';
import '@/shared/shadcn/styles.css';

import { router } from '@/router';
import { browserTracingIntegration, captureConsoleIntegration, init } from '@sentry/react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

// Enable sentry only if SENTRY_DSN is in ENV
if (import.meta.env.VITE_SENTRY_DSN && import.meta.env.VITE_SENTRY_DSN !== 'none')
  init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT ?? 'development',
    integrations: [browserTracingIntegration(), captureConsoleIntegration({ levels: ['error', 'assert'] })],

    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 0.1,
  });

// This increases the size of the stack traces that are shown from Rust -> console.error
Error.stackTraceLimit = 100;

const container = document.getElementById('root');
const root = createRoot(container as HTMLElement);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
