import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import reportWebVitals from './reportWebVitals';
import * as Sentry from '@sentry/react';
import {
  Route,
  RouterProvider,
  createRoutesFromElements,
  createBrowserRouter,
  Outlet,
  useRouteError,
} from 'react-router-dom';
import { BrowserTracing } from '@sentry/tracing';

import { Auth0ProviderWithNavigate } from './auth0-provider-with-navigate';

// Enable sentry only if SENTRY_DSN is in ENV
if (process.env.REACT_APP_SENTRY_DSN && process.env.REACT_APP_SENTRY_DSN !== 'none')
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    integrations: [new BrowserTracing()],

    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 1.0,
  });

const ErrorElement = () => {
  let error = useRouteError();
  console.error(error);
  return <div>Oops. Something went wrong. Don't forget to add this component</div>;
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      path="/"
      element={
        <Auth0ProviderWithNavigate>
          <Outlet />
        </Auth0ProviderWithNavigate>
      }
      errorElement={<ErrorElement />}
    >
      <Route path="file" lazy={() => import('./routes/File')} />
      <Route path="files" lazy={() => import('./routes/Files')} />
    </Route>
  )
);

ReactDOM.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
