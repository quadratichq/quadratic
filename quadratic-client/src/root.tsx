// Import the styles first in the order we want
import '@/index.css';
import '@/shared/shadcn/styles.css';

import { GoogleTagManager, GoogleTagManagerNoScript } from '@/shared/components/GoogleTagManager';
import * as Sentry from '@sentry/react';
import React from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';

// Enable sentry only if SENTRY_DSN is in ENV
if (import.meta.env.VITE_SENTRY_DSN && import.meta.env.VITE_SENTRY_DSN !== 'none')
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT ?? 'development',
    integrations: [Sentry.browserTracingIntegration(), Sentry.captureConsoleIntegration()],

    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 0.1,
  });

// This increases the size of the stack traces that are shown from Rust -> console.error
Error.stackTraceLimit = 100;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-material-symbols-loaded="false">
      <head>
        <meta charSet="UTF-8" />
        <meta content="True" name="HandheldFriendly" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#FFFFFF" />
        <link rel="apple-touch-icon" href="/logo192.png" />
        <link rel="icon" href="/favicon.ico" />
        <title>My App</title>
        {/*
          manifest.json provides metadata used when your web app is installed on a
          user's mobile device or desktop. See https://developers.google.com/web/fundamentals/web-app-manifest/
        */}
        <link rel="manifest" href="/manifest.json" />
        <title>Quadratic</title>

        {/* Social share meta info */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Quadratic" />
        <meta property="og:description" content="Modern spreadsheet software." />
        <meta property="og:url" content="https://app.quadratichq.com" />
        <meta property="og:image" content="https://app.quadratichq.com/images/social.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@quadratichq" />
        <meta name="twitter:title" content="Quadratic" />
        <meta name="twitter:description" content="Modern spreadsheet software." />
        <meta name="twitter:image" content="https://app.quadratichq.com/images/social.png" />

        {/* Material symbols font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,400,0,0&display=block"
          rel="stylesheet"
        />

        <Meta />
        <Links />

        <GoogleTagManager />
      </head>
      <body>
        <GoogleTagManagerNoScript />
        <noscript>You need to enable JavaScript to run this app.</noscript>

        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}

export const HydrateFallback = () => {
  return (
    <div className="flex h-full select-none items-center justify-center">
      <img src="/public/images/logo_loading.gif" width="100" height="100" alt="Loading Quadratic logo" />
    </div>
  );
};

// TODO: add error boundary
