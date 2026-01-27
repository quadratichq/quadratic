/**
 * Test case definitions for AI tool call testing
 *
 * Each test case defines:
 * - tool: The AITool enum value to test
 * - prompt: A clear prompt that should trigger the tool
 * - expectedArguments: The exact arguments we expect (for exact matching)
 * - requiredArguments: Arguments that must be present (optional, for validation)
 * - exactMatch: Whether to use exact matching (default: true)
 */

import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';

export interface ToolCallTestCase {
  tool: AITool;
  prompt: string;
  expectedArguments: Record<string, unknown>;
  requiredArguments?: string[];
  exactMatch?: boolean; // Default true - set to false for flexible matching
}

/**
 * Test cases for all AIAnalyst tools
 *
 * These prompts are designed to be simple and unambiguous to minimize flakiness.
 * Each prompt explicitly states what the model should do.
 */
export const toolCallTestCases: ToolCallTestCase[] = [
  // ============================================
  // Cell Value Operations
  // ============================================
  {
    tool: AITool.SetCellValues,
    prompt:
      'Put the text "Hello" in cell A1 on the current sheet named "Sheet1". Use the set_cell_values tool with sheet_name "Sheet1", top_left_position "A1", and cell_values [["Hello"]].',
    expectedArguments: {
      sheet_name: 'Sheet1',
      top_left_position: 'A1',
      cell_values: [['Hello']],
    },
    requiredArguments: ['sheet_name', 'top_left_position', 'cell_values'],
  },
  {
    tool: AITool.GetCellData,
    prompt:
      'Get the cell data from A1 to B10 on Sheet1. Use the get_cell_data tool with sheet_name "Sheet1", selection "A1:B10", and page 0.',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'A1:B10',
      page: 0,
    },
    requiredArguments: ['sheet_name', 'selection', 'page'],
  },
  {
    tool: AITool.MoveCells,
    prompt:
      'Move the cells from A1:B2 to D1 on the current sheet named "Sheet1". Use the move_cells tool with sheet_name "Sheet1", source_selection_rect "A1:B2", and target_top_left_position "D1".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      source_selection_rect: 'A1:B2',
      target_top_left_position: 'D1',
    },
    requiredArguments: ['source_selection_rect', 'target_top_left_position'],
  },
  {
    tool: AITool.DeleteCells,
    prompt:
      'Delete the cells in the range A1:C3 on the current sheet named "Sheet1". Use the delete_cells tool with sheet_name "Sheet1" and selection "A1:C3".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'A1:C3',
    },
    requiredArguments: ['selection'],
  },

  // ============================================
  // Data Table Operations
  // ============================================
  {
    tool: AITool.AddDataTable,
    prompt:
      'Add a data table named "SalesData" at position A1 on Sheet1 with columns "Name" and "Amount" and one row of data: "Product1" and "100". Use the add_data_table tool with sheet_name "Sheet1", top_left_position "A1", table_name "SalesData", and table_data [["Name", "Amount"], ["Product1", "100"]].',
    expectedArguments: {
      sheet_name: 'Sheet1',
      top_left_position: 'A1',
      table_name: 'SalesData',
      table_data: [
        ['Name', 'Amount'],
        ['Product1', '100'],
      ],
    },
    requiredArguments: ['sheet_name', 'top_left_position', 'table_name', 'table_data'],
  },
  {
    tool: AITool.ConvertToTable,
    prompt:
      'Convert the range A1:C10 on Sheet1 to a table named "MyTable" where the first row contains column names. Use the convert_to_table tool with sheet_name "Sheet1", selection "A1:C10", table_name "MyTable", and first_row_is_column_names true.',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'A1:C10',
      table_name: 'MyTable',
      first_row_is_column_names: true,
    },
    requiredArguments: ['selection', 'table_name', 'first_row_is_column_names'],
  },
  {
    tool: AITool.TableMeta,
    prompt:
      'Update the table at A1 on Sheet1 to have the name "UpdatedTable" and show alternating row colors. Use the table_meta tool with sheet_name "Sheet1", table_location "A1", new_table_name "UpdatedTable", and alternating_row_colors true.',
    expectedArguments: {
      sheet_name: 'Sheet1',
      table_location: 'A1',
      new_table_name: 'UpdatedTable',
      alternating_row_colors: true,
    },
    requiredArguments: ['table_location'],
  },
  {
    tool: AITool.TableColumnSettings,
    prompt:
      'For the table at A1 on Sheet1, rename the column "OldName" to "NewName" and keep it visible. Use the table_column_settings tool with sheet_name "Sheet1", table_location "A1", and column_names [{"old_name": "OldName", "new_name": "NewName", "show": true}].',
    expectedArguments: {
      sheet_name: 'Sheet1',
      table_location: 'A1',
      column_names: [{ old_name: 'OldName', new_name: 'NewName', show: true }],
    },
    requiredArguments: ['table_location', 'column_names'],
  },

  // ============================================
  // Code Cell Operations
  // ============================================
  {
    tool: AITool.GetCodeCellValue,
    prompt:
      'Get the code from the code cell named "MyCode" at position B2 on Sheet1. Use the get_code_cell_value tool with sheet_name "Sheet1", code_cell_name "MyCode", and code_cell_position "B2".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      code_cell_name: 'MyCode',
      code_cell_position: 'B2',
    },
    requiredArguments: ['code_cell_position'],
  },
  {
    tool: AITool.SetCodeCellValue,
    prompt:
      'Create a Python code cell named "HelloWorld" at position A1 on Sheet1 with the code "print(\'hello\')". Use the set_code_cell_value tool with sheet_name "Sheet1", code_cell_name "HelloWorld", code_cell_language "Python", code_cell_position "A1", and code_string "print(\'hello\')".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      code_cell_name: 'HelloWorld',
      code_cell_language: 'Python',
      code_cell_position: 'A1',
      code_string: "print('hello')",
    },
    requiredArguments: ['code_cell_name', 'code_cell_language', 'code_cell_position', 'code_string'],
  },
  {
    tool: AITool.SetFormulaCellValue,
    prompt:
      'Set a formula at C1 on Sheet1 that sums A1 and B1. Use the set_formula_cell_value tool with formulas array containing one formula: sheet_name "Sheet1", code_cell_position "C1", and formula_string "SUM(A1,B1)" (without the = prefix).',
    expectedArguments: {
      formulas: [
        {
          sheet_name: 'Sheet1',
          code_cell_position: 'C1',
          formula_string: 'SUM(A1,B1)',
        },
      ],
    },
    requiredArguments: ['formulas'],
  },
  {
    tool: AITool.RerunCode,
    prompt:
      'Rerun the code cells in the selection A1:D10 on Sheet1. Use the rerun_code tool with sheet_name "Sheet1" and selection "A1:D10".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'A1:D10',
    },
    requiredArguments: [],
  },

  // ============================================
  // Sheet Operations
  // ============================================
  {
    tool: AITool.AddSheet,
    prompt:
      'Add a new sheet named "DataSheet" before the sheet named "Sheet2". Use the add_sheet tool with sheet_name "DataSheet" and insert_before_sheet_name "Sheet2".',
    expectedArguments: {
      sheet_name: 'DataSheet',
      insert_before_sheet_name: 'Sheet2',
    },
    requiredArguments: ['sheet_name'],
  },
  {
    tool: AITool.RenameSheet,
    prompt:
      'Rename the sheet "OldSheet" to "NewSheet". Use the rename_sheet tool with sheet_name "OldSheet" and new_name "NewSheet".',
    expectedArguments: {
      sheet_name: 'OldSheet',
      new_name: 'NewSheet',
    },
    requiredArguments: ['sheet_name', 'new_name'],
  },
  {
    tool: AITool.DuplicateSheet,
    prompt:
      'Duplicate the sheet named "Original" and name the copy "OriginalCopy". Use the duplicate_sheet tool with sheet_name_to_duplicate "Original" and name_of_new_sheet "OriginalCopy".',
    expectedArguments: {
      sheet_name_to_duplicate: 'Original',
      name_of_new_sheet: 'OriginalCopy',
    },
    requiredArguments: ['sheet_name_to_duplicate', 'name_of_new_sheet'],
  },
  {
    tool: AITool.DeleteSheet,
    prompt: 'Delete the sheet named "OldSheet". Use the delete_sheet tool with sheet_name "OldSheet".',
    expectedArguments: {
      sheet_name: 'OldSheet',
    },
    requiredArguments: ['sheet_name'],
  },
  {
    tool: AITool.MoveSheet,
    prompt:
      'I need you to use the move_sheet tool to reorder my sheets. Move the sheet called "DataSheet" to appear before "Sheet1". Call the move_sheet tool with sheet_name="DataSheet" and insert_before_sheet_name="Sheet1".',
    expectedArguments: {
      sheet_name: 'DataSheet',
      insert_before_sheet_name: 'Sheet1',
    },
    requiredArguments: ['sheet_name'],
  },
  {
    tool: AITool.ColorSheets,
    prompt:
      'I need you to use the color_sheets tool to change my sheet tab color. Set the tab color of "Sheet1" to blue (#0000FF). Call the color_sheets tool with sheet_names_to_color containing sheet_name="Sheet1" and color="#0000FF".',
    expectedArguments: {
      sheet_names_to_color: [{ sheet_name: 'Sheet1', color: '#0000FF' }],
    },
    requiredArguments: ['sheet_names_to_color'],
    exactMatch: false, // Color format may vary (e.g., "#0000FF" vs "blue")
  },

  // ============================================
  // Text Formatting
  // ============================================
  {
    tool: AITool.SetTextFormats,
    prompt:
      'Make the cells A1:A5 on Sheet1 bold and set the text color to red (#FF0000). Use the set_text_formats tool with formats array containing one format: sheet_name "Sheet1", selection "A1:A5", bold true, and text_color "#FF0000".',
    expectedArguments: {
      formats: [
        {
          sheet_name: 'Sheet1',
          selection: 'A1:A5',
          bold: true,
          text_color: '#FF0000',
        },
      ],
    },
    requiredArguments: ['formats'],
  },
  {
    tool: AITool.GetTextFormats,
    prompt:
      'Get the text formats from A1:B10 on Sheet1. Use the get_text_formats tool with sheet_name "Sheet1", selection "A1:B10", and page 0.',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'A1:B10',
      page: 0,
    },
    requiredArguments: ['selection', 'page'],
  },
  {
    tool: AITool.SetBorders,
    prompt:
      'Add a thick black border around all sides of A1:C3 on Sheet1. Use the set_borders tool with sheet_name "Sheet1", selection "A1:C3", color "#000000", line "line2", and border_selection "all".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'A1:C3',
      color: '#000000',
      line: 'line2',
      border_selection: 'all',
    },
    requiredArguments: ['selection', 'color', 'line', 'border_selection'],
  },

  // ============================================
  // Row/Column Operations
  // ============================================
  {
    tool: AITool.ResizeColumns,
    prompt:
      'Auto-size the columns in selection A:C on Sheet1. Use the resize_columns tool with sheet_name "Sheet1", selection "A:C", and size "auto".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'A:C',
      size: 'auto',
    },
    requiredArguments: ['selection', 'size'],
    exactMatch: false, // AI may return "A1:C1" instead of "A:C" - both are valid column references
  },
  {
    tool: AITool.ResizeRows,
    prompt:
      'Set the rows 1:5 on Sheet1 to default size. Use the resize_rows tool with sheet_name "Sheet1", selection "1:5", and size "default".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: '1:5',
      size: 'default',
    },
    requiredArguments: ['selection', 'size'],
    exactMatch: false, // AI may return "A1:A5" instead of "1:5" - both are valid row references
  },
  {
    tool: AITool.InsertColumns,
    prompt:
      'Insert 2 columns to the right of column B on Sheet1. Use the insert_columns tool with sheet_name "Sheet1", column "B", right true, and count 2.',
    expectedArguments: {
      sheet_name: 'Sheet1',
      column: 'B',
      right: true,
      count: 2,
    },
    requiredArguments: ['column', 'right', 'count'],
  },
  {
    tool: AITool.InsertRows,
    prompt:
      'Insert 3 rows below row 5 on Sheet1. Use the insert_rows tool with sheet_name "Sheet1", row 5, below true, and count 3.',
    expectedArguments: {
      sheet_name: 'Sheet1',
      row: 5,
      below: true,
      count: 3,
    },
    requiredArguments: ['row', 'below', 'count'],
  },
  {
    tool: AITool.DeleteColumns,
    prompt:
      'Delete columns A and C on Sheet1. Use the delete_columns tool with sheet_name "Sheet1" and columns ["A", "C"].',
    expectedArguments: {
      sheet_name: 'Sheet1',
      columns: ['A', 'C'],
    },
    requiredArguments: ['columns'],
  },
  {
    tool: AITool.DeleteRows,
    prompt: 'Delete rows 1, 3, and 5 on Sheet1. Use the delete_rows tool with sheet_name "Sheet1" and rows [1, 3, 5].',
    expectedArguments: {
      sheet_name: 'Sheet1',
      rows: [1, 3, 5],
    },
    requiredArguments: ['rows'],
  },

  // ============================================
  // Search
  // ============================================
  {
    tool: AITool.TextSearch,
    prompt:
      'Search for the text "revenue" on Sheet1, case insensitive, matching whole cell, including code. Use the text_search tool with query "revenue", case_sensitive false, whole_cell true, search_code true, and sheet_name "Sheet1".',
    expectedArguments: {
      query: 'revenue',
      case_sensitive: false,
      whole_cell: true,
      search_code: true,
      sheet_name: 'Sheet1',
    },
    requiredArguments: ['query', 'case_sensitive', 'whole_cell', 'search_code'],
  },

  // ============================================
  // Validations
  // ============================================
  {
    tool: AITool.GetValidations,
    prompt: 'Get all validations on Sheet1. Use the get_validations tool with sheet_name "Sheet1".',
    expectedArguments: {
      sheet_name: 'Sheet1',
    },
    requiredArguments: [],
  },
  {
    tool: AITool.AddLogicalValidation,
    prompt:
      'Add a checkbox validation to cells A1:A10 on Sheet1. Use the add_logical_validation tool with sheet_name "Sheet1", selection "A1:A10", and show_checkbox true.',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'A1:A10',
      show_checkbox: true,
    },
    requiredArguments: ['selection'],
  },
  {
    tool: AITool.AddListValidation,
    prompt:
      'Add a dropdown list validation to B1:B10 on Sheet1 with options "Yes", "No", "Maybe". Use the add_list_validation tool with sheet_name "Sheet1", selection "B1:B10", drop_down true, and list_source_list "Yes,No,Maybe".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'B1:B10',
      drop_down: true,
      list_source_list: 'Yes,No,Maybe',
    },
    requiredArguments: ['selection'],
  },
  {
    tool: AITool.AddTextValidation,
    prompt:
      'Add a text validation to C1:C10 on Sheet1 requiring minimum 5 characters. Use the add_text_validation tool with sheet_name "Sheet1", selection "C1:C10", and min_length 5.',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'C1:C10',
      min_length: 5,
    },
    requiredArguments: ['selection'],
  },
  {
    tool: AITool.AddNumberValidation,
    prompt:
      'Add a number validation to D1:D10 on Sheet1 requiring values between 1 and 100. Use the add_number_validation tool with sheet_name "Sheet1", selection "D1:D10", and range "[1,100]".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'D1:D10',
      range: '[1,100]',
    },
    requiredArguments: ['selection'],
    exactMatch: false, // AI may return "1..100" or other valid range notations
  },
  {
    tool: AITool.AddDateTimeValidation,
    prompt:
      'Add a date validation to E1:E10 on Sheet1 requiring dates only. Use the add_date_time_validation tool with sheet_name "Sheet1", selection "E1:E10", and require_date true.',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'E1:E10',
      require_date: true,
    },
    requiredArguments: ['selection'],
  },
  {
    tool: AITool.AddMessage,
    prompt:
      'Add a message to cell A1 on Sheet1 with title "Note" and text "Important information". Use the add_message tool with sheet_name "Sheet1", selection "A1", message_title "Note", and message_text "Important information".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'A1',
      message_title: 'Note',
      message_text: 'Important information',
    },
    requiredArguments: ['selection'],
  },
  {
    tool: AITool.RemoveValidations,
    prompt:
      'Remove all validations from A1:Z100 on Sheet1. Use the remove_validation tool with sheet_name "Sheet1" and selection "A1:Z100".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      selection: 'A1:Z100',
    },
    requiredArguments: ['selection'],
  },

  // ============================================
  // Undo/Redo
  // ============================================
  {
    tool: AITool.Undo,
    prompt: 'Undo the last 2 actions. Use the undo tool with count 2.',
    expectedArguments: {
      count: 2,
    },
    requiredArguments: [],
  },
  {
    tool: AITool.Redo,
    prompt: 'Redo the last 3 actions. Use the redo tool with count 3.',
    expectedArguments: {
      count: 3,
    },
    requiredArguments: [],
  },

  // ============================================
  // Contact Us
  // ============================================
  {
    tool: AITool.ContactUs,
    prompt: 'I want to contact the Quadratic team for help. Use the contact_us tool with acknowledged true.',
    expectedArguments: {
      acknowledged: true,
    },
    requiredArguments: [],
  },

  // ============================================
  // Database/SQL Operations
  // ============================================
  {
    tool: AITool.GetDatabaseSchemas,
    prompt:
      'Get the database schemas for all connections. Use the get_database_schemas tool with connection_ids as an empty array [].',
    expectedArguments: {
      connection_ids: [],
    },
    requiredArguments: ['connection_ids'],
  },
  {
    tool: AITool.SetSQLCodeCellValue,
    prompt:
      'I already know the database schema - there is a "users" table with columns id, name, and email. Do NOT call get_database_schemas. Directly create a SQL code cell named "QueryUsers" at position A1 on Sheet1 that runs "SELECT * FROM users" using a PostgreSQL connection with id "00000000-0000-0000-0000-000000000001". Use the set_sql_code_cell_value tool immediately with sheet_name "Sheet1", code_cell_name "QueryUsers", connection_kind "POSTGRES", code_cell_position "A1", sql_code_string "SELECT * FROM users", and connection_id "00000000-0000-0000-0000-000000000001".',
    expectedArguments: {
      sheet_name: 'Sheet1',
      code_cell_name: 'QueryUsers',
      connection_kind: 'POSTGRES',
      code_cell_position: 'A1',
      sql_code_string: 'SELECT * FROM users',
      connection_id: '00000000-0000-0000-0000-000000000001',
    },
    requiredArguments: ['code_cell_name', 'connection_kind', 'code_cell_position', 'sql_code_string', 'connection_id'],
  },

  // ============================================
  // PDF Import
  // ============================================
  {
    tool: AITool.PDFImport,
    prompt:
      'Import the PDF file named "report.pdf" and extract all the tables from it. Use the pdf_import tool with file_name "report.pdf" and prompt "Extract all tables from this PDF".',
    expectedArguments: {
      file_name: 'report.pdf',
      prompt: 'Extract all tables from this PDF',
    },
    requiredArguments: ['file_name', 'prompt'],
  },

  // ============================================
  // Web Search
  // ============================================
  {
    tool: AITool.WebSearch,
    prompt:
      'Search the web for "current GDP of United States 2024". Use the web_search tool with query "current GDP of United States 2024".',
    expectedArguments: {
      query: 'current GDP of United States 2024',
    },
    requiredArguments: ['query'],
  },
];

/**
 * Get test case for a specific tool
 */
export function getTestCaseForTool(tool: AITool): ToolCallTestCase | undefined {
  return toolCallTestCases.find((tc) => tc.tool === tool);
}

/**
 * Get all test cases
 */
export function getAllTestCases(): ToolCallTestCase[] {
  return toolCallTestCases;
}
