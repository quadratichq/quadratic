import type { Response } from 'express';
import {
  AIMultiplayerSessionConfigSchema,
  createAgentFromDefinition,
  type AIAgent,
  type AIMultiplayerSession,
  type CreateAIMultiplayerSessionRequest,
  type CreateAIMultiplayerSessionResponse,
} from 'quadratic-shared/ai/multiplayerSession';
import { DEFAULT_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { z } from 'zod';
import { aiMultiplayerSessions } from '../../ai/multiplayer/sessionStore';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { v4 as uuidv4 } from 'uuid';

export default [validateAccessToken, userMiddleware, handler];

const AIAgentDefinitionSchema = z.object({
  name: z.string().min(1).max(50),
  persona: z.enum([
    'DataAnalyst',
    'VisualizationExpert',
    'CodeOptimizer',
    'DataCleaner',
    'FormulaExpert',
    'GeneralAssistant',
    'Custom',
  ]),
  customInstructions: z.string().optional(),
  modelKey: z.string().optional(),
});

const schema = z.object({
  body: z.object({
    fileId: z.string().uuid(),
    agents: z.array(AIAgentDefinitionSchema).min(1).max(5),
    config: AIMultiplayerSessionConfigSchema.optional(),
    initialPrompt: z.string().optional(),
  }),
});

async function handler(req: RequestWithUser, res: Response<CreateAIMultiplayerSessionResponse>) {
  const {
    user: { id: userId },
  } = req;

  const { body } = parseRequest(req, schema);
  const { fileId, agents: agentDefinitions, config, initialPrompt } = body as CreateAIMultiplayerSessionRequest;

  // Verify user has access to the file
  const { file } = await getFile({ uuid: fileId, userId });
  if (!file) {
    throw new ApiError(404, 'File not found');
  }

  // Get the default model key for agents
  const defaultModelKey: AIModelKey = DEFAULT_MODEL;

  // Create agents from definitions
  const agents: AIAgent[] = [];
  for (const definition of agentDefinitions) {
    const agent = createAgentFromDefinition(definition, defaultModelKey, agents);
    agents.push(agent);
  }

  // Create the session
  const session: AIMultiplayerSession = {
    id: uuidv4(),
    fileId,
    userId,
    agents,
    currentTurnAgentId: null,
    status: 'initializing',
    config: {
      maxTurnsPerAgent: config?.maxTurnsPerAgent ?? 20,
      maxTotalTurns: config?.maxTotalTurns ?? 100,
      turnTimeoutMs: config?.turnTimeoutMs ?? 60000,
      autoPauseOnError: config?.autoPauseOnError ?? true,
      defaultModelKey: config?.defaultModelKey ?? defaultModelKey,
    },
    turnNumber: 0,
    turnHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pendingUserInfluence: [],
  };

  // Store the session
  aiMultiplayerSessions.set(session.id, session);

  // If there's an initial prompt, add it as user influence
  if (initialPrompt) {
    session.pendingUserInfluence.push({
      id: uuidv4(),
      message: initialPrompt,
      createdAt: Date.now(),
      acknowledged: false,
    });
  }

  // Update session status to running
  session.status = 'running';
  session.updatedAt = Date.now();

  res.status(200).json({ session });
}
