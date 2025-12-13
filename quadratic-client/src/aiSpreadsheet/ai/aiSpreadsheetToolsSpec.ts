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
    node_id: z.string().describe('Unique identifier for this node (use snake_case, e.g., "sales_data")'),
    name: z.string().optional().describe('Reference name for q.get("name") in code. If not provided, uses node_id.'),
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
    description: z
      .string()
      .optional()
      .describe('Brief human-readable description of what the code does (shown by default instead of code)'),
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
    node_id: z.string().describe('ID of the existing node to update'),
    label: z.string().optional().describe('New label for the node'),
    // For code cells
    code: z.string().optional().describe('New Python code for code cell'),
    description: z.string().optional().describe('New description for code cell'),
    // For input cells
    value: z.string().optional().describe('New value for input cell'),
    // Other types
    formula: z.string().optional(),
    query: z.string().optional(),
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
      'Add an input node to the canvas. Input nodes are data sources that code cells can reference via q.get("name").',
    parameters: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Unique identifier (snake_case)' },
        name: { type: 'string', description: 'Reference name for q.get("name") in code' },
        label: { type: 'string', description: 'Display name for the node' },
        input_type: {
          type: 'string',
          enum: ['connection', 'file', 'cell', 'data_table', 'web_search', 'html'],
          description: 'Type of input source',
        },
        connection_uuid: { type: 'string', description: 'Database connection UUID' },
        connection_name: { type: 'string', description: 'Connection display name' },
        connection_type: { type: 'string', description: 'Database type' },
        query: { type: 'string', description: 'SQL query for database connections' },
        file_name: { type: 'string', description: 'Name of the file' },
        file_type: { type: 'string', description: 'MIME type' },
        value: { type: 'string', description: 'Manual input value' },
        columns: { type: 'array', items: { type: 'string' }, description: 'Column names for data_table' },
        rows: {
          type: 'array',
          items: { type: 'array', items: { type: 'string' } },
          description: 'Row data for data_table',
        },
        search_query: { type: 'string', description: 'Web search query' },
        html_content: { type: 'string', description: 'HTML content' },
      },
      required: ['node_id', 'name', 'label', 'input_type'],
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
export const AI_SPREADSHEET_SYSTEM_PROMPT = `You are an AI assistant that builds reactive spreadsheet models visually on a canvas.

## How It Works

1. **Input Cells** - Values the user can edit. Each has a unique \`name\` for reference.
2. **Code Cells** - Python code that reads inputs via \`q.get("name")\` and computes results.

Code cells automatically display their output (value, table, or chart). When inputs change, code re-runs automatically.

## Cell Types

**Input Cells** (add_input_node):
- \`cell\`: A single editable value (number, text, etc.)
- \`data_table\`: Multiple rows/columns of data

**Code Cells** (add_transform_node):
- \`code\`: Python code that uses \`q.get("name")\` to read inputs

## How to Reference Inputs in Code

Use \`q.get("input_name")\` to get values from input cells:

\`\`\`python
# Get single values
price = q.get("home_price")     # Returns: 500000
rate = q.get("interest_rate")   # Returns: 6.5

# Get data tables (returns pandas DataFrame)
sales_df = q.get("sales_data")
\`\`\`

## Required Workflow

For EVERY request:
1. Create input cells with \`name\` fields (used for q.get reference)
2. Create a code cell that uses \`q.get()\` to read inputs
3. Connect: inputs → code cell

The code cell's return value (last expression) becomes the displayed result.

## Example: "Add 5 + 7"

- add_input_node: { node_id: "a", name: "a", label: "A", input_type: "cell", value: "5" }
- add_input_node: { node_id: "b", name: "b", label: "B", input_type: "cell", value: "7" }
- add_transform_node: { node_id: "sum", label: "Sum", transform_type: "code", language: "python", code: "a = q.get('a')\\nb = q.get('b')\\na + b" }
- connect_nodes: a → sum
- connect_nodes: b → sum

Result: The code cell displays "12"

## Example: "Mortgage calculator"

- add_input_node: { node_id: "home_price", name: "home_price", label: "Home Price", input_type: "cell", value: "500000" }
- add_input_node: { node_id: "down_pct", name: "down_payment_pct", label: "Down Payment %", input_type: "cell", value: "20" }
- add_input_node: { node_id: "rate", name: "interest_rate", label: "Interest Rate %", input_type: "cell", value: "6.5" }
- add_input_node: { node_id: "term", name: "loan_term", label: "Loan Term (years)", input_type: "cell", value: "30" }
- add_transform_node with Python code that:
  - Gets each input with q.get()
  - Calculates monthly payment using PMT formula
  - Returns formatted result string
- connect_nodes: (all inputs → payment)

## Output Types

The code cell result type is determined automatically:
- **Single value**: Just return a number, string, etc.
- **Table**: Return a pandas DataFrame
- **Chart**: Return a plotly figure (it renders as HTML)

IMPORTANT: Do NOT create add_output_node calls. Code cells display their own results.

## Editing Existing Nodes (update_node)

When you need to fix errors or modify existing cells, use \`update_node\` instead of creating new ones:

\`\`\`
update_node: {
  node_id: "existing_node_id",
  code: "# fixed code here",
  description: "Updated description"
}
\`\`\`

**When to use update_node:**
- Fixing Python errors in code cells
- Changing input values
- Updating labels or descriptions
- Modifying code logic

**Important:** Always prefer \`update_node\` over deleting and recreating nodes when making changes.`;

// Helper to build context message with available connections
export function buildConnectionsContext(connections: { uuid: string; name: string; type: string }[]): string {
  if (connections.length === 0) {
    return 'No database connections are available. You can use file imports, manual values, or web searches as data sources.';
  }

  const connectionList = connections.map((c) => `- ${c.name} (${c.type}): UUID = "${c.uuid}"`).join('\n');

  return `Available database connections:\n${connectionList}\n\nUse the connection_uuid when creating a connection input node.`;
}
