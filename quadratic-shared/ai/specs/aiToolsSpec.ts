// Re-export core types and enums
export {
  AITool,
  AIToolSchema,
  array2DSchema,
  booleanNullableOptionalSchema,
  booleanSchema,
  cellLanguageSchema,
  enumToFirstLetterCapitalSchema,
  MODELS_ROUTER_CONFIGURATION,
  numberSchema,
  stringNullableOptionalSchema,
  stringSchema,
  validationMessageErrorPrompt,
  validationMessageErrorSchema,
} from './aiToolsCore';
export type { AIToolSpec, AIToolSpecRecord } from './aiToolsCore';

// Import domain schemas
import {
  cellDataToolsArgsSchemas,
  cellDataToolsSpecs,
  codeToolsArgsSchemas,
  codeToolsSpecs,
  conditionalFormatToolsArgsSchemas,
  conditionalFormatToolsSpecs,
  connectionToolsArgsSchemas,
  connectionToolsSpecs,
  formatToolsArgsSchemas,
  formatToolsSpecs,
  miscToolsArgsSchemas,
  miscToolsSpecs,
  rowColumnToolsArgsSchemas,
  rowColumnToolsSpecs,
  sheetToolsArgsSchemas,
  sheetToolsSpecs,
  tableToolsArgsSchemas,
  tableToolsSpecs,
  validationToolsArgsSchemas,
  validationToolsSpecs,
} from './schemas';

import type { z } from 'zod';
import type { AIToolSpecRecord } from './aiToolsCore';

// Merge all arg schemas
export const AIToolsArgsSchema = {
  ...miscToolsArgsSchemas,
  ...cellDataToolsArgsSchemas,
  ...codeToolsArgsSchemas,
  ...connectionToolsArgsSchemas,
  ...formatToolsArgsSchemas,
  ...sheetToolsArgsSchemas,
  ...tableToolsArgsSchemas,
  ...rowColumnToolsArgsSchemas,
  ...validationToolsArgsSchemas,
  ...conditionalFormatToolsArgsSchemas,
} as const;

// Type for tool arguments
export type AIToolsArgs = {
  [K in keyof typeof AIToolsArgsSchema]: z.infer<(typeof AIToolsArgsSchema)[K]>;
};

// Merge all specs
export const aiToolsSpec: AIToolSpecRecord = {
  ...miscToolsSpecs,
  ...cellDataToolsSpecs,
  ...codeToolsSpecs,
  ...connectionToolsSpecs,
  ...formatToolsSpecs,
  ...sheetToolsSpecs,
  ...tableToolsSpecs,
  ...rowColumnToolsSpecs,
  ...validationToolsSpecs,
  ...conditionalFormatToolsSpecs,
} as const;
