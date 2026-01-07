import { useOptimizePrompt } from '@/app/ai/hooks/useOptimizePrompt';
import { showSettingsDialog } from '@/shared/atom/settingsDialogAtom';
import { CodeIcon, EditIcon, EnhancePromptIcon, SpinnerIcon, TuneIcon } from '@/shared/components/Icons';
import { useUserAILanguages } from '@/shared/hooks/useUserAILanguages';
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
import { allAILanguagePreferences, type AILanguagePreference } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useState } from 'react';

const languageLabels: Record<AILanguagePreference, string> = {
  Python: 'Python',
  Javascript: 'JavaScript',
  Formula: 'Formulas',
};

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

    const toggleLanguage = useCallback(
      (language: AILanguagePreference) => {
        const isEnabled = aiLanguages.includes(language);
        const newLanguages = isEnabled ? aiLanguages.filter((l) => l !== language) : [...aiLanguages, language];
        saveAILanguages(newLanguages);
        trackEvent('[AIAnalyst].toggleLanguage', { language, enabled: !isEnabled });
      },
      [aiLanguages, saveAILanguages]
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
              <DropdownMenuSubContent className="w-56 p-2">
                {allAILanguagePreferences.map((language: AILanguagePreference) => (
                  <DropdownMenuItem
                    key={language}
                    className="flex items-center justify-between"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleLanguage(language);
                    }}
                  >
                    {languageLabels[language]}
                    <Switch checked={aiLanguages.includes(language)} />
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator className="!block" />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  When enabled, AI responses will prefer the selected languages.
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
