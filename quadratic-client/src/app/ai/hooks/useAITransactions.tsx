import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

export const useAITransactions = () => {
  const getAITransactions = useCallback(async (): Promise<ChatMessage[]> => {
    const transactions = await quadraticCore.getAITransactions();
    console.log(transactions);
    return [];
  }, []);

  return {
    getAITransactions,
  };
};
