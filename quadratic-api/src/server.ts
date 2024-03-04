import { app } from './app';
import { PORT } from './env-vars';

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
