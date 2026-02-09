export const SUPPORT_EMAIL = 'support@quadratichq.com';

export const DEFAULT_FILE_NAME = 'Untitled';
export const CSV_IMPORT_MESSAGE = 'Drag and drop a CSV file on the grid to import it.';
export const EXCEL_IMPORT_MESSAGE = 'Drag and drop an Excel file on the grid to import it.';
export const PARQUET_IMPORT_MESSAGE = 'Drag and drop a Parquet file on the grid to import it.';
export const IMPORT_MESSAGE = 'Drag and drop a file (CSV, Excel, or Parquet) on the grid to import it.';
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
export const VERSION = import.meta.env.VITE_VERSION;

// Font version constant - shared between font generation script and runtime code
// Update this when fonts are regenerated to bust cache
export const FONT_VERSION = '1.0.1';

// AI gradient colors used for AI-related UI elements
export const AI_GRADIENT = 'from-indigo-500 via-purple-600 to-fuchsia-600';
