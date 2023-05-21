import { isMobile } from 'react-device-detect';

export const IS_READONLY_MODE = isMobile;
export const FILE_PARAM_KEY = 'file-param-before-login';
export const DEFAULT_FILE_NAME = 'Untitled';
export const EXAMPLE_FILES = [
  {
    name: 'Default (example)',
    description: 'Quick overview of basic usage of the app.',
    file: 'default.grid',
  },
  {
    name: 'Python (example)',
    file: 'python.grid',
    description: 'Advanced examples of how to use Python in the app.',
  },
  {
    name: 'NPM downloads (example)',
    file: 'npm_downloads.grid',
    description: 'Example of pulling download stats from the NPM API.',
  },
  {
    name: 'Mercury bank transactions (example)',
    file: 'mercury_bank.grid',
    description: 'Example of pulling data from the Mercury API.',
  },
  // Leaving this one out, as it has nothing useful for users
  // { name: 'Airports large (example)', file: 'airports_large.grid', description: 'Lorem ipsum santa dolor.' },
  {
    name: 'Airports distance (example)',
    file: 'airports_distance.grid',
    description: 'Example of filtering data and calculating values in the app.',
  },
  { name: 'Expenses (example)', file: 'expenses.grid', description: 'Example of spreadsheet-style budgeting.' },
  {
    name: 'Monte Carlo simulation (example)',
    file: 'monte_carlo_simulation.grid',
    description: 'Example of working with large sets of data.',
  },
  {
    name: 'Startup portfolio (example)',
    file: 'startup_portfolio.grid',
    description: 'Example with calculations from formulas and Python.',
  },
];
export const CSV_IMPORT_MESSAGE = 'Drag and drop a CSV file on the grid to import it.';
export const PNG_MESSAGE = 'Copied selection as PNG to clipboard';
