import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ShowAfter } from './components/ShowAfter';
import { REACT_APP_SENTRY_DSN } from './constants/env';
import reportWebVitals from './reportWebVitals';
import { router } from './router';
import './styles.css';
import { QuadraticLoading } from './ui/loading/QuadraticLoading';

if (REACT_APP_SENTRY_DSN)
  Sentry.init({
    dsn: REACT_APP_SENTRY_DSN,
    integrations: [new BrowserTracing()],

    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 1.0,
  });

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
