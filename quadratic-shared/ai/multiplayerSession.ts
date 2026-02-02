import { z } from 'zod';
import type { AIModelKey, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';

// ============================================================================
// Agent Personas - Preset agent roles with specialized focus areas
// ============================================================================

export const AIAgentPersonaSchema = z.enum([
  'DataAnalyst',
  'VisualizationExpert',
  'CodeOptimizer',
  'DataCleaner',
  'FormulaExpert',
  'GeneralAssistant',
  'Custom',
]);
export type AIAgentPersona = z.infer<typeof AIAgentPersonaSchema>;

export const AI_AGENT_PERSONA_CONFIG: Record<
  AIAgentPersona,
  {
    displayName: string;
    description: string;
    systemPromptAddition: string;
    defaultColor: string;
  }
> = {
  DataAnalyst: {
    displayName: 'Data Analyst',
    description: 'Analyzes data patterns, statistics, and identifies insights',
    systemPromptAddition: `You are a Data Analyst agent in a collaborative AI session. You work alongside other AI agents.

Your focus areas:
- Analyzing data patterns and statistics
- Identifying trends, outliers, and anomalies
- Creating summary statistics and aggregations
- Providing data-driven insights and recommendations

Collaboration guidelines:
- Share your findings in chat before making changes
- Build on other agents' work when relevant
- Yield your turn when you've completed a logical unit of work
- If another agent's area overlaps with yours, coordinate via chat`,
    defaultColor: '#3B82F6', // blue
  },
  VisualizationExpert: {
    displayName: 'Visualization Expert',
    description: 'Creates charts, graphs, and visual representations of data',
    systemPromptAddition: `You are a Visualization Expert agent in a collaborative AI session. You work alongside other AI agents.

Your focus areas:
- Creating clear and informative charts and graphs
- Choosing appropriate visualization types for different data
- Designing visually appealing data presentations
- Adding context and annotations to visualizations

Collaboration guidelines:
- Wait for data to be prepared before creating visualizations
- Communicate what data you need from other agents
- Share your visualization plans before implementing
- Yield your turn when you've completed a chart or set of related charts`,
    defaultColor: '#8B5CF6', // purple
  },
  CodeOptimizer: {
    displayName: 'Code Optimizer',
    description: 'Improves code performance, readability, and best practices',
    systemPromptAddition: `You are a Code Optimizer agent in a collaborative AI session. You work alongside other AI agents.

Your focus areas:
- Reviewing and improving existing code
- Optimizing performance and efficiency
- Ensuring code follows best practices
- Refactoring for better readability and maintainability

Collaboration guidelines:
- Review code written by other agents constructively
- Suggest improvements rather than rewriting everything
- Explain your optimization rationale in chat
- Yield your turn after reviewing or optimizing a code cell`,
    defaultColor: '#10B981', // green
  },
  DataCleaner: {
    displayName: 'Data Cleaner',
    description: 'Cleans, transforms, and prepares data for analysis',
    systemPromptAddition: `You are a Data Cleaner agent in a collaborative AI session. You work alongside other AI agents.

Your focus areas:
- Identifying and handling missing values
- Detecting and correcting data inconsistencies
- Standardizing formats and data types
- Removing duplicates and invalid entries

Collaboration guidelines:
- Document your cleaning steps in chat
- Ask other agents about data requirements before cleaning
- Share summary of changes made to the data
- Yield your turn after completing a cleaning task`,
    defaultColor: '#F59E0B', // amber
  },
  FormulaExpert: {
    displayName: 'Formula Expert',
    description: 'Creates complex formulas and spreadsheet calculations',
    systemPromptAddition: `You are a Formula Expert agent in a collaborative AI session. You work alongside other AI agents.

Your focus areas:
- Creating complex spreadsheet formulas
- Building calculation chains and dependencies
- Optimizing formula performance
- Explaining formula logic to other agents

Collaboration guidelines:
- Explain complex formulas in chat for others to understand
- Coordinate with other agents on cell references
- Avoid overwriting cells that other agents are using
- Yield your turn after completing a formula or related set of formulas`,
    defaultColor: '#EF4444', // red
  },
  GeneralAssistant: {
    displayName: 'General Assistant',
    description: 'Flexible agent that can help with various tasks',
    systemPromptAddition: `You are a General Assistant agent in a collaborative AI session. You work alongside other AI agents.

Your focus areas:
- Supporting other agents with various tasks
- Filling gaps where specialized agents aren't available
- Coordinating between different agents' work
- Handling miscellaneous requests

Collaboration guidelines:
- Defer to specialized agents for their areas of expertise
- Help coordinate and integrate work from different agents
- Ask clarifying questions when unsure about scope
- Yield your turn when you've completed a task or need input`,
    defaultColor: '#6B7280', // gray
  },
  Custom: {
    displayName: 'Custom Agent',
    description: 'Agent with custom instructions defined by the user',
    systemPromptAddition: '', // Will be provided by user
    defaultColor: '#EC4899', // pink
  },
};

// ============================================================================
// Agent Definition - How an agent is configured
// ============================================================================

export const AIAgentDefinitionSchema = z.object({
  name: z.string().min(1).max(50),
  persona: AIAgentPersonaSchema,
  customInstructions: z.string().optional(),
  modelKey: z.string().optional(), // If not provided, uses session default
});
export type AIAgentDefinition = z.infer<typeof AIAgentDefinitionSchema>;

// ============================================================================
// Agent - Runtime representation of an agent in a session
// ============================================================================

export const AIAgentStatusSchema = z.enum([
  'idle', // Waiting for turn
  'thinking', // Processing/generating response
  'acting', // Executing tool calls
  'yielded', // Explicitly yielded turn
  'error', // Encountered an error
]);
export type AIAgentStatus = z.infer<typeof AIAgentStatusSchema>;

export const AIAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  persona: AIAgentPersonaSchema,
  customInstructions: z.string().optional(),
  modelKey: z.string(),
  color: z.string(),
  status: AIAgentStatusSchema,
  // Multiplayer presence info
  sessionId: z.string().uuid(), // For multiplayer presence
  cursorPosition: z
    .object({
      sheetId: z.string(),
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  selection: z.string().optional(), // Serialized selection
  // Stats
  turnsCompleted: z.number(),
  totalTokensUsed: z.number(),
  lastActiveAt: z.number().optional(),
});
export type AIAgent = z.infer<typeof AIAgentSchema>;

// ============================================================================
// Session Configuration
// ============================================================================

export const AIMultiplayerSessionConfigSchema = z.object({
  maxTurnsPerAgent: z.number().min(1).max(100).default(20),
  maxTotalTurns: z.number().min(1).max(500).default(100),
  turnTimeoutMs: z.number().min(10000).max(300000).default(60000), // 10s - 5min
  autoPauseOnError: z.boolean().default(true),
  defaultModelKey: z.string().optional(),
});
export type AIMultiplayerSessionConfig = z.infer<typeof AIMultiplayerSessionConfigSchema>;

// ============================================================================
// Session Status
// ============================================================================

export const AIMultiplayerSessionStatusSchema = z.enum([
  'initializing', // Setting up agents
  'running', // Actively processing turns
  'paused', // User paused or waiting for input
  'completed', // All goals achieved or max turns reached
  'error', // Session-level error
  'ended', // User ended session
]);
export type AIMultiplayerSessionStatus = z.infer<typeof AIMultiplayerSessionStatusSchema>;

// ============================================================================
// Session - The main multiplayer AI session
// ============================================================================

export const AIMultiplayerSessionSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
  userId: z.string().uuid(),
  agents: z.array(AIAgentSchema),
  currentTurnAgentId: z.string().uuid().nullable(),
  status: AIMultiplayerSessionStatusSchema,
  config: AIMultiplayerSessionConfigSchema,
  // Turn tracking
  turnNumber: z.number(),
  turnHistory: z.array(
    z.object({
      turnNumber: z.number(),
      agentId: z.string().uuid(),
      agentName: z.string(),
      startedAt: z.number(),
      endedAt: z.number().optional(),
      tokensUsed: z.number().optional(),
      toolCallsCount: z.number().optional(),
    })
  ),
  // Timestamps
  createdAt: z.number(),
  updatedAt: z.number(),
  endedAt: z.number().optional(),
  // User influence queue - messages from user that agents should consider
  pendingUserInfluence: z.array(
    z.object({
      id: z.string().uuid(),
      message: z.string(),
      createdAt: z.number(),
      acknowledged: z.boolean(),
    })
  ),
});
export type AIMultiplayerSession = z.infer<typeof AIMultiplayerSessionSchema>;

// ============================================================================
// Agent Message - Chat message attributed to a specific agent
// ============================================================================

export const AIAgentMessageSchema = z.object({
  agentId: z.string().uuid(),
  agentName: z.string(),
  agentColor: z.string(),
  turnNumber: z.number(),
  isUserInfluence: z.boolean().default(false),
});
export type AIAgentMessage = z.infer<typeof AIAgentMessageSchema>;

// Extended chat message with agent attribution
export type AIMultiplayerChatMessage = ChatMessage & {
  multiplayerContext?: AIAgentMessage;
};

// ============================================================================
// API Request/Response Types
// ============================================================================

export const CreateAIMultiplayerSessionRequestSchema = z.object({
  fileId: z.string().uuid(),
  agents: z.array(AIAgentDefinitionSchema).min(1).max(5),
  config: AIMultiplayerSessionConfigSchema.optional(),
  initialPrompt: z.string().optional(), // Optional starting prompt/goal
});
export type CreateAIMultiplayerSessionRequest = z.infer<typeof CreateAIMultiplayerSessionRequestSchema>;

export const CreateAIMultiplayerSessionResponseSchema = z.object({
  session: AIMultiplayerSessionSchema,
});
export type CreateAIMultiplayerSessionResponse = z.infer<typeof CreateAIMultiplayerSessionResponseSchema>;

export const ExecuteTurnRequestSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid().optional(), // If not provided, uses next agent in rotation
});
export type ExecuteTurnRequest = z.infer<typeof ExecuteTurnRequestSchema>;

export const UserInfluenceRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1),
});
export type UserInfluenceRequest = z.infer<typeof UserInfluenceRequestSchema>;

export const EndSessionRequestSchema = z.object({
  sessionId: z.string().uuid(),
});
export type EndSessionRequest = z.infer<typeof EndSessionRequestSchema>;

// ============================================================================
// Streaming Events - For real-time updates during turns
// ============================================================================

export const AIMultiplayerEventTypeSchema = z.enum([
  'session_started',
  'turn_started',
  'agent_thinking',
  'agent_message', // Text message to chat
  'agent_tool_call', // Tool being executed
  'agent_cursor_move', // Cursor position update
  'turn_ended',
  'user_influence_received',
  'session_paused',
  'session_resumed',
  'session_ended',
  'error',
]);
export type AIMultiplayerEventType = z.infer<typeof AIMultiplayerEventTypeSchema>;

export const AIMultiplayerEventSchema = z.object({
  type: AIMultiplayerEventTypeSchema,
  sessionId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  turnNumber: z.number().optional(),
  data: z.any().optional(),
  timestamp: z.number(),
});
export type AIMultiplayerEvent = z.infer<typeof AIMultiplayerEventSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

export function getAgentSystemPrompt(agent: AIAgent): string {
  const personaConfig = AI_AGENT_PERSONA_CONFIG[agent.persona];
  let prompt = personaConfig.systemPromptAddition;

  if (agent.customInstructions) {
    prompt += `\n\nAdditional instructions from the user:\n${agent.customInstructions}`;
  }

  return prompt;
}

export function createAgentFromDefinition(
  definition: AIAgentDefinition,
  defaultModelKey: AIModelKey,
  existingAgents: AIAgent[]
): AIAgent {
  const personaConfig = AI_AGENT_PERSONA_CONFIG[definition.persona];

  // Ensure unique colors - if default color is taken, generate a variant
  let color = personaConfig.defaultColor;
  const usedColors = new Set(existingAgents.map((a) => a.color));
  if (usedColors.has(color)) {
    // Simple color rotation - adjust hue
    const colorVariants = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];
    color = colorVariants.find((c) => !usedColors.has(c)) ?? color;
  }

  return {
    id: crypto.randomUUID(),
    name: definition.name,
    persona: definition.persona,
    customInstructions: definition.customInstructions,
    modelKey: definition.modelKey ?? defaultModelKey,
    color,
    status: 'idle',
    sessionId: crypto.randomUUID(),
    cursorPosition: undefined,
    selection: undefined,
    turnsCompleted: 0,
    totalTokensUsed: 0,
    lastActiveAt: undefined,
  };
}

export function getNextAgentId(session: AIMultiplayerSession): string {
  const { agents, currentTurnAgentId } = session;

  if (!currentTurnAgentId) {
    // First turn - start with first agent
    return agents[0].id;
  }

  // Round-robin through agents
  const currentIndex = agents.findIndex((a) => a.id === currentTurnAgentId);
  const nextIndex = (currentIndex + 1) % agents.length;
  return agents[nextIndex].id;
}
