import {
  aiResearcherAbortControllerAtom,
  aiResearcherLoadingAtom,
  aiResearcherQueryAtom,
  aiResearcherRefCellAtom,
} from '@/app/atoms/aiResearcherAtom';
import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { AIUserMessageForm, AIUserMessageFormWrapperProps } from '@/app/ui/components/AIUserMessageForm';
import { getAIResearcherCodeString } from '@/app/ui/menus/AIResearcher/helpers/getAIResearcherCodeString.helper';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import mixpanel from 'mixpanel-browser';
import { forwardRef } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil';

export const AIResearcherUserMessageForm = forwardRef<HTMLTextAreaElement, AIUserMessageFormWrapperProps>(
  (props: AIUserMessageFormWrapperProps, ref) => {
    const [loading, setLoading] = useRecoilState(aiResearcherLoadingAtom);
    const abortController = useRecoilValue(aiResearcherAbortControllerAtom);
    const initialPrompt = useRecoilValue(aiResearcherQueryAtom);

    const submitPrompt = useRecoilCallback(
      ({ snapshot, set }) =>
        async (prompt: string) => {
          set(aiResearcherQueryAtom, prompt);
          const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
          const refCell = await snapshot.getPromise(aiResearcherRefCellAtom);
          quadraticCore.setCodeCellValue({
            sheetId: codeCell.sheetId,
            x: codeCell.pos.x,
            y: codeCell.pos.y,
            language: 'AIResearcher',
            codeString: getAIResearcherCodeString(prompt, refCell),
            cursor: sheets.getCursorPosition(),
          });
        },
      []
    );

    return (
      <AIUserMessageForm
        {...props}
        initialPrompt={initialPrompt}
        abortController={abortController}
        loading={loading}
        setLoading={setLoading}
        submitPrompt={(prompt) => {
          mixpanel.track('[AIResearcher].submitPrompt');
          submitPrompt(prompt);
        }}
      />
    );
  }
);
