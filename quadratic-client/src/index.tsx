// Import the styles first in the order we want
import '@/index.css';
import '@/shared/shadcn/styles.css';

import { router } from '@/router';
import { initSentry } from '@/shared/utils/sentry';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

initSentry();

// This increases the size of the stack traces that are shown from Rust -> console.error
Error.stackTraceLimit = 100;

const container = document.getElementById('root');
const root = createRoot(container as HTMLElement);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
