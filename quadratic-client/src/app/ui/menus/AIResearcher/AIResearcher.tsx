import { codeEditorLoadingAtom } from '@/app/atoms/codeEditorAtom';
import { AIResearcherRefCell } from '@/app/ui/menus/AIResearcher/AIResearcherRefCell';
import { AIResearcherUserMessageForm } from '@/app/ui/menus/AIResearcher/AIResearcherUserMessageForm';
import { ReturnTypeInspector } from '@/app/ui/menus/CodeEditor/ReturnTypeInspector';
import { CircularProgress } from '@mui/material';
import { useRecoilValue } from 'recoil';

type AIResearcherProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

export const AIResearcher = ({ textareaRef }: AIResearcherProps) => {
  const codeEditorLoading = useRecoilValue(codeEditorLoadingAtom);

  if (codeEditorLoading) {
    return (
      <div className="flex justify-center">
        <CircularProgress style={{ width: '18px', height: '18px' }} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-between">
      <AIResearcherUserMessageForm textareaRef={textareaRef} />
      <div className="shrink-0">
        <AIResearcherRefCell />
        <ReturnTypeInspector />
      </div>
    </div>
  );
};
