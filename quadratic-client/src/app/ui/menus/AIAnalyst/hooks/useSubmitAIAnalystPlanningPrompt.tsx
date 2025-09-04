import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import { useCodeErrorMessages } from '@/app/ai/hooks/useCodeErrorMessages';
import { useCurrentDateTimeContextMessages } from '@/app/ai/hooks/useCurrentDateTimeContextMessages';
import { useFilesContextMessages } from '@/app/ai/hooks/useFilesContextMessages';
import { useSqlContextMessages } from '@/app/ai/hooks/useSqlContextMessages';
import { useSummaryContextMessages } from '@/app/ai/hooks/useSummaryContextMessages';
import { useVisibleContextMessages } from '@/app/ai/hooks/useVisibleContextMessages';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatAtom,
  aiAnalystLoadingAtom,
  aiAnalystPlanningModeAtom,
  aiAnalystPlanningModeLoadingAtom,
} from '@/app/atoms/aiAnalystAtom';
import { createTextContent, getPromptAndInternalMessages } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage, Content, Context } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';

export type SubmitAIAnalystPlanningPromptArgs = {
  messageSource: string;
  content: Content;
  context: Context;
  messageIndex: number;
};

const PLANNING_SYSTEM_PROMPT = `You are an advanced AI planning system. Create a comprehensive, step-by-step execution plan for the user's request.

CRITICAL: YOU ARE ONLY A PLANNER - YOU CANNOT EXECUTE ANYTHING
- You can see available tools and their descriptions to understand what's possible
- You can see every range of data available to the user 
- Your role is ONLY to create a detailed plan that another AI will execute later
- Return ONLY the plan as plain text - no tool calls, no code execution, no actions

PLANNING GUIDELINES:
- Each step should be SHORT but CLEAR and actionable
- ALWAYS specify what data range/cells will be referenced (e.g., "A1:C10", "Sheet1 column A")
- ALWAYS specify where results will be output (e.g., "to cell D1", "new column E", "Sheet2")
- Use numbered steps (1., 2., 3., etc.)
- Only state the steps, do not do preambles, postambles, or any other text other than the steps you are proposing

STEP FORMAT EXAMPLE:
1. Read data from cells A1:B50 to understand the data I'm working with 
2. Filter the data to just the November data you asked for
3. Create a chart using the filtered data 
4. Output the chart in cell D1, adjacent to the data

Each step should clearly answer:
- WHAT actions to take 
- WHERE to get the data  
- WHERE to put the result 

Remember: You are ONLY creating the plan. Another AI agent will execute these steps using the actual tools.

User's request: `;

export function useSubmitAIAnalystPlanningPrompt() {
  const aiModel = useAIModel();
  const { handleAIRequestToAPI } = useAIRequestToAPI();
  const { getSqlContext } = useSqlContextMessages();
  const { getFilesContext } = useFilesContextMessages();
  const { getCurrentDateTimeContext } = useCurrentDateTimeContextMessages();
  const { getVisibleContext } = useVisibleContextMessages();
  const { getSummaryContext } = useSummaryContextMessages();
  const { getCodeErrorContext } = useCodeErrorMessages();

  const submitPlanningPrompt = useRecoilCallback(
    ({ set, snapshot }) =>
      async ({ messageSource, content, context, messageIndex }: SubmitAIAnalystPlanningPromptArgs) => {
        const previousLoading = await snapshot.getPromise(aiAnalystLoadingAtom);
        if (previousLoading) return;

        // Extract text content from the content array
        const textContent = content
          .filter((c) => 'type' in c && c.type === 'text')
          .map((c) => ('text' in c ? c.text : ''))
          .join(' ')
          .trim();

        if (!textContent) return;

        // Set planning mode loading
        set(aiAnalystPlanningModeLoadingAtom, true);

        // Store the original query
        set(aiAnalystPlanningModeAtom, (prev) => ({
          ...prev,
          originalQuery: textContent,
          loading: true,
        }));

        const abortController = new AbortController();
        set(aiAnalystAbortControllerAtom, abortController);

        let chatId = '';
        set(aiAnalystCurrentChatAtom, (prev) => {
          chatId = prev.id ? prev.id : v4();
          return {
            ...prev,
            id: chatId,
            lastUpdated: Date.now(),
          };
        });

        try {
          // Get all context information like the regular AI analyst
          const [sqlContext, filesContext, visibleContext, summaryContext, codeErrorContext] = await Promise.all([
            getSqlContext(),
            getFilesContext({ chatMessages: [] }), // Empty chat messages for initial planning
            getVisibleContext(),
            getSummaryContext(),
            getCodeErrorContext(),
          ]);

          // Create the user prompt with the planning instruction
          const userPromptMessage: ChatMessage = {
            role: 'user' as const,
            content: [createTextContent(PLANNING_SYSTEM_PROMPT + textContent)],
            contextType: 'userPrompt' as const,
            context,
          };

          // Build messages with full context like the regular AI analyst
          const messagesWithContext: ChatMessage[] = [
            ...sqlContext,
            ...filesContext,
            ...getCurrentDateTimeContext(),
            ...visibleContext,
            ...summaryContext,
            ...codeErrorContext,
            ...getPromptAndInternalMessages([userPromptMessage]),
          ];

          const response = await handleAIRequestToAPI({
            chatId,
            source: 'AIAnalyst',
            messageSource,
            modelKey: 'openai:o3-2025-04-16', // Always use o3 for planning, regardless of selected model
            messages: messagesWithContext,
            useStream: false, // Don't stream for planning
            toolName: undefined,
            useToolsPrompt: true, // Use tools context for planning like regular AI
            language: undefined,
            useQuadraticContext: true, // Use Quadratic context for planning like regular AI
            setMessages: () => {}, // Don't update messages during planning
            signal: abortController.signal,
            onExceededBillingLimit: () => {},
          });

          if (response.error) {
            throw new Error('Failed to generate plan');
          }

          // Extract the plan from the response
          const planText = response.content
            .filter((c) => 'type' in c && c.type === 'text')
            .map((c) => ('text' in c ? c.text : ''))
            .join(' ')
            .trim();

          if (planText) {
            set(aiAnalystPlanningModeAtom, (prev) => ({
              ...prev,
              currentPlan: planText,
              planSteps: [], // Will be populated by useEffect in AIPlanningInterface
              planEdited: false,
              loading: false,
            }));
          } else {
            throw new Error('No plan generated');
          }
        } catch (error) {
          console.error('Planning error:', error);
          set(aiAnalystPlanningModeAtom, (prev) => ({
            ...prev,
            currentPlan: 'Error generating plan. Please try again.',
            planSteps: [],
            planEdited: false,
            loading: false,
          }));
        } finally {
          set(aiAnalystPlanningModeLoadingAtom, false);
          set(aiAnalystAbortControllerAtom, undefined);
        }
      },
    [
      aiModel.modelKey,
      handleAIRequestToAPI,
      getSqlContext,
      getFilesContext,
      getCurrentDateTimeContext,
      getVisibleContext,
      getSummaryContext,
      getCodeErrorContext,
    ]
  );

  return { submitPlanningPrompt };
}
