import { ROUTES, ROUTE_LOADER_IDS, SEARCH_PARAMS } from '@/shared/constants/routes';
import type { ShouldRevalidateFunctionArgs } from 'react-router';
import { Navigate, Route, createBrowserRouter, createRoutesFromElements, redirect } from 'react-router';

/**
 * When adding a new first level route, make sure to add it to the cloudflare as well for both QA and Prod
 * Cloudflare redirects the all the root and subroutes to the index.html file
 *
 * currently the cloudflare routes are:
 *  - *.quadratichq.com/teams/*
 *  - *.quadratichq.com/files/*
 *  - *.quadratichq.com/file/*
 *  - *.quadratichq.com/education/*
 *  - *.quadratichq.com/api/*
 *  - *.quadratichq.com/templates
 *  - *.quadratichq.com/account
 *  - *.quadratichq.com/login
 *  - *.quadratichq.com/login-result*
 *  - *.quadratichq.com/logout
 *  - *.quadratichq.com/education
 *  - *.quadratichq.com/onboarding
 *  - *.quadratichq.com/iframe-indexeddb
 *
 *  To add a new route:
 *  1. go to the respective cloudflare account (QA / Prod)
 *  2. go to the "Rules" tab
 *  3. go to `Rewrite Path for Object Storage Bucket [Template]` rule
 *  4. add the new route with a `OR` condition
 **/

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route lazy={() => import('./routes/_auth_root')} HydrateFallback={EmptyComponent}>
        <Route path={ROUTES.LOGIN_RESULT} lazy={() => import('./routes/login-result')} Component={EmptyComponent} />
        <Route path={ROUTES.LOGOUT} lazy={() => import('./routes/logout')} Component={EmptyComponent} />
        <Route path={ROUTES.LOGIN} lazy={() => import('./routes/login')} Component={EmptyComponent} />
      </Route>

      <Route id={ROUTE_LOADER_IDS.ROOT} lazy={() => import('./routes/_root')} HydrateFallback={EmptyComponent}>
        {/**
         * ----------------------------------------------------------------
         * Public routes (auth optional)
         * ----------------------------------------------------------------
         */}

        {/**
         * --- App (spreadsheet)
         * Note: `/file` checks that the browser is supported _before_
         * anything else matches (and we try to load data from the API)
         */}
        <Route path="file" lazy={() => import('./routes/file')}>
          <Route index element={<Navigate to="/" replace />} />
          <Route path=":uuid" lazy={() => import('./routes/file.$uuid')} id={ROUTE_LOADER_IDS.FILE} />
        </Route>

        {/**
         * ----------------------------------------------------------------
         * Protected routes (auth required)
         * Note: each lazy route needs to be protected with `requireUser()`
         * in its respective loader.
         * ----------------------------------------------------------------
         */}

        {/**
         * --- Client-side API routes
         * These are used internally by fetchers. They have no UI.
         * They don’t really need to be protected as you have to know them to
         * hit them, and they'll return 4xx errors if you do.
         */}
        <Route path="api">
          <Route path="files/:uuid" lazy={() => import('./routes/api.files.$uuid')} />
          <Route path="files/:uuid/sharing" lazy={() => import('./routes/api.files.$uuid.sharing')} />
          <Route path="connections" lazy={() => import('./routes/api.connections')} />
          <Route path="teams/:teamUuid" lazy={() => import('./routes/api.teams.$teamUuid')} />
          <Route
            path="teams/:teamUuid/connections/:uuid/schema/:type"
            lazy={() => import('./routes/api.teams.$teamUuid.connections.$uuid.schema.$type')}
          />
        </Route>

        {/**
         * --- User URL routes
         * These are user-accessible via the URL bar, but have no UI.
         * Putting these outside the dashboard route `/` lets you hit them directly
         * without having to run the dashboard loader (which these don't need).
         */}
        <Route path="education/enroll" lazy={() => import('./routes/education.enroll')} />
        <Route path={ROUTES.FILES_CREATE} lazy={() => import('./routes/files.create')} />
        <Route path={ROUTES.FILES_CREATE_AI} lazy={() => import('./routes/files.create.ai')} />
        {/* Team-based AI creation routes */}
        <Route path="teams/:teamUuid/files/create/ai" lazy={() => import('./routes/teams.$teamUuid.files.create.ai')} />
        <Route
          path="teams/:teamUuid/files/create/ai/prompt"
          lazy={() => import('./routes/teams.$teamUuid.files.create.ai')}
        />
        <Route
          path="teams/:teamUuid/files/create/ai/file"
          lazy={() => import('./routes/teams.$teamUuid.files.create.ai')}
        />
        <Route
          path="teams/:teamUuid/files/create/ai/pdf"
          lazy={() => import('./routes/teams.$teamUuid.files.create.ai')}
        />
        <Route
          path="teams/:teamUuid/files/create/ai/connection"
          lazy={() => import('./routes/teams.$teamUuid.files.create.ai')}
        />
        <Route
          path="teams/:teamUuid/files/create/ai/web"
          lazy={() => import('./routes/teams.$teamUuid.files.create.ai')}
        />
        <Route path="teams/:teamUuid/files/create" lazy={() => import('./routes/teams.$teamUuid.files.create')} />
        <Route path="team/*" lazy={() => import('./routes/team.$')} />

        {/**
         * --- UI routes
         * All the routes which render UI of some kind or another.
         */}
        <Route path="file/:uuid/history" lazy={() => import('./routes/file.$uuid.history')} />
        <Route path="file/:uuid/duplicate" lazy={() => import('./routes/file.$uuid.duplicate')} />
        <Route path="teams/:teamUuid/onboarding" lazy={() => import('./routes/teams.$teamUuid.onboarding')} />
        <Route path="/" id={ROUTE_LOADER_IDS.DASHBOARD} lazy={() => import('./routes/_dashboard')}>
          {/* Redirect /examples to /templates - we add this because examples is linked in lots of places we're not aware about */}
          <Route path="/examples" element={<Navigate to={ROUTES.TEMPLATES} replace />} />
          <Route
            path={ROUTES.TEMPLATES}
            lazy={() => import('./routes/templates')}
            shouldRevalidate={dontRevalidateDialogs}
          />
          <Route path={ROUTES.LABS} lazy={() => import('./routes/labs')} />

          <Route path="teams">
            <Route index element={<Navigate to="/" replace />} />
            <Route path=":teamUuid" lazy={() => import('./routes/teams.$teamUuid')}>
              <Route index loader={() => redirect('./files')} />
              <Route path="files" lazy={() => import('./routes/teams.$teamUuid.files')} />
              <Route path="files/deleted" lazy={() => import('./routes/teams.$teamUuid.files.deleted')} />
              <Route path="drive/team" lazy={() => import('./routes/teams.$teamUuid.drive')} />
              <Route path="drive/private" lazy={() => import('./routes/teams.$teamUuid.drive')} />
              <Route
                path="drive/folders/:folderUuid"
                lazy={() => import('./routes/teams.$teamUuid.drive.folders.$folderUuid')}
              />
              <Route path="members" lazy={() => import('./routes/teams.$teamUuid.members')} />
              <Route path="settings" lazy={() => import('./routes/teams.$teamUuid.settings')} />
              <Route path="connections" lazy={() => import('./routes/teams.$teamUuid.connections')} />
              <Route path="billing/manage" lazy={() => import('./routes/teams.$teamUuid.billing.manage')} />
              <Route path="billing/subscribe" lazy={() => import('./routes/teams.$teamUuid.billing.subscribe')} />
            </Route>
          </Route>
        </Route>

        {/* For development purposes only */}
        <Route path="__preview__/*" lazy={() => import('./routes/__preview__')} />

        <Route path="*" lazy={() => import('./routes/404')} />
      </Route>

      <Route
        path={ROUTES.IFRAME_INDEXEDDB}
        lazy={() => import('./routes/iframe-indexeddb')}
        HydrateFallback={EmptyComponent}
      />
    </>
  ),
  {}
);

function dontRevalidateDialogs({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  const currentUrlSearchParams = new URLSearchParams(currentUrl.search);
  const nextUrlSearchParams = new URLSearchParams(nextUrl.search);

  if (nextUrlSearchParams.get(SEARCH_PARAMS.DIALOG.KEY) || currentUrlSearchParams.get(SEARCH_PARAMS.DIALOG.KEY)) {
    return false;
  }
  return true;
}

// Because our `index.html` starts with a loading state, which we remove when
// the app loads, we're fine rendering an empty component in various places.
// This is an explicit way to say what's implicitly happening.
// Otherwise, if we don't include these, we get a bunch of console.warn()
// messages like "No HydrateFallback provided" or
// "Matched leaf route at location ... does not have an element..." which
// blog up sentry.
function EmptyComponent() {
  return null;
}
