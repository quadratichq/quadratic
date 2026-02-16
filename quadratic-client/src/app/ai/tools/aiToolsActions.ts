import { cellDataToolsActions } from '@/app/ai/tools/aiCellDataActions';
import { codeToolsActions } from '@/app/ai/tools/aiCodeActions';
import { conditionalFormatToolsActions } from '@/app/ai/tools/aiConditionalFormatActions';
import { connectionToolsActions } from '@/app/ai/tools/aiConnectionActions';
import { formatToolsActions } from '@/app/ai/tools/aiFormatActions';
import { miscToolsActions } from '@/app/ai/tools/aiMiscActions';
import { rowColumnToolsActions } from '@/app/ai/tools/aiRowColumnActions';
import { sheetToolsActions } from '@/app/ai/tools/aiSheetActions';
import { tableToolsActions } from '@/app/ai/tools/aiTableActions';
import type { AIToolActionsRecord } from '@/app/ai/tools/aiToolsHelpers';
import { validationToolsActions } from '@/app/ai/tools/aiValidationActions';

// Re-export types and helpers
export { setCodeCellResult, waitForSetCodeCellValue } from '@/app/ai/tools/aiToolsHelpers';
export type { AIToolActionsRecord, AIToolMessageMetaData } from '@/app/ai/tools/aiToolsHelpers';

// Merge all action handlers
export const aiToolsActions: AIToolActionsRecord = {
  ...miscToolsActions,
  ...cellDataToolsActions,
  ...codeToolsActions,
  ...connectionToolsActions,
  ...formatToolsActions,
  ...sheetToolsActions,
  ...tableToolsActions,
  ...rowColumnToolsActions,
  ...validationToolsActions,
  ...conditionalFormatToolsActions,
} as const;
