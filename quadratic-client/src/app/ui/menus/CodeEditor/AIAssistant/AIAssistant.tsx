import { showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { AIIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { memo } from 'react';
import { useRecoilState } from 'recoil';

export const AIAssistant = memo(() => {
  // const textareaRef = useRef<HTMLTextAreaElement>(null);
  // const autoFocusRef = useRef(true);
  // const messagesCount = useRecoilValue(aiAssistantMessagesCountAtom);
  const [showAIAnalyst, setShowAIAnalyst] = useRecoilState(showAIAnalystAtom);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <h3 className="mb-0 font-semibold">Code chat has moved</h3>
      <p className="mb-2 max-w-sm text-center text-sm text-muted-foreground">
        Going forward, you can click <AIIcon /> in the code editor above, or access the AI chat in the left sidebar.
      </p>
      <Button
        disabled={showAIAnalyst}
        variant="outline"
        onClick={() => {
          setShowAIAnalyst(true);
        }}
      >
        Open AI chat
      </Button>
    </div>
  );

  // return (
  //   <div className="grid h-full grid-rows-[1fr_auto]">
  //     <AIAssistantMessages textareaRef={textareaRef} />

  //     <div className="flex h-full flex-col justify-end px-2 py-0.5">
  //       <AIAssistantUserMessageForm
  //         ref={textareaRef}
  //         autoFocusRef={autoFocusRef}
  //         textareaRef={textareaRef}
  //         messageIndex={messagesCount}
  //       />
  //       <AIUserMessageFormDisclaimer />
  //     </div>
  //   </div>
  // );
});
