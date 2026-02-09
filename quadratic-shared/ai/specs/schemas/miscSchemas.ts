import { z } from 'zod';
import type { AIToolSpec } from '../aiToolsCore';
import { AITool, booleanSchema, numberSchema, stringSchema } from '../aiToolsCore';

// Zod schemas for misc tools
export const miscToolsArgsSchemas = {
  [AITool.SetAIModel]: z.object({
    // Model router options only (see MODELS_ROUTER_CONFIGURATION); not all MODELS_CONFIGURATION keys.
    ai_model: z
      .string()
      .transform((val) => val.toLowerCase().replace(/\s+/g, '-'))
      .pipe(z.enum(['claude', '4.1'])),
  }),
  [AITool.SetChatName]: z.object({
    chat_name: stringSchema,
  }),
  [AITool.SetFileName]: z.object({
    file_name: stringSchema,
  }),
  [AITool.UserPromptSuggestions]: z.object({
    prompt_suggestions: z.array(
      z.object({
        label: stringSchema,
        prompt: stringSchema,
      })
    ),
  }),
  [AITool.EmptyChatPromptSuggestions]: z.object({
    prompt_suggestions: z.array(
      z.object({
        label: stringSchema,
        prompt: stringSchema,
      })
    ),
  }),
  [AITool.CategorizedEmptyChatPromptSuggestions]: z.object({
    enrich: z.array(
      z.object({
        label: stringSchema,
        prompt: stringSchema,
      })
    ),
    clean: z.array(
      z.object({
        label: stringSchema,
        prompt: stringSchema,
      })
    ),
    visualize: z.array(
      z.object({
        label: stringSchema,
        prompt: stringSchema,
      })
    ),
    analyze: z.array(
      z.object({
        label: stringSchema,
        prompt: stringSchema,
      })
    ),
  }),
  [AITool.PDFImport]: z.object({
    file_name: stringSchema,
    prompt: stringSchema,
  }),
  [AITool.WebSearch]: z.object({
    query: stringSchema,
  }),
  [AITool.WebSearchInternal]: z.object({
    query: stringSchema,
  }),
  [AITool.TextSearch]: z.object({
    query: z.string(),
    case_sensitive: booleanSchema,
    whole_cell: booleanSchema,
    search_code: booleanSchema,
    sheet_name: z.string().nullable().optional(),
  }),
  [AITool.Undo]: z.object({
    count: numberSchema.nullable().optional(),
  }),
  [AITool.Redo]: z.object({
    count: numberSchema.nullable().optional(),
  }),
  [AITool.ContactUs]: z.object({
    acknowledged: booleanSchema.nullable().optional(),
  }),
  [AITool.OptimizePrompt]: z.object({
    optimized_prompt: stringSchema,
  }),
} as const;

// Specs for misc tools
export const miscToolsSpecs: { [K in keyof typeof miscToolsArgsSchemas]: AIToolSpec } = {
  [AITool.SetAIModel]: {
    sources: ['ModelRouter'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
Sets the AI Model to use for this user prompt.\n
Choose the AI model for this user prompt based on the following instructions, always respond with only one the model options matching it exactly.\n
`,
    parameters: {
      type: 'object',
      properties: {
        ai_model: {
          type: 'string',
          description:
            'Value can be only one of the following: "claude" or "4.1" models exactly, this is the model best suited for the user prompt based on examples and model capabilities.\n',
        },
      },
      required: ['ai_model'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.SetAIModel],
    prompt: '',
  },
  [AITool.SetChatName]: {
    sources: ['GetChatName'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
Set the name of the user chat with AI assistant, this is the name of the chat in the chat history\n
You should use the set_chat_name function to set the name of the user chat with AI assistant, this is the name of the chat in the chat history.\n
This function requires the name of the chat, this should be concise and descriptive of the conversation, and should be easily understandable by a non-technical user.\n
The chat name should be based on user's messages and should reflect his/her queries and goals.\n
This name should be from user's perspective, not the assistant's.\n
`,
    parameters: {
      type: 'object',
      properties: {
        chat_name: {
          type: 'string',
          description: 'The name of the chat',
        },
      },
      required: ['chat_name'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.SetChatName],
    prompt: '',
  },
  [AITool.SetFileName]: {
    sources: ['GetFileName'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
Set the name of the file based on the AI chat conversation, this is the name of the file in the file system.\n
You should use the set_file_name function to set the name of the file based on the AI chat conversation between AI assistant and the user.\n
This function requires the name of the file, this should be concise and descriptive of the file's content and purpose, and should be easily understandable by a non-technical user.\n
The file name should be based on user's messages and should reflect the file's purpose and content.\n
This name should be from user's perspective, not the assistant's.\n
IMPORTANT: The file name must be 1-3 words only. Keep it short and concise.\n
The file name should focus on the analysis or topic being explored (e.g., "GDP over time", "Sales trends", "Budget analysis"), not on implementation details like "chart", "table", "report", or "dashboard". Focus on what is being analyzed, not how it's presented.\n
`,
    parameters: {
      type: 'object',
      properties: {
        file_name: {
          type: 'string',
          description: 'The name of the file. Must be 1-3 words only. Keep it short and concise.',
        },
      },
      required: ['file_name'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.SetFileName],
    prompt: '',
  },
  [AITool.UserPromptSuggestions]: {
    sources: ['AIAnalyst', 'GetUserPromptSuggestions'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool provides prompt suggestions for the user, requires an array of three prompt suggestions.\n
Each prompt suggestion is an object with a label and a prompt.\n
The label is a descriptive label for the prompt suggestion with maximum 40 characters, this will be displayed to the user in the UI.\n
The prompt is the actual detailed prompt that will be executed by the AI agent to take actions on the spreadsheet.\n
Use the internal context and the chat history to provide the prompt suggestions.\n
Always maintain strong correlation between the follow up prompts and the user's chat history and the internal context.\n
IMPORTANT: This tool should always be called after you have provided the response to the user's prompt and all tool calls are finished, to provide user follow up prompts suggestions.\n
`,
    parameters: {
      type: 'object',
      properties: {
        prompt_suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'The label of the follow up prompt, maximum 40 characters',
              },
              prompt: {
                type: 'string',
                description:
                  'Detailed prompt for the user that will be executed by the AI agent to take actions on the spreadsheet',
              },
            },
            required: ['label', 'prompt'],
            additionalProperties: false,
          },
        },
      },
      required: ['prompt_suggestions'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.UserPromptSuggestions],
    prompt: `
This tool provides prompt suggestions for the user, requires an array of three prompt suggestions.\n
Each prompt suggestion is an object with a label and a prompt.\n
The label is a descriptive label for the prompt suggestion with maximum 40 characters, this will be displayed to the user in the UI.\n
The prompt is the actual detailed prompt that will be executed by the AI agent to take actions on the spreadsheet.\n
Use the internal context and the chat history to provide the prompt suggestions.\n
Always maintain strong correlation between the prompt suggestions and the user's chat history and the internal context.\n
IMPORTANT: This tool should always be called after you have provided the response to the user's prompt and all tool calls are finished, to provide user follow up prompts suggestions.\n
`,
  },
  [AITool.EmptyChatPromptSuggestions]: {
    sources: ['GetEmptyChatPromptSuggestions'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool provides prompt suggestions for the user for an empty chat when user attaches a file or adds a connection or code cell to context, requires an array of three prompt suggestions.\n
Each prompt suggestion is an object with a label and a prompt.\n
The label is a descriptive label for the prompt suggestion with maximum 25 characters, this will be displayed to the user in the UI.\n
The prompt is the actual detailed prompt that will be executed by the AI agent to take actions on the spreadsheet.\n
Always maintain strong correlation between the context, the files, the connections and the code cells to provide the prompt suggestions.\n
`,
    parameters: {
      type: 'object',
      properties: {
        prompt_suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'The label of the follow up prompt, maximum 25 characters',
              },
              prompt: {
                type: 'string',
                description:
                  'Detailed prompt for the user that will be executed by the AI agent to take actions on the spreadsheet. Should be in strong correlation with the context, the files, the connections and the code cells',
              },
            },
            required: ['label', 'prompt'],
            additionalProperties: false,
          },
        },
      },
      required: ['prompt_suggestions'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.EmptyChatPromptSuggestions],
    prompt: `
This tool provides prompt suggestions for the user when they attach a file or add a connection to an empty chat. It requires an array of three prompt suggestions.\n
Each prompt suggestion is an object with a label and a prompt.\n
The label is a descriptive label for the prompt suggestion with maximum 25 characters, this will be displayed to the user in the UI.\n
The prompt is the actual detailed prompt that will be executed by the AI agent to take actions on the spreadsheet.\n
Always maintain strong correlation between the context, the files, the connections and the code cells to provide the prompt suggestions.\n
`,
  },
  [AITool.CategorizedEmptyChatPromptSuggestions]: {
    sources: ['GetEmptyChatPromptSuggestions'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool provides categorized prompt suggestions for the user based on their spreadsheet data.\n
It requires exactly 3 suggestions per category (enrich, clean, visualize, analyze).\n
Each suggestion has a short label (max 7 words) and a detailed prompt.\n
`,
    parameters: {
      type: 'object',
      properties: {
        enrich: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Short label (max 7 words) for enriching data' },
              prompt: {
                type: 'string',
                description: 'Detailed prompt for adding derived columns, combining fields, or looking up related data',
              },
            },
            required: ['label', 'prompt'],
            additionalProperties: false,
          },
        },
        clean: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Short label (max 7 words) for cleaning data' },
              prompt: {
                type: 'string',
                description: 'Detailed prompt for fixing formatting, removing duplicates, or standardizing values',
              },
            },
            required: ['label', 'prompt'],
            additionalProperties: false,
          },
        },
        visualize: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Short label (max 7 words) for visualization' },
              prompt: { type: 'string', description: 'Detailed prompt for creating charts and graphs' },
            },
            required: ['label', 'prompt'],
            additionalProperties: false,
          },
        },
        analyze: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Short label (max 7 words) for analysis' },
              prompt: {
                type: 'string',
                description: 'Detailed prompt for calculating statistics, finding patterns, or deriving insights',
              },
            },
            required: ['label', 'prompt'],
            additionalProperties: false,
          },
        },
      },
      required: ['enrich', 'clean', 'visualize', 'analyze'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.CategorizedEmptyChatPromptSuggestions],
    prompt: `
This tool provides categorized prompt suggestions based on the spreadsheet data.\n
Generate exactly 3 suggestions per category, with each suggestion having a short label and detailed prompt.\n
The four categories are:\n
1. enrich - Add derived columns, combine fields, look up related data\n
2. clean - Fix formatting, remove duplicates, standardize values\n
3. visualize - Create charts and graphs\n
4. analyze - Calculate statistics, find patterns, derive insights\n
Make all suggestions specific to the actual data columns and values in the spreadsheet.\n
`,
  },
  [AITool.PDFImport]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool extracts data from the attached PDF files and converts it into a structured format i.e. as Data Tables on the sheet.\n
This tool requires the file_name of the PDF and a clear and explicit prompt to extract data from that PDF file.\n
Forward the actual user prompt as much as possible that is related to the PDF file.\n
Always capture user intention exactly and give a clear and explicit prompt to extract data from PDF files.\n
Use this tool only if there is a PDF file that needs to be extracted. If there is no PDF file, do not use this tool.\n
Never extract data from PDF files that are not relevant to the user's prompt. Never try to extract data from PDF files on your own. Always use the pdf_import tool when dealing with PDF files.\n
Follow the user's instructions carefully and provide accurate and relevant data. If there are insufficient instructions, always ask the user for more information.\n
Do not use multiple tools at the same time when dealing with PDF files. pdf_import should be the only tool call in a reply when dealing with PDF files. Any analysis on imported data should only be done after import is successful.\n
`,
    parameters: {
      type: 'object',
      properties: {
        file_name: {
          type: 'string',
          description: 'The name of the PDF file to extract data from.',
        },
        prompt: {
          type: 'string',
          description:
            "The prompt based on the user's intention and the context of the conversation to extract data from PDF files, which will be used by the pdf_import tool to extract data from PDF files.",
        },
      },
      required: ['file_name', 'prompt'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.PDFImport],
    prompt: `
This tool extracts data from the attached PDF files and converts it into a structured format i.e. as Data Tables on the sheet.\n
This tool requires the file_name of the PDF and a clear and explicit prompt to extract data from that PDF file.\n
Forward the actual user prompt as much as possible that is related to the PDF file.\n
Always capture user intention exactly and give a clear and explicit prompt to extract data from PDF files.\n
Use this tool only if there is a PDF file that needs to be extracted. If there is no PDF file, do not use this tool.\n
Never extract data from PDF files that are not relevant to the user's prompt. Never try to extract data from PDF files on your own. Always use the pdf_import tool when dealing with PDF files.\n
Follow the user's instructions carefully and provide accurate and relevant data. If there are insufficient instructions, always ask the user for more information.\n
Do not use multiple tools at the same time when dealing with PDF files. pdf_import should be the only tool call in a reply when dealing with PDF files. Any analysis on imported data should only be done after import is successful.\n
`,
  },
  [AITool.WebSearch]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool searches the web for information based on the query.\n
Use this tool when the user asks for information that is not already available in the context.\n
When you would otherwise try to answer from memory or not have a way to answer the user's question, use this tool to retrieve the needed data from the web.\n
This tool should also be used when trying to retrieve information for how to construct API requests that are not well-known from memory and when requiring information on code libraries that are not well-known from memory.\n
It requires the query to search for.\n
`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.WebSearch],
    prompt: `
This tool searches the web for information based on the query.\n
Use this tool when the user asks for information that is not already available in the context.\n
When you would otherwise try to answer from memory or not have a way to answer the user's question, use this tool to retrieve the needed data from the web.\n
This tool should also be used when trying to retrieve information for how to construct API requests that are not well-known from memory and when requiring information on code libraries that are not well-known from memory.\n
It requires the query to search for.\n
`,
  },
  [AITool.WebSearchInternal]: {
    sources: ['WebSearch'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool searches the web for information based on the query.\n
It requires the query to search for.\n
`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.WebSearchInternal],
    prompt: `
This tool searches the web for information based on the query.\n
It requires the query to search for.\n
`,
  },
  [AITool.TextSearch]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool searches for text in cells within a specific sheet or the entire file.\n
Use this tool when looking for a specific piece of output in the file.\n
This tool can only search for outputs that exist in cells within the file. This tool cannot search for code, only the outputs and contents in the sheet.\n
`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The query to search for',
        },
        case_sensitive: {
          type: 'boolean',
          description: 'Whether the search should be case sensitive',
        },
        whole_cell: {
          type: 'boolean',
          description:
            'Whether the search should be for the whole cell (i.e., if true, then a cell with "Hello World" would not be found with a search for "Hello"; if false, it would be).',
        },
        search_code: {
          type: 'boolean',
          description: 'Whether the search should include code within code cells',
        },
        sheet_name: {
          type: ['string', 'null'],
          description: 'The sheet name to search in. If not provided, then it searches all sheets.',
        },
      },
      required: ['query', 'case_sensitive', 'whole_cell', 'search_code', 'sheet_name'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.TextSearch],
    prompt: `
This tool searches for text in cells within a specific sheet or the entire file.\n
Use this tool when looking for a specific piece of output in the file.\n
This tool can only search for outputs that exist in cells within the file. This tool cannot search for code, only the outputs and contents in the sheet.\n
`,
  },
  [AITool.Undo]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool undoes the last action. You MUST use the aiUpdates context to understand the relevant actions and the count of actions to undo.\n
Always pass in the count of actions to undo when using the undo tool, even if the count to undo is 1.\n
If the user's undo request is multiple transactions in the past, use the count parameter to pass the number of transactions to undo.\n`,
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description:
            'The number of transactions to undo. Should be a number and at least 1 (which only performs an undo on the last transaction)',
        },
      },
      required: ['count'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.Undo],
    prompt: `
This tool undoes the last action. You MUST use the aiUpdates context to understand the last action and what is undoable.\n
Always pass in the count of actions to undo when using the undo tool, even if the count to undo is 1.\n
If the user's undo request is multiple transactions in the past, use the count parameter to pass the number of transactions to undo.\n`,
  },
  [AITool.Redo]: {
    sources: ['AIAnalyst'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool redoes the last action. You MUST use the aiUpdates context to understand the relevant actions and the count of actions to redo.\n
Always pass in the count of actions to redo when using the redo tool, even if the count to redo is 1.\n
If the user's redo request is multiple transactions, use the count parameter to pass the number of transactions to redo.\n`,
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description:
            'The number of transactions to redo. Should be a number and at least 1 (which only performs an redo on the last transaction). Can only redo after the same number of undos have been performed.',
        },
      },
      required: ['count'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.Redo],
    prompt: `
This tool redoes the last action. You MUST use the aiUpdates context to understand the relevant actions and the count of actions to redo.\n
Always pass in the count of actions to redo when using the redo tool, even if the count to redo is 1.\n
If the user's redo request is multiple transactions, use the count parameter to pass the number of transactions to redo.\n`,
  },
  [AITool.ContactUs]: {
    sources: ['AIAnalyst', 'AIAssistant'],
    aiModelModes: ['disabled', 'fast', 'max', 'others'],
    description: `
This tool provides a way for users to get help from the Quadratic team when experiencing frustration or issues.\n
Use this tool when the user expresses high levels of frustration, uses cursing or degrading language, or explicitly asks to speak with the team.\n
The tool displays a contact form with options to reach out to the team or start a new chat.\n`,
    parameters: {
      type: 'object',
      properties: {
        acknowledged: {
          type: ['boolean', 'null'],
          description: 'Acknowledgment flag (can be null or boolean)',
        },
      },
      required: ['acknowledged'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.ContactUs],
    prompt: `
This tool provides a way for users to get help from the Quadratic team when they are experiencing frustration or issues.\n
Use this tool when the user expresses high levels of frustration, uses cursing or degrading language, or explicitly asks to speak with the team.\n
This should be used to help frustrated users get direct support from the Quadratic team.\n
The tool displays "Get help from our team" as the title, "Provide your feedback and we'll get in touch soon." as the description,\n
and includes a recommendation message: "Contact us or consider starting a new chat to give the AI a fresh start."\n
It provides both a "Contact us" button and a "New chat" button for the user.\n`,
  },
  [AITool.OptimizePrompt]: {
    sources: ['OptimizePrompt'],
    aiModelModes: ['disabled', 'fast', 'max'],
    description: `
This tool restructures a user's prompt into clear, step-by-step bulleted instructions.\n
The output MUST be a bulleted list with specific sections covering the task, output creation, and any other relevant details.\n
Use the spreadsheet context to make instructions specific and actionable.\n`,
    parameters: {
      type: 'object',
      properties: {
        optimized_prompt: {
          type: 'string',
          description: 'The restructured prompt as a bulleted list with clear step-by-step instructions',
        },
      },
      required: ['optimized_prompt'],
      additionalProperties: false,
    },
    responseSchema: miscToolsArgsSchemas[AITool.OptimizePrompt],
    prompt: `
This tool restructures a user's prompt into clear, step-by-step bulleted instructions.\n
You have access to the full spreadsheet context, including all sheets, tables, data locations, and existing content. Use this information to make the instructions specific.\n

REQUIRED OUTPUT FORMAT - a bulleted list with these sections:\n

- Task: [Detailed description of what analysis/calculation to perform, specifying exactly what data to analyze from which table/sheet. Be specific about what aspects of the data to examine.]\n
- Create: [Specify what output format to generate - code for metrics summaries, charts, tables, etc. If the user doesn't clearly define the output format, make a recommendation like "metrics summaries and relevant charts" based on the task.]\n
- [Any other relevant details like placement location, specific requirements, or constraints]\n

Rules for creating the output:\n
1. Always start with "- Task:" describing WHAT to analyze and WHERE the data is (use actual table/sheet names from context)\n
2. Always include "- Create:" describing the output format (metrics, charts, tables, code, etc.)\n
3. Be specific about the analysis details - don't just say "analyze data", say WHAT aspects to analyze\n
4. If the user doesn't specify output format, recommend appropriate formats (metrics, charts, summaries)\n
5. Add any other relevant bullet points for placement, constraints, or special requirements\n
6. Use actual table names and sheet names from the context when available\n
7. Default placement to "an open location right of existing data" if not specified\n
8. IMPORTANT: Use plain text only - NO markdown formatting like **bold**, *italics*, or any other formatting. Just use dashes and plain text.\n

Example transformations:\n

Original: "graph my sales"\n
Context: Sales_Data table exists with columns: date, revenue, region\n
Optimized:\n
- Task: Analyze sales trends over time using the Sales_Data table, examining revenue patterns across different dates and regions\n
- Create: Generate a line chart showing revenue trends, with additional summary metrics for total and average sales\n
- Place results in an open location right of existing data\n

Original: "analyze customer data"\n
Context: Customers table with columns: age, purchase_count, total_spent\n
Optimized:\n
- Task: Analyze customer demographics and purchase behavior using the Customers table, examining relationships between age, purchase frequency, and spending patterns\n
- Create: Generate summary metrics (average age, total purchases, spending distribution) and create charts showing customer segmentation and purchase trends\n
- Place results in an open location right of existing data\n

Original: "calculate totals for revenue"\n
Context: Revenue column in Sheet1\n
Optimized:\n
- Task: Calculate sum totals for the Revenue column in Sheet1\n
- Create: Display the total as a single cell value with a label\n
- Place the result directly below the Revenue column\n

Be specific, detailed, and actionable in every bullet point.\n`,
  },
} as const;
