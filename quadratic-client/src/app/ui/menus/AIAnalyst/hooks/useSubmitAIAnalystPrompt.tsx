import { useAIModel } from '@/app/ai/hooks/useAIModel';
import { useGetUserPromptSuggestions } from '@/app/ai/hooks/useGetUserPromptSuggestions';
import { useImportFilesToGrid, type ImportFile } from '@/app/ai/hooks/useImportFilesToGrid';
import { aiSession } from '@/app/ai/session/AISession';
import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateTeamUuidAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useAnalystPDFImport } from '@/app/ui/menus/AIAnalyst/hooks/useAnalystPDFImport';
import { useAnalystWebSearch } from '@/app/ui/menus/AIAnalyst/hooks/useAnalystWebSearch';
import type { Content, Context } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';

export type SubmitAIAnalystPromptArgs = {
  messageSource: string;
  content: Content;
  context: Context;
  messageIndex: number;
  importFiles: ImportFile[];
};

export function useSubmitAIAnalystPrompt() {
  const aiModel = useAIModel();
  const { importPDF } = useAnalystPDFImport();
  const { search } = useAnalystWebSearch();
  const { getUserPromptSuggestions } = useGetUserPromptSuggestions();
  const { importFilesToGrid } = useImportFilesToGrid();
  const { connections } = useConnectionsFetcher();

  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
  const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);

  const submitPrompt = useCallback(
    async ({ messageSource, content, context, messageIndex, importFiles }: SubmitAIAnalystPromptArgs) => {
      if (!fileUuid || !teamUuid) {
        console.error('[useSubmitAIAnalystPrompt] Missing fileUuid or teamUuid');
        return;
      }

      await aiSession.execute(
        {
          messageSource,
          content,
          context,
          messageIndex,
          importFiles,
          connections,
        },
        {
          modelKey: aiModel.modelKey,
          fileUuid,
          teamUuid,
          importFilesToGrid,
          importPDF,
          search,
          getUserPromptSuggestions,
        }
      );
    },
    [aiModel.modelKey, connections, fileUuid, teamUuid, importFilesToGrid, importPDF, search, getUserPromptSuggestions]
  );

  return { submitPrompt };
}
