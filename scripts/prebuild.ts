// Note: env variables are read in from `.env` which is passed to the script
// that calls this file.

// Import required vars from the app's code
import { requiredVarValuesByName } from '../src/constants/env';
console.log(requiredVarValuesByName);

// Check and see if the values for any of the required vars are missing
let errors: string[] = [];
Object.entries(requiredVarValuesByName).forEach(([key, value]) => {
  if (!value || value.length === 0) {
    errors.push(key);
  }
});

// If so, exit so the build stops
if (errors.length) {
  console.error(
    'Failed to run the app because values for the following environment variables were missing:\n  - ' +
      errors.join('\n  - ')
  );
  process.exit(1);
}
