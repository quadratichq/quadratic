import type {
  AIModelKey,
  AISource,
  AIToolArgs,
  AIToolArgsPrimitive,
  ModelMode,
} from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';

// This provides a list of AI Tools in the order that they will be sent to the
// AI model. If you want to change order, change it here instead of the spec
// below.
export enum AITool {
  SetAIModel = 'set_ai_model',
  SetChatName = 'set_chat_name',
  SetFileName = 'set_file_name',
  AddDataTable = 'add_data_table',
  SetCellValues = 'set_cell_values',
  GetCodeCellValue = 'get_code_cell_value',
  SetCodeCellValue = 'set_code_cell_value',
  GetDatabaseSchemas = 'get_database_schemas',
  SetSQLCodeCellValue = 'set_sql_code_cell_value',
  SetFormulaCellValue = 'set_formula_cell_value',
  MoveCells = 'move_cells',
  DeleteCells = 'delete_cells',
  UpdateCodeCell = 'update_code_cell',
  CodeEditorCompletions = 'code_editor_completions',
  UserPromptSuggestions = 'user_prompt_suggestions',
  EmptyChatPromptSuggestions = 'empty_chat_prompt_suggestions',
  CategorizedEmptyChatPromptSuggestions = 'categorized_empty_chat_prompt_suggestions',
  PDFImport = 'pdf_import',
  GetCellData = 'get_cell_data',
  HasCellData = 'has_cell_data',
  SetTextFormats = 'set_text_formats',
  GetTextFormats = 'get_text_formats',
  ConvertToTable = 'convert_to_table',
  WebSearch = 'web_search',
  WebSearchInternal = 'web_search_internal',
  AddSheet = 'add_sheet',
  DuplicateSheet = 'duplicate_sheet',
  RenameSheet = 'rename_sheet',
  DeleteSheet = 'delete_sheet',
  MoveSheet = 'move_sheet',
  ColorSheets = 'color_sheets',
  TextSearch = 'text_search',
  RerunCode = 'rerun_code',
  ResizeColumns = 'resize_columns',
  ResizeRows = 'resize_rows',
  SetDefaultColumnWidth = 'set_default_column_width',
  SetDefaultRowHeight = 'set_default_row_height',
  SetBorders = 'set_borders',
  MergeCells = 'merge_cells',
  UnmergeCells = 'unmerge_cells',
  InsertColumns = 'insert_columns',
  InsertRows = 'insert_rows',
  DeleteColumns = 'delete_columns',
  DeleteRows = 'delete_rows',
  TableMeta = 'table_meta',
  TableColumnSettings = 'table_column_settings',
  GetValidations = 'get_validations',
  AddMessage = 'add_message',
  AddLogicalValidation = 'add_logical_validation',
  AddListValidation = 'add_list_validation',
  AddTextValidation = 'add_text_validation',
  AddNumberValidation = 'add_number_validation',
  AddDateTimeValidation = 'add_date_time_validation',
  RemoveValidations = 'remove_validation',
  GetConditionalFormats = 'get_conditional_formats',
  UpdateConditionalFormats = 'update_conditional_formats',
  Undo = 'undo',
  Redo = 'redo',
  ContactUs = 'contact_us',
  OptimizePrompt = 'optimize_prompt',
  DelegateToSubagent = 'delegate_to_subagent',
}

export const AIToolSchema = z.enum([
  AITool.SetAIModel,
  AITool.SetChatName,
  AITool.SetFileName,
  AITool.AddDataTable,
  AITool.SetCellValues,
  AITool.GetCodeCellValue,
  AITool.SetCodeCellValue,
  AITool.GetDatabaseSchemas,
  AITool.SetSQLCodeCellValue,
  AITool.SetFormulaCellValue,
  AITool.MoveCells,
  AITool.DeleteCells,
  AITool.UpdateCodeCell,
  AITool.CodeEditorCompletions,
  AITool.UserPromptSuggestions,
  AITool.EmptyChatPromptSuggestions,
  AITool.CategorizedEmptyChatPromptSuggestions,
  AITool.PDFImport,
  AITool.GetCellData,
  AITool.HasCellData,
  AITool.SetTextFormats,
  AITool.GetTextFormats,
  AITool.ConvertToTable,
  AITool.WebSearch,
  AITool.WebSearchInternal,
  AITool.AddSheet,
  AITool.DuplicateSheet,
  AITool.RenameSheet,
  AITool.DeleteSheet,
  AITool.MoveSheet,
  AITool.ColorSheets,
  AITool.TextSearch,
  AITool.RerunCode,
  AITool.ResizeColumns,
  AITool.ResizeRows,
  AITool.SetDefaultColumnWidth,
  AITool.SetDefaultRowHeight,
  AITool.SetBorders,
  AITool.MergeCells,
  AITool.UnmergeCells,
  AITool.InsertColumns,
  AITool.InsertRows,
  AITool.DeleteColumns,
  AITool.DeleteRows,
  AITool.TableMeta,
  AITool.TableColumnSettings,
  AITool.GetValidations,
  AITool.AddMessage,
  AITool.AddLogicalValidation,
  AITool.AddListValidation,
  AITool.AddTextValidation,
  AITool.AddNumberValidation,
  AITool.AddDateTimeValidation,
  AITool.RemoveValidations,
  AITool.GetConditionalFormats,
  AITool.UpdateConditionalFormats,
  AITool.Undo,
  AITool.Redo,
  AITool.ContactUs,
  AITool.OptimizePrompt,
  AITool.DelegateToSubagent,
]);

// Helper schemas for preprocessing AI model responses
export const numberSchema = z.preprocess((val) => {
  if (typeof val === 'number') {
    return val;
  }
  return Number(val);
}, z.number());

export const booleanSchema = z.preprocess((val) => {
  if (typeof val === 'boolean') {
    return val;
  }
  return val === 'true';
}, z.boolean());

export const booleanNullableOptionalSchema = z.preprocess((val) => {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val === 'boolean') {
    return val;
  }
  return val === 'true';
}, z.boolean().nullable().optional());

export const stringSchema = z.preprocess((val) => {
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint' || typeof val === 'symbol') {
    return String(val);
  }
  return val;
}, z.string());

export const stringNullableOptionalSchema = z.preprocess((val) => {
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint' || typeof val === 'symbol') {
    return String(val);
  }
  return val;
}, z.string().nullable().optional());

export const array2DSchema = z
  .array(
    z.array(
      z.union([
        z.string(),
        z.number().transform(String),
        z.undefined().transform(() => ''),
        z.null().transform(() => ''),
      ])
    )
  )
  .or(
    z.string().transform((str) => {
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
          return parsed.map((row) => {
            if (!Array.isArray(row)) {
              throw new Error('Invalid 2D array format - each row must be an array');
            }
            return row.map(String);
          });
        }
        throw new Error('Invalid 2D array format');
      } catch {
        throw new Error('Invalid 2D array format');
      }
    })
  )
  .transform((array) => {
    const maxColumns = array.length > 0 ? Math.max(...array.map((row) => row.length)) : 0;
    return array.map((row) => (row.length === maxColumns ? row : row.concat(Array(maxColumns - row.length).fill(''))));
  });

export const enumToFirstLetterCapitalSchema = <T extends string>(enumValues: readonly T[]) =>
  z
    .string()
    .transform((val) => val.charAt(0).toUpperCase() + val.slice(1).toLowerCase())
    .pipe(z.enum(enumValues as readonly string[] as [T, ...T[]]));

export const cellLanguageSchema = enumToFirstLetterCapitalSchema(['Python', 'Javascript']);

// Common schema for validation message and error
export const validationMessageErrorSchema = z.object({
  show_message: booleanSchema.nullable().optional(),
  message_title: z.string().nullable().optional(),
  message_text: z.string().nullable().optional(),
  show_error: booleanSchema.nullable().optional(),
  error_style: enumToFirstLetterCapitalSchema(['Stop', 'Warning', 'Information']).nullable().optional(),
  error_message: z.string().nullable().optional(),
  error_title: z.string().nullable().optional(),
});

// Type definitions
export type AIToolSpec = {
  sources: AISource[];
  aiModelModes: ModelMode[];
  description: string;
  parameters: AIToolArgs;
  responseSchema: z.ZodTypeAny;
};

export type AIToolSpecRecord = {
  [K in AITool]: AIToolSpec;
};

// Shared prompt parameters for validation tools
export const validationMessageErrorPrompt: Record<string, AIToolArgsPrimitive> = {
  show_message: {
    type: ['boolean', 'null'],
    description:
      'Whether the message is shown whenever the cursor is on the cell with this validation. This is usually set to false unless specifically requested, for example, include instructions.',
  },
  message_title: {
    type: ['string', 'null'],
    description:
      'The title of the message to show when the cursor is on the cell with this validation. This defaults to null.',
  },
  message_text: {
    type: ['string', 'null'],
    description:
      'The text of the message to show when the cursor is on the cell with this validation. This defaults to null.',
  },
  show_error: {
    type: ['boolean', 'null'],
    description: 'Whether an error message is shown when the validation fails. This defaults to true.',
  },
  error_style: {
    type: ['string', 'null'],
    description: `Selected from Stop, Warning, and Information. This is the style of the error. Stop will stop the user from saving the cell; Warning will show a warning message but allows the user to enter the value. Information will show an information message if the validation fails. The default is Stop.`,
  },
  error_message: {
    type: ['string', 'null'],
    description: 'The text of the error message to show when the validation fails. This defaults to null.',
  },
  error_title: {
    type: ['string', 'null'],
    description: 'The title of the error message to show when the validation fails.',
  },
} as const;

// Model router configuration
export const MODELS_ROUTER_CONFIGURATION: {
  [key: string]: AIModelKey;
} = {
  claude: 'bedrock-anthropic:us.anthropic.claude-sonnet-4-5-20250929-v1:0:thinking-toggle-on',
  '4.1': 'azure-openai:gpt-4.1',
};
