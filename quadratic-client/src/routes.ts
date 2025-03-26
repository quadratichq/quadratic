import { index, layout, prefix, route, type RouteConfig } from '@react-router/dev/routes';
import { ROUTES } from './shared/constants/routes';

const routes = [
  // rename to _app.tsx?
  route('/', './routes/_root.tsx', [
    /**
     * App
     * This loads the spreadsheet side of Quadratic, which doesn’t necessariliy
     * require authentication (shared files).
     * Note: we check that the browser is supported _before_ we try to load anything from the API
     */
    layout('./routes/_browser-compatibility.tsx', [route('file/:uuid', './routes/file.$uuid.tsx')]),

    /**
     * Protected routes
     * While they don’t all have UI, they all require authentication.
     */
    layout('./routes/_protected.tsx', [
      /**
       * Resource routes
       * These are accessible via the URL, but have no UI.
       * Putting these outside the nested tree lets you hit them directly without
       * having to run loaders for other routes.
       */

      // Shortcut to navigate user to anywhere (*) in their 'active' team
      route('team/*', './routes/team.$.ts'),

      // Create a new file in a specific team
      route('teams/:teamUuid/files/create', './routes/teams.$teamUuid.files.create.ts'),

      // Create a new file in whatever the 'active' team is and redirect to it
      // (used from outside the app, e.g. `https://quadratic.ai/files/create`)
      route('files/create', './routes/files.create.ts'),

      // Redirect to the dashboard with the education dialog
      route('education/enroll', './routes/education.enroll.ts'),

      // API routes: these are used by fetchers but have no UI
      ...prefix('api', [
        route('files/:uuid', './routes/api.files.$uuid.ts'),
        route('files/:uuid/sharing', './routes/api.files.$uuid.sharing.ts'),
        route('connections', './routes/api.connections.ts'),
        route('connections/:uuid/schema/:type', './routes/api.connections.$uuid.schema.$type.ts'),
      ]),

      /**
       * User-facing routes
       * These are routes that display UI.
       */

      // Dashboard UI
      route('/', './routes/_dashboard.tsx', [
        route(ROUTES.FILES_SHARED_WITH_ME, './routes/files.shared-with-me.tsx'),
        route(ROUTES.EXAMPLES, './routes/examples.tsx'),
        route(ROUTES.LABS, './routes/labs.tsx'),
        route(ROUTES.ACCOUNT, './routes/account.tsx'),

        ...prefix('teams', [
          route('create', './routes/teams.create.tsx'),
          route(':teamUuid', './routes/teams.$teamUuid.tsx', [
            index('./routes/teams.$teamUuid.index.tsx'),
            route('files/private', './routes/teams.$teamUuid.files.private.tsx'),
            route('members', './routes/teams.$teamUuid.members.tsx'),
            route('settings', './routes/teams.$teamUuid.settings.tsx'),
            route('connections', './routes/teams.$teamUuid.connections.tsx'),
          ]),
        ]),
      ]),
    ]),

    // Catch-all for 404s
    route('*', './routes/404.tsx'),
  ]),

  route(ROUTES.LOGIN, './routes/login.tsx'),
  route(ROUTES.LOGIN_RESULT, './routes/login-result.tsx'),
  route(ROUTES.LOGOUT, './routes/logout.tsx'),
] satisfies RouteConfig;

export default routes;
