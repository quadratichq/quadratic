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

IMPORTANT GUIDELINES:
- You should ONLY return the plan as plain text. Do not execute any actions, tools, or code.
- Each step should be SHORT but CLEAR and actionable
- ALWAYS specify what data range/cells will be referenced (e.g., "A1:C10", "Sheet1 column A", "current selection")
- ALWAYS specify where results will be output (e.g., "to cell D1", "new column E", "Sheet2", "as new chart")
- Use numbered steps (1., 2., 3., etc.)
- Be specific about locations and ranges rather than vague references

STEP FORMAT EXAMPLE:
1. Read data from cells A1:B50 to analyze sales figures
2. Calculate average revenue and output result to cell D1
3. Create pivot table from range A1:B50 and place in cells F1:H20
4. Generate chart from pivot data and insert below the table

Each step should clearly answer:
- WHAT action to take
- WHERE to get the data (specific range/location)  
- WHERE to put the result (specific cell/location)

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
            modelKey: aiModel.modelKey,
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