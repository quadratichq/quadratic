import { codeEditorLoadingAtom } from '@/app/atoms/codeEditorAtom';
import { AIResearcherInsertCellRef } from '@/app/ui/menus/AIResearcher/AIResearcherInsertCellRef';
import { AIResearcherResult } from '@/app/ui/menus/AIResearcher/AIResearcherResult';
import { AIResearcherUserMessageForm } from '@/app/ui/menus/AIResearcher/AIResearcherUserMessageForm';
import { CircularProgress } from '@mui/material';
import { useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const AIResearcher = () => {
  const codeEditorLoading = useRecoilValue(codeEditorLoadingAtom);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoFocusRef = useRef(true);

  if (codeEditorLoading) {
    return (
      <div className="flex justify-center">
        <CircularProgress style={{ width: '18px', height: '18px' }} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="px-2 py-0.5">
        <AIResearcherUserMessageForm
          ref={textareaRef}
          autoFocusRef={autoFocusRef}
          textareaRef={textareaRef}
          collapseAfterSubmit={false}
          disableBackspaceIcon={true}
        />
      </div>

      <AIResearcherInsertCellRef />

      <AIResearcherResult />

      {/* <AIResearcherSettings /> */}
    </div>
  );
};
