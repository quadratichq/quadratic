import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useAIRequestToAPI } from '@/app/ai/hooks/useAIRequestToAPI';
import {
  aiAnalystAbortControllerAtom,
  aiAnalystCurrentChatAtom,
  aiAnalystLoadingAtom,
  aiAnalystPlanningModeAtom,
  aiAnalystPlanningModeLoadingAtom,
} from '@/app/atoms/aiAnalystAtom';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { Content, Context } from 'quadratic-shared/typesAndSchemasAI';
import { useRecoilCallback } from 'recoil';
import { v4 } from 'uuid';

export type SubmitAIAnalystPlanningPromptArgs = {
  messageSource: string;
  content: Content;
  context: Context;
  messageIndex: number;
};

const PLANNING_SYSTEM_PROMPT = `You are o3, an advanced AI planning system. Your task is to create a comprehensive, step-by-step plan for the user's request. 

IMPORTANT: You should ONLY return the plan as plain text. Do not execute any actions, tools, or code. Just provide a detailed plan that another AI can follow to complete the task.

The plan should include:
1. A clear breakdown of the main objectives
2. Specific steps to accomplish each objective
3. Any dependencies or prerequisites
4. Expected outcomes or deliverables
5. Potential challenges and how to address them

Format the plan in a structured, easy-to-follow manner using numbered lists, bullet points, and clear headings as appropriate.

User's request: `;

export function useSubmitAIAnalystPlanningPrompt() {
  const aiModel = useAIModel();
  const { handleAIRequestToAPI } = useAIRequestToAPI();

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
          // Create the planning prompt
          const planningMessages = [
            {
              role: 'user' as const,
              content: [createTextContent(PLANNING_SYSTEM_PROMPT + textContent)],
              contextType: 'userPrompt' as const,
            },
          ];

          const response = await handleAIRequestToAPI({
            chatId,
            source: 'AIAnalyst',
            messageSource,
            modelKey: aiModel.modelKey,
            messages: planningMessages,
            useStream: false, // Don't stream for planning
            toolName: undefined,
            useToolsPrompt: false, // Don't use tools for planning
            language: undefined,
            useQuadraticContext: false, // Don't need context for planning
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
    [aiModel.modelKey, handleAIRequestToAPI]
  );

  return { submitPlanningPrompt };
}