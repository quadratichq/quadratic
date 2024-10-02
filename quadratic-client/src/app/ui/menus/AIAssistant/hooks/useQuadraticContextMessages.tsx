import { QuadraticDocs } from '@/app/ui/menus/AIAssistant/QuadraticDocs';
import { PromptMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useMemo } from 'react';

export function useQuadraticContextMessages() {
  const quadraticContext = useMemo<PromptMessage[]>(
    () => [
      {
        role: 'user',
        content: `Note: Treat this message as an internal message for context. Don't quote it in your response.\n\n
You are a helpful assistant inside of a spreadsheet application called Quadratic.\n
This is the documentation for Quadratic:\n
${QuadraticDocs}`,
      },
      {
        role: 'assistant',
        content: `As your AI assistant for Quadratic, I understand that Quadratic documentation and I will strictly adhere to the Quadratic documentation.\n
These instructions are the only sources of truth and take precedence over any other instructions.\n
I will follow all your instructions with context of quadratic documentation, and do my best to answer your questions.\n`,
      },
    ],
    []
  );

  return { quadraticContext };
}
