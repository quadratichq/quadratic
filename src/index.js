import * as Sentry from '@sentry/react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ShowAfter } from './components/ShowAfter';
import reportWebVitals from './reportWebVitals';
import { router } from './router';
import './shadcn/styles.css';
import './styles.css';
import { QuadraticLoading } from './ui/loading/QuadraticLoading';

// Enable sentry only if SENTRY_DSN is in ENV
if (process.env.REACT_APP_SENTRY_DSN && process.env.REACT_APP_SENTRY_DSN !== 'none')
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.REACT_APP_ENVIRONMENT ?? 'development',
    integrations: [new Sentry.BrowserTracing()],

    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 0.1,
  });

Sentry.addTracingExtensions();

const container = document.getElementById('root');
const root = createRoot(container);
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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
