import {
  aiAssistantMessagesAtom,
  aiAssistantMessagesCountAtom,
  showAIAssistantAtom,
} from '@/app/atoms/aiAssistantAtom';
import { ChevronLeftIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { IconButton } from '@mui/material';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export function AIAssistantHeader() {
  const setShowAIAssistant = useSetRecoilState(showAIAssistantAtom);
  const messagesCount = useRecoilValue(aiAssistantMessagesCountAtom);
  const setMessages = useSetRecoilState(aiAssistantMessagesAtom);

  return (
    <div className="flex items-center justify-between p-2">
      <div className="flex items-center gap-2">
        <IconButton onClick={() => setShowAIAssistant(false)}>
          <ChevronLeftIcon />
        </IconButton>

        <span>AI Assistant</span>
      </div>

      <Button onClick={() => setMessages([])} variant="outline" disabled={messagesCount === 0}>
        Clear
      </Button>
    </div>
  );
}
