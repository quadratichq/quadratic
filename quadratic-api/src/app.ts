import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import 'express-async-errors';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import { CORS, NODE_ENV, SENTRY_DSN } from './env-vars';
import anthropic_router from './routes/ai/anthropic';
import openai_router from './routes/ai/openai';
import internal_router from './routes/internal';
import { ApiError } from './utils/ApiError';
export const app = express();

// Configure Sentry
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app }),
      // Automatically instrument Node.js libraries and frameworks
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
    ],

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });

  // RequestHandler creates a separate execution context, so that all
  // transactions/spans/breadcrumbs are isolated across requests
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
  if (req.originalUrl === '/v0/webhooks/stripe') {
    // If the request is a stripe webhook, use raw parser
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    // Use JSON parser for all other routes
    express.json({ limit: '75mb' })(req, res, next);
  }
});

app.use(helmet());

// set CORS origin from env variable
app.use(cors({ origin: CORS }));

// Middleware to redirect HTTP requests to HTTPS
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && NODE_ENV === 'production') {
    return res.redirect(`https://${req.hostname}${req.url}`);
  }
  return next();
});

// Health-check
app.get('/', (req, res) => {
  res.status(200).json({ message: 'OK' });
});

// App routes
// TODO: eventually move all of these into the `v0` directory and register them dynamically
app.use('/ai', anthropic_router);
app.use('/ai', openai_router);
// Internal routes
app.use('/v0/internal', internal_router);

if (SENTRY_DSN) {
  // test route
  app.get('/debug-sentry', function mainHandler(/*req, res*/) {
    throw new Error('My first Sentry error!');
  });

  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());
}

// Register all our dynamic routes, then regsiter the error middleware last of all
registerRoutes().then(() => {
  // Error-logging middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (NODE_ENV !== 'test') {
      if (err.status >= 500) {
        if (NODE_ENV === 'production') console.error(`[${new Date().toISOString()}]`, err);
        else console.log(`[${new Date().toISOString()}]`, err);
      }
    }
    next(err);
  });

  // Error-handling middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // Check if headers have already been sent
    if (res.headersSent) {
      return next(err);
    }

    // Application-specific error handling
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: { message: err.message, ...(err.meta ? { meta: err.meta } : {}) } });
    } else {
      // Generic error handling
      res.status(err.status || 500).json({
        error: {
          message: err.message,
        },
      });
    }
  });
});

/**
 * Dynamically register routes that define their paths & HTTP methods in the filename.
 * e.g. `routes/v0/<segment>.<segment>.<$dynamicSegment>.<HTTP_METHOD>.ts`
 *
 * Each route exports an array of middleware functions with the last function being the handler.
 * e.g. `export default [middleware1, middleware2, handler];`
 */
async function registerRoutes() {
  const currentDirectory = path.join(__dirname, '/routes/v0');

  // Remove any `**.test.ts` files
  const files = fs.readdirSync(currentDirectory).filter((item) => !item.includes('.test.'));

  const registeredRoutes = [];

  for (const file of files) {
    const segments = file.split('.');

    let httpMethodIndex = segments.indexOf('GET');
    if (httpMethodIndex === -1) httpMethodIndex = segments.indexOf('POST');
    if (httpMethodIndex === -1) httpMethodIndex = segments.indexOf('PUT');
    if (httpMethodIndex === -1) httpMethodIndex = segments.indexOf('PATCH');
    if (httpMethodIndex === -1) httpMethodIndex = segments.indexOf('DELETE');

    if (httpMethodIndex === -1) {
      console.error('File route is malformed. It needs an HTTP method: %s', file);
    } else {
      const httpMethod = segments[httpMethodIndex].toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      const routeSegments = segments.slice(0, httpMethodIndex);
      const expressRoute =
        '/v0/' + routeSegments.map((str) => (str.startsWith('$') ? str.replace('$', ':') : str)).join('/');

      try {
        const callbacks = await import(path.join(currentDirectory, file)).then((module) => module.default);
        app[httpMethod](expressRoute, ...callbacks);
        registeredRoutes.push(httpMethod.toUpperCase() + ' ' + expressRoute);
      } catch (err) {
        console.error(`Failed to register route: ${expressRoute}`, err);
      }
    }
  }

  // Keep around for debugging
  // if (NODE_ENV !== 'production' && NODE_ENV !== 'test') {
  //   console.log(`Dynamically registered routes: ${registeredRoutes.map((route) => `\n  ${route}`).join('')}`);
  // }
}
