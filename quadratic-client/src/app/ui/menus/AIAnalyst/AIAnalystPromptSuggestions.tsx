import { trackEvent } from '@/shared/utils/analyticsEvents';

type ContextType = 'empty' | 'connection' | 'file-pdf'; // | 'file-image' | 'file-csv' | 'file-excel'
const examplesByContextType: Record<ContextType, Array<{ title: string; prompt: string }>> = {
  empty: [
    // {
    //   title: 'What can I do?',
    //   prompt: 'Tell me what I can do in Quadratic. Keep it short and concise.',
    // },
    {
      title: 'Build a chart',
      prompt: 'Help me build a chart in Quadratic. If there is no data on the sheet add sample data and plot it.',
    },
    {
      title: 'Search the web',
      prompt: 'Search the web for the top 10 companies in the US by revenue.',
    },
    {
      title: 'Connect an API',
      prompt:
        'Show me how to do a GET request using Python. Pull data from https://jsonplaceholder.typicode.com and put it on the sheet. Wrap everything in a single function and have that be the last thing returned to the sheet.',
    },
  ],
  connection: [
    {
      title: 'Explore the schema',
      prompt: `Inspect the schema. List the first 5 tables alphabetically.
For each table, tell me about: table name, number of columns, and the first 5 column names with data types. If there are more than 5, add a bullet saying "...and (x) more"
Keep the output short and readable, as a quick preview of the schema.
Don't put anything on the sheet, just respond in the chat.`,
    },
    {
      title: 'Perform a sample analysis',
      prompt: `Review the schema and imagine a simple, useful analytical question (e.g. "Which users signed up most recently?" or "What are the top 5 most popular products?").  
For that question:  
1. Write the SQL query to answer it.  
2. Provide a short natural language summary of what the result means.`,
    },
    //     {
    //       title: 'Explore relationships',
    //       prompt: `Inspect the schema and list possible joins between tables.
    // Propose up to five practical queries (e.g., "users with their orders") as ways to explore insights in the data.
    // Don't put any data on the sheet. Just respond in chat succinctly.`,
    //     },
    {
      title: 'Visualize data from a table',
      prompt: `Select one table from the schema that looks most relevant (e.g. contains time, numeric, or categorical data).  
Fetch a sample of up to 100 rows.
Based on the column types:
- Use a line chart if there is a datetime column with numeric values.
- Use a bar chart if there are categorical vs numeric pairs.
- Use a histogram for a purely numeric column.
Output the SQL query and describe the visualization to render.`,
    },
  ],
  'file-pdf': [
    {
      title: 'Summarize contents',
      prompt:
        'Read the selected PDF and summarize its contents. Do not extract any data. Do not put any data on the sheet. Only respond in chat with a short and concise high-level summary of the PDFs contents.',
    },
    {
      title: 'Extract data to sheet',
      prompt: 'Extract data from the PDF and put it on the sheet.',
    },
    {
      title: 'Generate insights',
      prompt:
        'Identify trends, and provide actionable insights from PDF content. Respond in chat. Keep it short and concise.',
    },
  ],
  // TODO: file-csv, file-excel, file-image, ...
};

export function AIAnalystPromptSuggestions({
  exampleSet,
  prompt,
  submit,
  selectedConnectionUuid,
  setSelectedConnectionUuid,
}: {
  exampleSet: keyof typeof examplesByContextType;
  prompt: string;
  submit: (prompt: string) => void;
  selectedConnectionUuid: string;
  setSelectedConnectionUuid: (connectionUuid: string) => void;
}) {
  return (
    <div className="absolute bottom-full left-0 mb-1 flex w-full flex-row flex-wrap gap-1">
      {examplesByContextType[exampleSet].map(({ title, prompt }) => (
        <button
          key={title}
          className="flex items-center gap-3 rounded bg-accent px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            trackEvent('[AIAnalyst].submitExamplePrompt', { title });
            submit(prompt);
          }}
        >
          {title}
        </button>
      ))}
    </div>
  );
}
