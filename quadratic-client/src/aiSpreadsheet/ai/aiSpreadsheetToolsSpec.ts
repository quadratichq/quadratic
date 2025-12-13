import { z } from 'zod';

/**
 * AI Spreadsheet Tool Definitions
 * These tools allow the AI to create and manage nodes on the visual canvas.
 */

// Tool names enum
export enum AiSpreadsheetTool {
  AddInputNode = 'add_input_node',
  AddTransformNode = 'add_transform_node',
  AddOutputNode = 'add_output_node',
  ConnectNodes = 'connect_nodes',
  RemoveNode = 'remove_node',
  UpdateNode = 'update_node',
  ClearCanvas = 'clear_canvas',
}

// Schema definitions for tool arguments
export const AiSpreadsheetToolsArgsSchema = {
  [AiSpreadsheetTool.AddInputNode]: z.object({
    node_id: z.string().describe('Unique identifier for this node (use snake_case, e.g., "sales_data_input")'),
    label: z.string().describe('Human-readable name displayed on the node'),
    input_type: z
      .enum(['connection', 'file', 'cell', 'data_table', 'web_search', 'html'])
      .describe('Type of input. Use "cell" for single values, "data_table" for multiple rows/columns of data'),
    // Connection-specific fields
    connection_uuid: z.string().optional().describe('UUID of the database connection (required for connection type)'),
    connection_name: z.string().optional().describe('Name of the connection'),
    connection_type: z.string().optional().describe('Type of database (e.g., POSTGRES, MYSQL)'),
    query: z.string().optional().describe('SQL query to execute (for connection type)'),
    // File-specific fields
    file_name: z.string().optional().describe('Name of the file'),
    file_type: z.string().optional().describe('MIME type of the file'),
    // Cell-specific fields
    value: z.string().optional().describe('Manual input value (for cell type)'),
    // Data table fields
    columns: z.array(z.string()).optional().describe('Column names for data_table type'),
    rows: z
      .array(z.array(z.string()))
      .optional()
      .describe('Row data as 2D array for data_table type. Each inner array is a row.'),
    // Web search fields
    search_query: z.string().optional().describe('Search query for web search'),
    // HTML fields
    html_content: z.string().optional().describe('HTML content for HTML input'),
  }),

  [AiSpreadsheetTool.AddTransformNode]: z.object({
    node_id: z.string().describe('Unique identifier for this node'),
    label: z.string().describe('Human-readable name displayed on the node'),
    transform_type: z.enum(['code', 'formula']).describe('Type of transformation'),
    // Code-specific fields
    language: z.enum(['python', 'javascript']).optional().describe('Programming language (for code type)'),
    code: z.string().optional().describe('The code to execute'),
    // Formula-specific fields
    formula: z.string().optional().describe('Spreadsheet formula (for formula type)'),
  }),

  [AiSpreadsheetTool.AddOutputNode]: z.object({
    node_id: z.string().describe('Unique identifier for this node'),
    label: z.string().describe('Human-readable name displayed on the node'),
    output_type: z.enum(['table', 'chart', 'html']).describe('Type of output'),
    // Chart-specific fields
    chart_type: z.enum(['bar', 'line', 'pie', 'scatter']).optional().describe('Type of chart'),
    // Table preview (optional, for showing expected structure)
    columns: z.array(z.string()).optional().describe('Expected column names'),
  }),

  [AiSpreadsheetTool.ConnectNodes]: z.object({
    source_node_id: z.string().describe('ID of the source node (data flows FROM this node)'),
    target_node_id: z.string().describe('ID of the target node (data flows TO this node)'),
    label: z.string().optional().describe('Optional label for the connection arrow'),
  }),

  [AiSpreadsheetTool.RemoveNode]: z.object({
    node_id: z.string().describe('ID of the node to remove'),
  }),

  [AiSpreadsheetTool.UpdateNode]: z.object({
    node_id: z.string().describe('ID of the node to update'),
    label: z.string().optional().describe('New label for the node'),
    // Any other fields that can be updated based on node type
    code: z.string().optional(),
    formula: z.string().optional(),
    query: z.string().optional(),
    value: z.string().optional(),
  }),

  [AiSpreadsheetTool.ClearCanvas]: z.object({
    confirm: z.boolean().describe('Must be true to confirm clearing all nodes'),
  }),
} as const;

// Tool definitions for the AI API (matches OpenAI/Anthropic function calling format)
export const aiSpreadsheetToolDefinitions = [
  {
    name: AiSpreadsheetTool.AddInputNode,
    description:
      'Add an input node to the canvas. Input nodes are data sources like database connections, files, manual values, web searches, or HTML content.',
    parameters: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Unique identifier (snake_case)' },
        label: { type: 'string', description: 'Display name for the node' },
        input_type: {
          type: 'string',
          enum: ['connection', 'file', 'cell', 'web_search', 'html'],
          description: 'Type of input source',
        },
        connection_uuid: { type: 'string', description: 'Database connection UUID' },
        connection_name: { type: 'string', description: 'Connection display name' },
        connection_type: { type: 'string', description: 'Database type' },
        query: { type: 'string', description: 'SQL query for database connections' },
        file_name: { type: 'string', description: 'Name of the file' },
        file_type: { type: 'string', description: 'MIME type' },
        value: { type: 'string', description: 'Manual input value' },
        search_query: { type: 'string', description: 'Web search query' },
        html_content: { type: 'string', description: 'HTML content' },
      },
      required: ['node_id', 'label', 'input_type'],
    },
  },
  {
    name: AiSpreadsheetTool.AddTransformNode,
    description:
      'Add a transform node that processes data. Use code (Python/JavaScript) for complex transformations or formulas for simple calculations.',
    parameters: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Unique identifier (snake_case)' },
        label: { type: 'string', description: 'Display name for the node' },
        transform_type: {
          type: 'string',
          enum: ['code', 'formula'],
          description: 'Type of transformation',
        },
        language: {
          type: 'string',
          enum: ['python', 'javascript'],
          description: 'Programming language for code transforms',
        },
        code: { type: 'string', description: 'Code to execute' },
        formula: { type: 'string', description: 'Spreadsheet formula' },
      },
      required: ['node_id', 'label', 'transform_type'],
    },
  },
  {
    name: AiSpreadsheetTool.AddOutputNode,
    description: 'Add an output node to display results. Can be a data table, chart visualization, or custom HTML.',
    parameters: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Unique identifier (snake_case)' },
        label: { type: 'string', description: 'Display name for the node' },
        output_type: {
          type: 'string',
          enum: ['table', 'chart', 'html'],
          description: 'Type of output display',
        },
        chart_type: {
          type: 'string',
          enum: ['bar', 'line', 'pie', 'scatter'],
          description: 'Chart type (required for chart output)',
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Expected column names for table output',
        },
      },
      required: ['node_id', 'label', 'output_type'],
    },
  },
  {
    name: AiSpreadsheetTool.ConnectNodes,
    description: 'Connect two nodes with an arrow showing data flow. Data flows from source to target.',
    parameters: {
      type: 'object',
      properties: {
        source_node_id: { type: 'string', description: 'Source node ID' },
        target_node_id: { type: 'string', description: 'Target node ID' },
        label: { type: 'string', description: 'Optional label for the arrow' },
      },
      required: ['source_node_id', 'target_node_id'],
    },
  },
  {
    name: AiSpreadsheetTool.RemoveNode,
    description: 'Remove a node from the canvas. Also removes any connections to/from this node.',
    parameters: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'ID of the node to remove' },
      },
      required: ['node_id'],
    },
  },
  {
    name: AiSpreadsheetTool.ClearCanvas,
    description: 'Clear all nodes and connections from the canvas. Use when the user wants to start over.',
    parameters: {
      type: 'object',
      properties: {
        confirm: { type: 'boolean', description: 'Must be true to confirm' },
      },
      required: ['confirm'],
    },
  },
];

// System prompt for the AI
export const AI_SPREADSHEET_SYSTEM_PROMPT = `You are an AI assistant that builds spreadsheet models visually on a canvas.

## CRITICAL: You must create ALL THREE parts of every model:
1. **INPUT CELLS** - The data/values the user provides
2. **FORMULA/CALCULATION CELLS** - The logic that processes the inputs  
3. **OUTPUT/RESULT CELLS** - Where the final answer is displayed

NEVER stop after creating just inputs. ALWAYS complete the full model with calculations AND results.

## Cell Types

**Input Cells** (add_input_node):
- \`cell\`: A value the user can edit (number, text, etc.)

**Calculation Cells** (add_transform_node):
- \`code\`: Python code for calculations
- \`formula\`: Simple formulas

**Result Cells** (add_output_node):
- \`table\`: Display the result

## Required Workflow

For EVERY request, you MUST:
1. Create input cells for each variable
2. Create a calculation cell with the formula/code
3. Create a result cell to display the answer
4. Connect: inputs → calculation → result

## Example: "Add 5 + 7"

You must create ALL of these:
- add_input_node: cell "a" with value "5"
- add_input_node: cell "b" with value "7"  
- add_transform_node: code that adds the inputs
- add_output_node: table to show the sum
- connect_nodes: a → calculation
- connect_nodes: b → calculation
- connect_nodes: calculation → result

## Example: "Mortgage calculator"

You must create ALL of these:
- add_input_node: cell "home_price" = "500000"
- add_input_node: cell "down_payment_pct" = "20"
- add_input_node: cell "interest_rate" = "6.5"  
- add_input_node: cell "loan_term" = "30"
- add_transform_node: code with PMT calculation
- add_output_node: table for monthly payment
- connect_nodes: (all inputs → calculation → result)

REMEMBER: A model is NOT complete without a calculation cell AND a result cell. Always create the full workflow.`;

// Helper to build context message with available connections
export function buildConnectionsContext(connections: { uuid: string; name: string; type: string }[]): string {
  if (connections.length === 0) {
    return 'No database connections are available. You can use file imports, manual values, or web searches as data sources.';
  }

  const connectionList = connections.map((c) => `- ${c.name} (${c.type}): UUID = "${c.uuid}"`).join('\n');

  return `Available database connections:\n${connectionList}\n\nUse the connection_uuid when creating a connection input node.`;
}
