import { showAIAnalystOnStartupAtom } from '@/app/atoms/gridSettingsAtom';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { useUserAIRules } from '@/shared/hooks/useUserAIRules';
import { Button } from '@/shared/shadcn/ui/button';
import { Label } from '@/shared/shadcn/ui/label';
import { Separator } from '@/shared/shadcn/ui/separator';
import { Switch } from '@/shared/shadcn/ui/switch';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

export function AISettings() {
  const [showAIAnalystOnStartup, setShowAIAnalystOnStartup] = useRecoilState(showAIAnalystOnStartupAtom);
  const { aiRules: preloadedAiRules, isLoading: isPreloading, saveAIRules } = useUserAIRules();
  const [localAiRules, setLocalAiRules] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { addGlobalSnackbar } = useGlobalSnackbar();

  // Initialize local state from preloaded data once available
  useEffect(() => {
    if (!isPreloading && localAiRules === null) {
      setLocalAiRules(preloadedAiRules);
    }
  }, [isPreloading, preloadedAiRules, localAiRules]);

  // The actual value being edited (local state takes precedence once initialized)
  const aiRules = localAiRules ?? preloadedAiRules;
  const hasUserRulesChanges = aiRules !== preloadedAiRules;

  const handleSaveUserRules = async () => {
    setIsSaving(true);
    try {
      const success = await saveAIRules(aiRules || null);
      if (success) {
        trackEvent('[Settings].userAiRulesSaved', {
          has_rules: Boolean(aiRules),
          rules_length: aiRules?.length || 0,
        });
        addGlobalSnackbar('AI rules saved successfully', { severity: 'success' });
      } else {
        addGlobalSnackbar('Failed to save AI rules', { severity: 'error' });
      }
    } catch (error) {
      console.error('Failed to save AI rules:', error);
      addGlobalSnackbar('Failed to save AI rules', { severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelUserRules = () => {
    setLocalAiRules(preloadedAiRules);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (hasUserRulesChanges && !isPreloading && !isSaving) {
        handleSaveUserRules();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Settings Section */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-normal text-muted-foreground">Configure AI assistant settings</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="show-ai-startup" className="cursor-pointer">
              Show the AI panel when starting the app
            </Label>
            <Switch id="show-ai-startup" checked={showAIAnalystOnStartup} onCheckedChange={setShowAIAnalystOnStartup} />
          </div>
        </div>
      </div>

      <Separator />

      {/* AI Rules Section */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-normal text-muted-foreground">
            Add custom rules or instructions that will be sent with each AI prompt. These rules help guide the AI's
            behavior and responses.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-rules-editor">User rules</Label>
          <Textarea
            id="ai-rules-editor"
            value={aiRules}
            onChange={(e) => setLocalAiRules(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your custom rules or instructions here..."
            className="min-h-[300px] font-mono text-sm"
          />
          {hasUserRulesChanges && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelUserRules} disabled={isPreloading}>
                Cancel
              </Button>
              <Button onClick={handleSaveUserRules} disabled={isPreloading || isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
