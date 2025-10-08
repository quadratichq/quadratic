import { useOptimizePrompt } from '@/app/ai/hooks/useOptimizePrompt';
import { AIIcon } from '@/shared/components/Icons';
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
      if (!prompt.trim() || isOptimizing) return;

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
      <TooltipPopover label="Optimize prompt">
        <Button
          size="icon-sm"
          className="h-7 w-7 rounded-full px-0 shadow-none hover:bg-border"
          variant="ghost"
          disabled={disabled || !prompt.trim() || isOptimizing}
          onClick={handleOptimize}
        >
          <AIIcon className={isOptimizing ? 'animate-pulse' : ''} />
        </Button>
      </TooltipPopover>
    );
  }
);

AIUserMessageFormOptimizeButton.displayName = 'AIUserMessageFormOptimizeButton';
