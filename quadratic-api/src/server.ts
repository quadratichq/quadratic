import './instrument';

import { app } from './app';
import { PORT } from './env-vars';
import logger from './utils/logger';

// Start the server
app.listen(PORT, () => {
  logger.info('Server running', { port: PORT });
});
