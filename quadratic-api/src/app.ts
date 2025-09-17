import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import 'express-async-errors';
import expressWinston from 'express-winston';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import winston from 'winston';
import authRouter from './auth/router/authRouter';
import { AUTH_CORS, CORS, LOG_REQUEST_INFO, NODE_ENV, SENTRY_DSN, VERSION } from './env-vars';
import mcpRouter from './mcp';
import internal_router from './routes/internal';
import { ApiError } from './utils/ApiError';
import logger, { format } from './utils/logger';

export const app = express();

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

// cookie parser for auth routes
app.use(cookieParser());

// workos auth
app.use('/', cors({ origin: AUTH_CORS, credentials: true }), authRouter);

app.use('/mcp', mcpRouter);

// set CORS origin from env variable
app.use(cors({ origin: CORS }));

// Request logging middleware for Datadog
if (LOG_REQUEST_INFO === 'true') {
  app.use(
    expressWinston.logger({
      transports: [new winston.transports.Console()],
      format,
      headerBlacklist: ['authorization'],
      meta: true,
    })
  );
}

// Health-check
app.get('/', (req, res) => {
  res.status(200).json({ message: 'OK' });
});
app.get('/health', (req, res) => {
  res.status(200).json({ version: VERSION });
});

// App routes
// Internal routes
app.use('/v0/internal', internal_router);

// Register all our dynamic routes, then register the error middleware last of all
registerRoutes().then(() => {
  // Error-logging middleware
  app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    if (NODE_ENV !== 'test') {
      if (error.status >= 500) {
        if (NODE_ENV === 'production') {
          logger.error('Server error (production)', error);
        } else {
          logger.error('Server error (development)', error);
        }
      }
    }
    next(error);
  });

  // Error-handling middleware
  app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    // Check if headers have already been sent
    if (res.headersSent) {
      return next(error);
    }

    // Application-specific error handling
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { message: error.message, ...(error.meta ? { meta: error.meta } : {}) } });
    } else {
      logger.error('Unhandled application error', error);

      // Generic error handling
      res.status(error.status || 500).json({
        error: {
          message: error.message,
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
      logger.error('File route is malformed. It needs an HTTP method', { file });
    } else {
      const httpMethod = segments[httpMethodIndex].toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      const routeSegments = segments.slice(0, httpMethodIndex);
      const expressRoute =
        '/v0/' + routeSegments.map((str) => (str.startsWith('$') ? str.replace('$', ':') : str)).join('/');

      try {
        const callbacks = await import(path.join(currentDirectory, file)).then((module) => module.default);
        app[httpMethod](expressRoute, ...callbacks);
        registeredRoutes.push(httpMethod.toUpperCase() + ' ' + expressRoute);
      } catch (error) {
        logger.error(`Failed to register route ${expressRoute}`, error);
      }
    }
  }

  // Keep around for debugging
  // if (NODE_ENV !== 'production' && NODE_ENV !== 'test') {
  //   console.log(
  //     JSON.stringify({
  //       message: 'Dynamically registered routes',
  //       routes: registeredRoutes.map((route) => `\n  ${route}`).join(''),
  //     })
  //   );
  // }
}

// Setup Sentry as the last route in the stack
if (SENTRY_DSN) {
  // test route
  app.get('/debug-sentry', function mainHandler(/*req, res*/) {
    throw new Error('My first Sentry error!');
  });

  // The error handler must be before any other error middleware and after all controllers
  Sentry.setupExpressErrorHandler(app);
}
