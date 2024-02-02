export const SUPPORT_EMAIL = 'support@quadratichq.com';
export const DEFAULT_FILE_NAME = 'Untitled';
export const EXAMPLE_FILES = {
  'default.grid': {
    name: 'Default (example)',
    description: 'Quick overview of basic usage of the app.',
  },
  'python.grid': {
    name: 'Python (example)',
    description: 'Advanced examples of how to use Python in the app.',
  },
  'npm_downloads.grid': {
    name: 'NPM downloads (example)',
    description: 'Example of pulling download stats from the NPM API.',
  },
  'mercury_bank.grid': {
    name: 'Mercury bank transactions (example)',
    description: 'Example of pulling data from the Mercury API.',
  },
  'open_ai.grid': {
    name: 'OpenAI (example)',

    description: 'Example prompt querying the OpenAI API.',
  },
  // Leaving this one out, as it has nothing useful for users
  // 'airports_large.grid': { name: 'Airports large (example)', description: 'Lorem ipsum santa dolor.' },
  'airports_distance.grid': {
    name: 'Airports distance (example)',
    description: 'Example of filtering data and calculating values in the app.',
  },
  'expenses.grid': {
    name: 'Expenses (example)',
    description: 'Example of spreadsheet-style budgeting.',
  },
  'monte_carlo_simulation.grid': {
    name: 'Monte Carlo simulation (example)',
    description: 'Example of working with large sets of data.',
  },
  'startup_portfolio.grid': {
    name: 'Startup portfolio (example)',
    description: 'Example with calculations from formulas and Python.',
  },
  'charting_example.grid': {
    name: 'Charting (example)',
    description: 'Example of charting data using Python and Plotly.',
  },
};
export type ExampleFileNames = keyof typeof EXAMPLE_FILES;
export const CSV_IMPORT_MESSAGE = 'Drag and drop a CSV file on the grid to import it.';
export const TYPE = {
  // Borrowed from mui typography
  body1: 'text-md',
  body2: 'text-sm',
  caption: 'text-xs text-muted-foreground',
  overline: 'text-xs uppercase tracking-widest text-muted-foreground',
  h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
  h4: 'scroll-m-20 text-xl font-semibold tracking-tight',
  code: 'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',

  // Taken from shadcn/ui form styles
  formError: 'text-[0.8rem] font-medium text-destructive',
};
