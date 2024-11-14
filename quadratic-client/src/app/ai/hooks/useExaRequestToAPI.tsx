import { authClient } from '@/auth/auth';
import { AI } from '@/shared/constants/routes';
import { ExaSearchRequestBody } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';

type HandleExaRequestToAPIProps = {
  signal: AbortSignal;
} & ExaSearchRequestBody;

export const useExaRequestToAPI = () => {
  const handleExaRequestToAPI = useCallback(
    async ({
      signal,
      query,
      ...exaSettings
    }: HandleExaRequestToAPIProps): Promise<{
      error?: boolean;
      content: any;
    }> => {
      try {
        const token = await authClient.getTokenOrRedirect();
        const endpoint = AI.EXA;
        const response = await fetch(endpoint, {
          method: 'POST',
          signal,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, ...exaSettings }),
        });
        const data = await response.json();
        return { content: data };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { content: 'Aborted by user' };
        } else {
          console.error('Error in Exa request to API:', err);
          return { error: true, content: 'An error occurred requesting from Exa API' };
        }
      }
    },
    []
  );

  return { handleExaRequestToAPI };
};
