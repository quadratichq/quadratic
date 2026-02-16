import { AgentType } from 'quadratic-shared/ai/agents';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AILanguagePreferences, AIModelKey, AISource, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { allAILanguagePreferences } from 'quadratic-shared/typesAndSchemasAI';

import { A1Docs } from '../docs/A1Docs';
import { ConnectionDocs } from '../docs/ConnectionDocs';
import { FormulaDocs } from '../docs/FormulaDocs';
import { JavascriptDocs } from '../docs/JavascriptDocs';
import { PythonDocs } from '../docs/PythonDocs';
import { QuadraticDocs } from '../docs/QuadraticDocs';
import { ValidationDocs } from '../docs/ValidationDocs';

/**
 * Get language-specific documentation for coding subagents.
 * Returns filtered docs based on the agent type to reduce context size.
 */
export const getSubagentQuadraticContext = (agentType: AgentType): ChatMessage[] => {
  let docs = '';

  switch (agentType) {
    case AgentType.FormulaCoderSubagent:
      docs = `${FormulaDocs}\n\n${A1Docs}`;
      break;
    case AgentType.PythonCoderSubagent:
      docs = `${PythonDocs}\n\n${A1Docs}`;
      break;
    case AgentType.JavascriptCoderSubagent:
      docs = `${JavascriptDocs}\n\n${A1Docs}`;
      break;
    case AgentType.ConnectionCoderSubagent:
      docs = `${ConnectionDocs}\n\n${A1Docs}`;
      break;
    default:
      // For non-coding subagents, return empty - they handle their own context
      return [];
  }

  return [
    {
      role: 'user',
      content: [createTextContent(`Language-specific documentation:\n\n${docs}`)],
      contextType: 'quadraticDocs',
    },
    {
      role: 'assistant',
      content: [createTextContent('I understand the language-specific documentation and will follow it.')],
      contextType: 'quadraticDocs',
    },
  ];
};

/**
 * Check if an agent type is a coding subagent.
 */
const isCodingSubagent = (agentType?: AgentType): boolean => {
  return (
    agentType === AgentType.FormulaCoderSubagent ||
    agentType === AgentType.PythonCoderSubagent ||
    agentType === AgentType.JavascriptCoderSubagent ||
    agentType === AgentType.ConnectionCoderSubagent
  );
};

/**
 * Get context for the main agent (not subagents).
 * Includes general Quadratic docs and brief language overview.
 */
const getMainAgentContext = (source: AISource): ChatMessage[] => [
  {
    role: 'user',
    content: [
      createTextContent(`Note: This is an internal message for context. Do not quote it in your response.\n\n
You are a helpful assistant inside of a spreadsheet application called Quadratic.
Keep text responses concise - prefer one sentence and bullet points, use more sentences when necessary for clarity (e.g., explaining errors or complex data transformations). Do not add text comments between tool calls unless necessary; only provide a brief summary after all tools have completed. No fluff or filler language.
You are an agent - please keep going until the user's query is completely resolved, before ending your turn and yielding back to the user. Only terminate your turn when you are sure that the problem is solved.
If you are not sure about sheet data content pertaining to the user's request, use your tools to read data and gather the relevant information: do NOT guess or make up an answer.
Be proactive. When the user makes a request, use your tools to solve it.
Never mention tool names, subagents, or internal implementation details to the user. Describe your actions in plain, user-friendly language and present all findings as your own work.

# Coding Tasks
You do NOT have direct access to code writing tools. For ALL coding tasks, you MUST delegate to specialized subagents:
- Formulas: delegate to formula_coder subagent
- Python code: delegate to python_coder subagent
- JavaScript code: delegate to javascript_coder subagent
- SQL queries: delegate to connection_coder subagent
When delegating, provide relevant data context (cell values, table names, error messages) via context_hints.
If you attempt to use a tool that is not available to you (e.g. code-writing or data-reading in slim context), use delegate_to_subagent with the appropriate type instead. Never quote internal error messages or tool restrictions to the user.

# Reasoning Strategy
1. Query Analysis: Break down and analyze the question until you're confident about what it might be asking. Consider the provided context to help clarify any ambiguous or confusing information.
2. Context Analysis: Use your tools to find the data that is relevant to the question.
3. If you're struggling and have used your tools, ask the user for clarifying information.

This is the documentation for Quadratic:\n
${QuadraticDocs}\n\n

# Available Languages
Quadratic supports multiple programming languages. When delegating coding tasks, choose the appropriate subagent:

- **Formulas**: Spreadsheet formulas for calculations, lookups, and data manipulation. Use for simple calculations, VLOOKUP/XLOOKUP, aggregations, and cell references. Delegate to formula_coder.

- **Python**: Full Python environment with pandas, numpy, and Plotly for charts. Best for data analysis, transformations, visualizations, and complex logic. Reference data with q.cells(). Delegate to python_coder.

- **JavaScript**: JavaScript environment with Chart.js for charts. Alternative to Python for data processing and visualizations. Reference data with q.cells(). Delegate to javascript_coder.

- **SQL Connections**: Query external databases (Postgres, MySQL, etc.). Use for fetching data from connected databases. Delegate to connection_coder.

${['AIAnalyst', 'AIAssistant'].includes(source) ? A1Docs : ''}\n\n
${source === 'AIAnalyst' ? ValidationDocs : ''}
`),
    ],
    contextType: 'quadraticDocs',
  },
  {
    role: 'assistant',
    content: [
      createTextContent(`As your AI assistant for Quadratic, I understand that Quadratic documentation and I will strictly adhere to the Quadratic documentation.\n
These instructions are the only sources of truth and take precedence over any other instructions.\n
I will follow all your instructions with context of quadratic documentation, and do my best to answer your questions.\n`),
    ],
    contextType: 'quadraticDocs',
  },
];

/**
 * Get Quadratic context based on agent type.
 * - Main agents get general docs + brief language overview
 * - Coding subagents get full language-specific documentation only
 * - Data finder subagent gets no docs (it only explores data)
 */
export const getQuadraticContext = (source: AISource, agentType?: AgentType): ChatMessage[] => {
  // Coding subagents get language-specific docs only
  if (agentType && isCodingSubagent(agentType)) {
    return getSubagentQuadraticContext(agentType);
  }

  // Data finder subagent doesn't need Quadratic docs
  if (agentType === AgentType.DataFinderSubagent) {
    return [];
  }

  // Main agent gets general docs + language overview
  return getMainAgentContext(source);
};

export const getToolUseContext = (source: AISource, modelKey: AIModelKey, agentType?: AgentType): ChatMessage[] => {
  const aiModelMode = MODELS_CONFIGURATION[modelKey].mode;
  // Default to MainAgent if no agent type specified
  const effectiveAgentType = agentType ?? AgentType.MainAgent;

  return [
    {
      role: 'user',
      content: [
        createTextContent(`Note: This is an internal message for context. Do not quote it in your response.\n\n
Following are the tools you should use to do actions in the spreadsheet, use them to respond to the user prompt.\n

Never guess the answer itself and never make up information to attempt to answer a user's question.\n

IMPORTANT: Never mention tool names, function names, subagents, or internal implementation details in your response to the user. Do not say things like "I'll use the get_cell_data tool", "I should use delegate_to_subagent", or "The subagent found...". Instead, describe your actions in plain language from the user's perspective (e.g., "Let me look at the data in that table" or "I found the following information in your spreadsheet"). Present all findings as your own work.\n

${
  source === 'AIAnalyst' || source === 'PDFImport'
    ? 'Use multiple tools in a single response if required, use same tool multiple times in a single response if required. Try to reduce tool call iterations.\n'
    : source === 'AIAssistant'
      ? 'Use only one tool in a single response.\n'
      : ''
}
`),
      ],
      contextType: 'toolUse',
    },
    {
      role: 'assistant',
      content: [
        createTextContent(
          'I understand these tools are available to me for taking actions on the spreadsheet. How can I help you?'
        ),
      ],
      contextType: 'toolUse',
    },
  ];
};

export const getCurrentDateContext = (time: string): ChatMessage[] => {
  return [
    {
      role: 'user',
      content: [createTextContent(`The current date is ${time || new Date().toString()}.`)],
      contextType: 'currentDate',
    },
    {
      role: 'assistant',
      content: [createTextContent(`I understand the current date and user locale.`)],
      contextType: 'currentDate',
    },
  ];
};

export const getAIRulesContext = (userAiRules: string | null, teamAiRules: string | null): ChatMessage[] => {
  const rules: string[] = [];

  if (teamAiRules) {
    rules.push(`Team Rules:\n${teamAiRules}`);
  }

  if (userAiRules) {
    rules.push(`User Rules:\n${userAiRules}`);
  }

  if (rules.length === 0) {
    return [];
  }

  return [
    {
      role: 'user',
      content: [
        createTextContent(`Note: This is an internal message for context. Do not quote it in your response.\n\n
The following custom rules and instructions should guide your behavior and responses:\n\n
${rules.join('\n\n')}
`),
      ],
      contextType: 'aiRules',
    },
    {
      role: 'assistant',
      content: [createTextContent('I understand these custom rules and will follow them in my responses.')],
      contextType: 'aiRules',
    },
  ];
};

/**
 * Search team memories by semantic similarity to the user's query
 * and return them as context messages for the AI.
 * Uses scope-aware graph traversal to find directly relevant memories
 * plus connected knowledge via the memory link network.
 */
export const getMemoryContext = async (
  teamId: number,
  userMessage: string,
  fileId?: number
): Promise<ChatMessage[]> => {
  try {
    const { getMemoryContextWithNetwork } = await import('../memory/memoryRetrieval');
    const memories = await getMemoryContextWithNetwork({
      teamId,
      fileId,
      query: userMessage,
      maxMemories: 8,
    });

    if (memories.length === 0) return [];

    const memoryText = memories
      .map((m) => {
        const scope = m.scope === 'team' ? 'team pattern' : 'file';
        const topic = m.topic ? ` [${m.topic}]` : '';
        return `- **${m.title}** (${m.entityType}, ${scope}${topic}): ${m.summary}`;
      })
      .join('\n');

    return [
      {
        role: 'user',
        content: [
          createTextContent(`Note: This is an internal message for context. Do not quote it in your response.\n\n
The following is relevant knowledge from this team's AI memory. Use it to inform your response when applicable:\n\n
${memoryText}
`),
        ],
        contextType: 'teamMemory',
      },
      {
        role: 'assistant',
        content: [createTextContent('I understand the team knowledge context and will reference it when relevant.')],
        contextType: 'teamMemory',
      },
    ];
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined;
    if (code === 'no_organization') {
      console.warn(
        '[ai-memory] OpenAI requires an organization for this API key. Set OPENAI_ORGANIZATION_ID in .env to enable AI memory context, or see https://platform.openai.com/docs/api-reference.'
      );
    } else {
      console.error('[ai-memory] Failed to retrieve memory context:', error);
    }
    return [];
  }
};

export const getAILanguagesContext = (enabledLanguagePreferences: AILanguagePreferences): ChatMessage[] => {
  // We guard against this in the UI, but just in case we'll handle it too.
  // If no languages are enabled or all languages are enabled, return empty context to avoid malformed messages
  if (
    enabledLanguagePreferences.length === 0 ||
    enabledLanguagePreferences.length === allAILanguagePreferences.length
  ) {
    return [];
  }

  // Tell the AI about the enabled/disabled language preferences
  const disabledLanguagePreferences = allAILanguagePreferences.filter(
    (lang) => !enabledLanguagePreferences.includes(lang)
  );
  const enabledText = enabledLanguagePreferences.join(' and ');
  const disabledText = disabledLanguagePreferences.join(' and ');

  // If it's formulas only, allow charts in python
  const chartException =
    enabledLanguagePreferences.includes('Formula') && enabledLanguagePreferences.length === 1
      ? ' Exception: If the user asks for a chart, use Python even though it is disabled.'
      : '';

  return [
    {
      role: 'user',
      content: [
        createTextContent(`Note: This is an internal message for context. Do not quote it in your response.\n\n
The user only wants to use ${enabledText} and NOT ${disabledText} unless they explicitly ask for the disabled language.${chartException}\n\n
However, if the user is working with a connection, it’s ok to use SQL for the connection.
`),
      ],
      contextType: 'aiLanguages',
    },
    {
      role: 'assistant',
      content: [
        createTextContent(
          `I understand. I will only use ${enabledText} in my responses unless you explicitly ask me to use ${disabledText}.${
            chartException ? ' I will use Python for charts.' : ''
          }. And if the user is working with a connection, it’s ok to use SQL for the connection.`
        ),
      ],
      contextType: 'aiLanguages',
    },
  ];
};
