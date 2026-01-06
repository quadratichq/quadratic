import { useOptimizePrompt } from '@/app/ai/hooks/useOptimizePrompt';
import { showSettingsDialog } from '@/shared/atom/settingsDialogAtom';
import { CodeIcon, EditIcon, EnhancePromptIcon, SpinnerIcon, TuneIcon } from '@/shared/components/Icons';
import { useUserAILanguages, type AILanguages } from '@/shared/hooks/useUserAILanguages';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Switch } from '@/shared/shadcn/ui/switch';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo, useCallback, useMemo, useState } from 'react';

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
    const { aiLanguages, saveAILanguages } = useUserAILanguages();

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
      (language: keyof AILanguages) => {
        const newValue = !aiLanguages[language];
        saveAILanguages({
          ...aiLanguages,
          [language]: newValue,
        });
        trackEvent('[AIAnalyst].toggleLanguage', { language, enabled: newValue });
      },
      [saveAILanguages, aiLanguages]
    );

    const options = useMemo(() => {
      // If the specified language is enabled _and_ it's the only enabled one,
      // don't allow it to be disabled
      const isDisabled = (language: keyof AILanguages) =>
        aiLanguages[language] && Object.entries(aiLanguages).filter(([_, value]) => value === true).length === 1;
      return [
        {
          language: 'formulas',
          label: 'Formulas',
          enabled: aiLanguages.formulas,
          disabled: isDisabled('formulas'),
        },
        {
          language: 'python',
          label: 'Python',
          enabled: aiLanguages.python,
          disabled: isDisabled('python'),
        },
        {
          language: 'javascript',
          label: 'JavaScript',
          enabled: aiLanguages.javascript,
          disabled: isDisabled('javascript'),
        },
      ] as const;
    }, [aiLanguages]);

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
            <EnhancePromptIcon className="flex-shrink-0" />

            <span>Enhance prompt</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleOpenAIRules} className="gap-3">
            <EditIcon className="flex-shrink-0" />
            <span>AI rules</span>
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-3">
              <CodeIcon className="flex-shrink-0" />
              <span>Languages</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-48 p-2">
                {options.map(({ language, enabled, disabled }) => (
                  <DropdownMenuItem
                    className="flex items-center justify-between"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (disabled) return;
                      handleToggleLanguage(language);
                    }}
                  >
                    {language.charAt(0).toUpperCase() + language.slice(1)}
                    <Switch checked={enabled} disabled={disabled} />
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator className="!block" />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Selected languages may be used in AI responses.
                </DropdownMenuLabel>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

AIUserMessageFormTuneMenu.displayName = 'AIUserMessageFormTuneMenu';
