import { aiAssistantMessagesAtom, aiAssistantMessagesCountAtom } from '@/app/atoms/aiAssistantAtom';
import {
  editorInteractionStateShowAIAssistantAtom,
  editorInteractionStateShowCodeEditorAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/AIAssistant/useSubmitAIAssistantPrompt';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { ChevronLeftIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { IconButton } from '@mui/material';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export function AIAssistantHeader() {
  const messagesCount = useRecoilValue(aiAssistantMessagesCountAtom);
  const setMessages = useSetRecoilState(aiAssistantMessagesAtom);
  const setShowAIAssistant = useSetRecoilState(editorInteractionStateShowAIAssistantAtom);
  const showCodeEditor = useRecoilValue(editorInteractionStateShowCodeEditorAtom);
  const submitPrompt = useSubmitAIAssistantPrompt();
  const {
    consoleOutput: [consoleOutput],
  } = useCodeEditor();

  return (
    <div className="flex items-center justify-between p-2">
      <div className="flex items-center gap-2">
        <IconButton onClick={() => setShowAIAssistant(false)}>
          <ChevronLeftIcon />
        </IconButton>

        <span>AI Assistant</span>
      </div>

      <div className="flex items-center gap-2">
        {showCodeEditor && consoleOutput?.stdErr && (
          <Button
            onClick={() => submitPrompt({ userPrompt: 'Fix the error in the code cell', clearMessages: true })}
            variant="success"
          >
            Fix error
          </Button>
        )}

        <Button onClick={() => setMessages([])} variant="outline" disabled={messagesCount === 0}>
          Clear
        </Button>
      </div>
    </div>
  );
}
