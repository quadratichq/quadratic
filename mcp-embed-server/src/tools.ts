import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EMBED_URL, PORT } from "./config.js";
import { SpreadsheetBridge } from "./bridge.js";

const STR = z.string();
const STR_OPT = z.string().nullable().optional();
const NUM = z.number();
const NUM_OPT = z.number().nullable().optional();
const BOOL = z.boolean();
const BOOL_OPT = z.boolean().nullable().optional();

export function createMcpServer(bridge: SpreadsheetBridge): McpServer {
  const mcp = new McpServer({
    name: "quadratic-embed",
    version: "0.1.0",
  });

  mcp.resource("spreadsheet", "spreadsheet://embed", async () => ({
    contents: [
      {
        uri: "spreadsheet://embed",
        mimeType: "text/plain",
        text: [
          `Open the spreadsheet in your browser: http://localhost:${PORT}`,
          `Embed URL: ${EMBED_URL}`,
        ].join("\n"),
      },
    ],
  }));

  // Helper: register a tool that relays straight through the bridge
  function relay(
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler?: (args: Record<string, unknown>) => Record<string, unknown>
  ) {
    mcp.tool(name, description, schema, async (args) => {
      const params = handler ? handler(args) : args;
      const result = await bridge.send(name, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Cell Data
  // ---------------------------------------------------------------------------

  relay(
    "set_cell_values",
    "Set values for a rectangular block of cells. Provide the top-left cell " +
      "and a 2-D array of values (rows × columns). Each value is a string " +
      '(text, number, or formula prefixed with "=").',
    {
      sheet_name: STR_OPT.describe("Sheet name (defaults to the first sheet)"),
      top_left_position: STR.describe('Top-left cell in A1 notation, e.g. "A1"'),
      cell_values: z
        .array(z.array(STR))
        .describe('Rows of values, e.g. [["Name","Age"],["Alice","30"]]'),
    }
  );

  relay(
    "get_cell_data",
    "Get the values of cells in a selection. Returns cell data as markdown.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      selection: STR.describe(
        'Selection in A1 notation, e.g. "A1:D10", "Sheet2!A1:B5"'
      ),
      page: NUM.describe("Page number (0-based) for paginated results"),
    }
  );

  relay(
    "has_cell_data",
    "Check if any cells in the chosen selection have data. Returns true if any cell contains data.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      selection: STR.describe(
        'Selection in A1 notation, e.g. "A1:B10"'
      ),
    }
  );

  relay(
    "add_data_table",
    "Add a data table to a sheet. The first row of data is treated as the header row.",
    {
      sheet_name: STR.describe("Sheet name"),
      top_left_position: STR.describe("Top-left cell in A1 notation"),
      table_name: STR.describe(
        "Name for the data table (no spaces or special chars, _ allowed)"
      ),
      table_data: z
        .array(z.array(STR))
        .describe("2-D array of string values (first row is header)"),
    }
  );

  relay(
    "move_cells",
    "Move a rectangular selection of cells to a new location.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      source_selection_rect: STR.describe(
        'Source selection in A1 notation, e.g. "A1:C5"'
      ),
      target_top_left_position: STR.describe(
        'Target top-left cell in A1 notation, e.g. "E1"'
      ),
    }
  );

  relay(
    "delete_cells",
    "Delete the values of a selection of cells.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      selection: STR.describe('Selection in A1 notation, e.g. "A1:B5" or "A1"'),
    }
  );

  // ---------------------------------------------------------------------------
  // Code
  // ---------------------------------------------------------------------------

  relay(
    "set_code_cell_value",
    "Set a code cell that will be evaluated by Quadratic. " +
      "Supported languages: Python, Javascript.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      code_cell_name: STR.describe(
        "Name for the output of the code cell (no spaces or special chars, _ allowed)"
      ),
      code_cell_language: z
        .enum(["Python", "Javascript"])
        .describe("The language of the code cell"),
      code_cell_position: STR.describe('Cell position in A1 notation, e.g. "A1"'),
      code_string: STR.describe("The code to run in the cell"),
    }
  );

  relay(
    "get_code_cell_value",
    "Get the full code for an existing Python, JavaScript, Formula, or connection cell.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      code_cell_name: STR_OPT.describe("The name of the code cell"),
      code_cell_position: STR_OPT.describe(
        "The position of the code cell in A1 notation"
      ),
    }
  );

  relay(
    "set_formula_cell_value",
    "Set one or more formula cells. Each formula has a sheet, position, and formula string. " +
      "Do NOT prefix formulas with =.",
    {
      formulas: z
        .array(
          z.object({
            sheet_name: STR_OPT.describe("Sheet name"),
            code_cell_position: STR.describe(
              'Cell position or range in A1 notation, e.g. "A1" or "A1:A10"'
            ),
            formula_string: STR.describe(
              "The formula to run (without = prefix)"
            ),
          })
        )
        .min(1)
        .describe("Array of formulas to set"),
    }
  );

  relay(
    "rerun_code",
    "Re-run code cells. Optionally scope to a sheet or selection.",
    {
      sheet_name: STR_OPT.describe(
        "Sheet name to scope to (null = all sheets)"
      ),
      selection: STR_OPT.describe(
        "Selection in A1 notation to scope to (null = all code in sheet)"
      ),
    }
  );

  // ---------------------------------------------------------------------------
  // Connections
  // ---------------------------------------------------------------------------

  relay(
    "get_database_schemas",
    "Get the schemas for one or more database connections.",
    {
      connection_ids: z
        .array(STR)
        .describe("Array of connection UUIDs to get schemas for"),
    }
  );

  relay(
    "set_sql_code_cell_value",
    "Set a SQL code cell that queries a database connection.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      code_cell_name: STR.describe("Name for the output of the code cell"),
      connection_kind: STR.describe(
        "Connection type, e.g. POSTGRES, MYSQL, MSSQL, SNOWFLAKE"
      ),
      code_cell_position: STR.describe("Cell position in A1 notation"),
      sql_code_string: STR.describe("The SQL query to run"),
      connection_id: STR.describe("UUID of the connection to use"),
    }
  );

  // ---------------------------------------------------------------------------
  // Format
  // ---------------------------------------------------------------------------

  relay(
    "set_text_formats",
    "Set text formatting (bold, italic, colors, alignment, number format, etc.) on one or more selections.",
    {
      formats: z
        .array(
          z.object({
            sheet_name: STR_OPT.describe("Sheet name"),
            selection: STR.describe("Selection in A1 notation"),
            bold: BOOL_OPT.describe("Bold"),
            italic: BOOL_OPT.describe("Italic"),
            underline: BOOL_OPT.describe("Underline"),
            strike_through: BOOL_OPT.describe("Strike-through"),
            text_color: STR_OPT.describe("Text color in hex, e.g. #FF0000"),
            fill_color: STR_OPT.describe("Background color in hex"),
            align: STR_OPT.describe('"left", "center", or "right"'),
            vertical_align: STR_OPT.describe('"top", "middle", or "bottom"'),
            wrap: STR_OPT.describe('"wrap", "clip", or "overflow"'),
            numeric_commas: BOOL_OPT.describe("Show commas in numbers"),
            number_type: STR_OPT.describe(
              '"number", "currency", "percentage", or "exponential"'
            ),
            currency_symbol: STR_OPT.describe('e.g. "$", "€"'),
            date_time: STR_OPT.describe(
              'Chrono format string, e.g. "%Y-%m-%d"'
            ),
            font_size: NUM_OPT.describe("Font size in points (default 10)"),
          })
        )
        .min(1),
    }
  );

  relay(
    "get_text_formats",
    "Get the text formatting of a selection of cells.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      selection: STR.describe("Selection in A1 notation"),
      page: NUM.describe("Page number (0-based)"),
    }
  );

  relay(
    "set_borders",
    "Set borders on a selection of cells.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      selection: STR.describe("Selection in A1 notation, e.g. A1:D1"),
      color: STR.describe("Border color as CSS color string"),
      line: STR.describe(
        "Line type: line1, line2, line3, dotted, dashed, double, clear"
      ),
      border_selection: STR.describe(
        "Border placement: all, inner, outer, horizontal, vertical, left, top, right, bottom, clear"
      ),
    }
  );

  relay("merge_cells", "Merge a selection of cells into one.", {
    sheet_name: STR_OPT.describe("Sheet name"),
    selection: STR.describe("Range in A1 notation, e.g. A1:D1"),
  });

  relay("unmerge_cells", "Unmerge previously merged cells.", {
    sheet_name: STR_OPT.describe("Sheet name"),
    selection: STR.describe("Selection containing merged cells"),
  });

  // ---------------------------------------------------------------------------
  // Sheets
  // ---------------------------------------------------------------------------

  relay("add_sheet", "Add a new sheet.", {
    sheet_name: STR.describe("Name for the new sheet"),
    insert_before_sheet_name: STR_OPT.describe(
      "Insert before this sheet (null = append to end)"
    ),
  });

  relay("duplicate_sheet", "Duplicate an existing sheet.", {
    sheet_name_to_duplicate: STR.describe("Sheet to duplicate"),
    name_of_new_sheet: STR.describe("Name for the copy"),
  });

  relay("rename_sheet", "Rename an existing sheet.", {
    sheet_name: STR.describe("Current sheet name"),
    new_name: STR.describe("New sheet name"),
  });

  relay("delete_sheet", "Delete a sheet.", {
    sheet_name: STR.describe("Sheet to delete"),
  });

  relay("move_sheet", "Reorder a sheet in the sheet list.", {
    sheet_name: STR.describe("Sheet to move"),
    insert_before_sheet_name: STR_OPT.describe(
      "Insert before this sheet (null = move to end)"
    ),
  });

  relay("color_sheets", "Set tab colors for one or more sheets.", {
    sheet_names_to_color: z
      .array(
        z.object({
          sheet_name: STR.describe("Sheet name"),
          color: STR.describe("CSS color string"),
        })
      )
      .describe("Array of sheet name + color pairs"),
  });

  // ---------------------------------------------------------------------------
  // Tables
  // ---------------------------------------------------------------------------

  relay(
    "convert_to_table",
    "Convert a selection of cells into a data table.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      selection: STR.describe("Selection in A1 notation, e.g. A1:D20"),
      table_name: STR.describe("Name for the new table"),
      first_row_is_column_names: BOOL.describe(
        "Whether the first row contains column headers"
      ),
    }
  );

  relay(
    "table_meta",
    "Update metadata for a table (name, display options).",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      table_location: STR.describe(
        "Anchor cell of the table in A1 notation, e.g. A5"
      ),
      new_table_name: STR_OPT.describe("New table name"),
      first_row_is_column_names: BOOL_OPT.describe(
        "First row is column headers"
      ),
      show_name: BOOL_OPT.describe("Show table name row"),
      show_columns: BOOL_OPT.describe("Show column header row"),
      alternating_row_colors: BOOL_OPT.describe("Alternating row colors"),
    }
  );

  relay(
    "table_column_settings",
    "Rename, show, or hide columns in a table.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      table_location: STR.describe("Anchor cell of the table"),
      column_names: z
        .array(
          z.object({
            old_name: STR.describe("Current column name"),
            new_name: STR.describe("New column name"),
            show: BOOL.describe("Whether column is visible"),
          })
        )
        .describe("Columns to update"),
    }
  );

  // ---------------------------------------------------------------------------
  // Rows & Columns
  // ---------------------------------------------------------------------------

  relay("resize_columns", "Resize specific columns.", {
    sheet_name: STR_OPT.describe("Sheet name"),
    selection: STR.describe("Column selection in A1 notation, e.g. A1:D1"),
    size: z
      .union([z.enum(["auto", "default"]), z.number().min(20).max(2000)])
      .describe('"auto", "default", or pixel width (20-2000)'),
  });

  relay("resize_rows", "Resize specific rows.", {
    sheet_name: STR_OPT.describe("Sheet name"),
    selection: STR.describe("Row selection in A1 notation, e.g. A1:A100"),
    size: z
      .union([z.enum(["auto", "default"]), z.number().min(10).max(2000)])
      .describe('"auto", "default", or pixel height (10-2000)'),
  });

  relay(
    "set_default_column_width",
    "Set the default column width for the entire sheet.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      size: z
        .number()
        .min(20)
        .max(2000)
        .describe("Default column width in pixels"),
    }
  );

  relay(
    "set_default_row_height",
    "Set the default row height for the entire sheet.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      size: z
        .number()
        .min(10)
        .max(2000)
        .describe("Default row height in pixels"),
    }
  );

  relay("insert_columns", "Insert columns at a position.", {
    sheet_name: STR_OPT.describe("Sheet name"),
    column: STR.describe("Column letter, e.g. A or ZA"),
    right: BOOL.describe("Insert to the right of the column"),
    count: NUM.describe("Number of columns to insert"),
  });

  relay("insert_rows", "Insert rows at a position.", {
    sheet_name: STR_OPT.describe("Sheet name"),
    row: NUM.describe("Row number"),
    below: BOOL.describe("Insert below the row"),
    count: NUM.describe("Number of rows to insert"),
  });

  relay("delete_columns", "Delete columns from a sheet.", {
    sheet_name: STR_OPT.describe("Sheet name"),
    columns: z
      .array(STR)
      .describe('Column letters to delete, e.g. ["A", "C"]'),
  });

  relay("delete_rows", "Delete rows from a sheet.", {
    sheet_name: STR_OPT.describe("Sheet name"),
    rows: z.array(NUM).describe("Row numbers to delete"),
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  relay("get_validations", "Get all validations for a sheet.", {
    sheet_name: STR_OPT.describe("Sheet name"),
  });

  relay(
    "add_logical_validation",
    "Add a logical (checkbox) validation to a selection.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      selection: STR.describe("Selection in A1 notation"),
      show_checkbox: BOOL_OPT.describe("Show checkbox UI"),
      ignore_blank: BOOL_OPT.describe("Allow blank values"),
    }
  );

  relay(
    "add_list_validation",
    "Add a dropdown list validation to a selection.",
    {
      sheet_name: STR_OPT.describe("Sheet name"),
      selection: STR.describe("Selection in A1 notation"),
      ignore_blank: BOOL_OPT.describe("Allow blank values"),
      drop_down: BOOL_OPT.describe("Show as dropdown"),
      list_source_list: STR_OPT.describe(
        "Comma-separated list of values"
      ),
      list_source_selection: STR_OPT.describe(
        "Cell range containing list values"
      ),
    }
  );

  relay("remove_validation", "Remove validations from a selection.", {
    sheet_name: STR_OPT.describe("Sheet name"),
    selection: STR.describe("Selection in A1 notation"),
  });

  // ---------------------------------------------------------------------------
  // Conditional Formatting
  // ---------------------------------------------------------------------------

  relay(
    "get_conditional_formats",
    "Get all conditional formatting rules for a sheet.",
    {
      sheet_name: STR.describe("Sheet name"),
    }
  );

  relay(
    "update_conditional_formats",
    "Create, update, or delete conditional formatting rules.",
    {
      sheet_name: STR.describe("Sheet name"),
      rules: z
        .array(
          z.object({
            id: STR_OPT.describe("Rule UUID (required for update/delete)"),
            action: z
              .enum(["create", "update", "delete"])
              .describe("Action to perform"),
            selection: STR_OPT.describe("Selection in A1 notation"),
            type: z
              .enum(["formula", "color_scale"])
              .nullable()
              .optional()
              .describe("Rule type"),
            rule: STR_OPT.describe("Formula string for formula-type rules"),
            bold: BOOL_OPT,
            italic: BOOL_OPT,
            underline: BOOL_OPT,
            strike_through: BOOL_OPT,
            text_color: STR_OPT.describe("Text color hex"),
            fill_color: STR_OPT.describe("Fill color hex"),
            apply_to_empty: BOOL_OPT,
            color_scale_thresholds: z
              .array(
                z.object({
                  value_type: z.enum([
                    "min",
                    "max",
                    "number",
                    "percent",
                    "percentile",
                  ]),
                  value: NUM_OPT,
                  color: STR,
                })
              )
              .nullable()
              .optional()
              .describe("Color scale threshold definitions"),
            auto_contrast_text: BOOL_OPT,
          })
        )
        .describe("Rules to create/update/delete"),
    }
  );

  // ---------------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------------

  relay(
    "text_search",
    "Search for text in cells within a sheet or the entire file.",
    {
      query: STR.describe("Search query (plain text or regex)"),
      case_sensitive: BOOL.describe("Case-sensitive search"),
      whole_cell: BOOL.describe("Match whole cell content only"),
      search_code: BOOL.describe("Include code cell contents"),
      sheet_name: STR_OPT.describe("Sheet to search (null = all sheets)"),
      regex: BOOL.describe("Treat query as a regex pattern"),
    }
  );

  relay("undo", "Undo the last action(s).", {
    count: NUM_OPT.describe("Number of actions to undo (default 1)"),
  });

  relay("redo", "Redo previously undone action(s).", {
    count: NUM_OPT.describe("Number of actions to redo (default 1)"),
  });

  // ---------------------------------------------------------------------------
  // get_sheet_info is a custom tool not in the AI tool system — handled
  // directly by the postMessage bridge.
  // ---------------------------------------------------------------------------

  relay(
    "get_sheet_info",
    "List all sheets and their names in the spreadsheet.",
    {}
  );

  return mcp;
}
