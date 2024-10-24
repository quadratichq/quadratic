import { app } from './app';
import { ENCRYPTION_KEY, LICENSE_KEY, PORT } from './env-vars';
import { encryptFromEnv, hash } from './utils/crypto';

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
