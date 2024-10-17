import { aiAnalystMessagesAtom, aiAnalystMessagesCountAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { ChevronLeftIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { IconButton } from '@mui/material';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export function AIAnalystHeader() {
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const messagesCount = useRecoilValue(aiAnalystMessagesCountAtom);
  const setMessages = useSetRecoilState(aiAnalystMessagesAtom);

  return (
    <div className="flex items-center justify-between p-2">
      <div className="flex items-center gap-2">
        <IconButton onClick={() => setShowAIAnalyst(false)}>
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
