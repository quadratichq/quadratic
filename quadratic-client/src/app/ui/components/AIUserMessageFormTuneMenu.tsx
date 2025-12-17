import { useOptimizePrompt } from '@/app/ai/hooks/useOptimizePrompt';
import { aiAnalystLanguagesAtom, type AIAnalystLanguages } from '@/app/atoms/aiAnalystAtom';
import { showSettingsDialog } from '@/shared/atom/settingsDialogAtom';
import { CodeIcon, EditIcon, EnhancePromptIcon, SpinnerIcon, TuneIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo, useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';

interface AIUserMessageFormTuneMenuProps {
  disabled: boolean;
  prompt: string;
  setPrompt: (prompt: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const AIUserMessageFormTuneMenu = memo(
  ({ disabled, prompt, setPrompt, textareaRef }: AIUserMessageFormTuneMenuProps) => {
    const { optimizePrompt } = useOptimizePrompt();
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [languages, setLanguages] = useRecoilState(aiAnalystLanguagesAtom);

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

    const handleOpenAIRules = useCallback(() => {
      trackEvent('[AIAnalyst].openAIRules');
      showSettingsDialog('ai');
    }, []);

    const handleAutoClose = useCallback(
      (e: Event) => {
        e.preventDefault();
        textareaRef.current?.focus();
      },
      [textareaRef]
    );

    const handleToggleLanguage = useCallback(
      (language: keyof AIAnalystLanguages) => {
        setLanguages((prev) => ({
          ...prev,
          [language]: !prev[language],
        }));
        trackEvent('[AIAnalyst].toggleLanguage', { language, enabled: !languages[language] });
      },
      [setLanguages, languages]
    );

    return (
      <DropdownMenu>
        <TooltipPopover label="More options" fastMode={true}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              className="h-7 w-7 rounded-full px-0 shadow-none hover:bg-border"
              variant="ghost"
              disabled={disabled || isOptimizing}
            >
              {isOptimizing ? <SpinnerIcon /> : <TuneIcon />}
            </Button>
          </DropdownMenuTrigger>
        </TooltipPopover>

        <DropdownMenuContent side="top" align="start" onCloseAutoFocus={handleAutoClose} className="min-w-48">
          <DropdownMenuItem onClick={handleOptimize} disabled={isOptimizing} className="gap-3">
            {isOptimizing ? (
              <SpinnerIcon className="flex-shrink-0 text-muted-foreground" />
            ) : (
              <EnhancePromptIcon className="flex-shrink-0 text-muted-foreground" />
            )}
            <span>Enhance prompt</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleOpenAIRules} className="gap-3">
            <EditIcon className="flex-shrink-0 text-muted-foreground" />
            <span>AI rules</span>
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-3">
              <CodeIcon className="flex-shrink-0 text-muted-foreground" />
              <span>Languages</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuCheckboxItem
                  checked={languages.formulas}
                  onCheckedChange={() => handleToggleLanguage('formulas')}
                >
                  Formulas
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={languages.python}
                  onCheckedChange={() => handleToggleLanguage('python')}
                >
                  Python
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={languages.javascript}
                  onCheckedChange={() => handleToggleLanguage('javascript')}
                >
                  JavaScript
                </DropdownMenuCheckboxItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

AIUserMessageFormTuneMenu.displayName = 'AIUserMessageFormTuneMenu';
