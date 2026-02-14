import './instrument';

import { app, routesReady } from './app';
import { PORT } from './env-vars';
import logger from './utils/logger';

// Start the server only after all routes are registered (avoids 404s on early requests)
routesReady.then(() => {
  app.listen(PORT, () => {
    logger.info('Server running', { port: PORT });
  });
});
