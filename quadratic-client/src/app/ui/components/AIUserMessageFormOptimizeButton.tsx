import { useOptimizePrompt } from '@/app/ai/hooks/useOptimizePrompt';
import { EnhancePromptIcon, SpinnerIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo, useCallback, useState } from 'react';

interface AIUserMessageFormOptimizeButtonProps {
  disabled: boolean;
  prompt: string;
  setPrompt: (prompt: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const AIUserMessageFormOptimizeButton = memo(
  ({ disabled, prompt, setPrompt, textareaRef }: AIUserMessageFormOptimizeButtonProps) => {
    const { optimizePrompt } = useOptimizePrompt();
    const [isOptimizing, setIsOptimizing] = useState(false);

    const handleOptimize = useCallback(async () => {
      if (isOptimizing) return;

      trackEvent('[AIOptimizePrompt].optimize');
      setIsOptimizing(true);

      try {
        const optimized = await optimizePrompt(prompt);
        if (optimized && optimized !== prompt) {
          setPrompt(optimized);
          trackEvent('[AIOptimizePrompt].success');
        }
      } catch (error) {
        console.error('[AIOptimizePrompt] error:', error);
        trackEvent('[AIOptimizePrompt].error');
      } finally {
        setIsOptimizing(false);
        textareaRef.current?.focus();
      }
    }, [prompt, optimizePrompt, setPrompt, textareaRef, isOptimizing]);

    return (
      <TooltipPopover label="Enhance my prompt with better instructions" fastMode={true}>
        <Button
          size="sm"
          className="h-7 w-7 gap-1.5 rounded-full px-0 shadow-none hover:bg-border @[450px]:w-auto @[450px]:px-2"
          variant="ghost"
          disabled={disabled || isOptimizing}
          onClick={handleOptimize}
        >
          {isOptimizing ? <SpinnerIcon /> : <EnhancePromptIcon />}
          <span className="hidden text-xs @[450px]:inline">Enhance prompt</span>
        </Button>
      </TooltipPopover>
    );
  }
);

AIUserMessageFormOptimizeButton.displayName = 'AIUserMessageFormOptimizeButton';
