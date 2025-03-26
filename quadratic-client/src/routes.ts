// import { flatRoutes } from '@react-router/fs-routes';
// import { protectedRouteLoaderWrapper } from '@/auth/auth';
// import { routes } from '@/routesFromElements';
import { index, layout, prefix, route } from '@react-router/dev/routes';
import type { RouteConfig } from '@sentry/react/build/types/reactrouter';
import { ROUTES } from './shared/constants/routes';

const routes = [
  // route('/foo', './routez/foo.tsx'),

  // rename to _app.tsx?
  route('/', './routes/_root.tsx', [
    // Check that the browser is supported _before_ we try to load anything from the API
    layout('./routes/_browser-compatibility.tsx', [route('file/:uuid', './routes/file.$uuid.tsx')]),
    layout('./routes/_protected.tsx', [
      // Dashboard UI
      route('/', './routes/_dashboard.tsx', [
        route(ROUTES.FILES_SHARED_WITH_ME, './routes/files.shared-with-me.tsx'),
        route(ROUTES.EXAMPLES, './routes/examples.tsx'),
        ...prefix('teams', [
          route(':teamUuid', './routes/teams.$teamUuid.tsx', [
            index('./routes/teams.$teamUuid.index.tsx'),
            route('files/private', './routes/teams.$teamUuid.files.private.tsx'),
          ]),
        ]),
      ]),
    ]),
    route('*', './routes/404.tsx'), // TODO not working?
  ]),

  route(ROUTES.LOGIN, './routes/login.tsx'),
  route(ROUTES.LOGIN_RESULT, './routes/login-result.tsx'),
  route(ROUTES.LOGOUT, './routes/logout.tsx'),

  // ...(await flatRoutes({
  //   rootDirectory: 'routez',
  // })),
] satisfies RouteConfig;

export default routes;
