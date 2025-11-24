import { showAIAnalystOnStartupAtom } from '@/app/atoms/gridSettingsAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { Label } from '@/shared/shadcn/ui/label';
import { Separator } from '@/shared/shadcn/ui/separator';
import { Switch } from '@/shared/shadcn/ui/switch';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { useState } from 'react';
import { useRecoilState } from 'recoil';

export function AISettings() {
  const [showAIAnalystOnStartup, setShowAIAnalystOnStartup] = useRecoilState(showAIAnalystOnStartupAtom);
  const [aiRules, setAiRules] = useState('');
  const [savedAiRules, setSavedAiRules] = useState('');

  const hasUserRulesChanges = aiRules !== savedAiRules;

  const handleSaveUserRules = () => {
    // TODO: Save to API when available
    setSavedAiRules(aiRules);
  };

  const handleCancelUserRules = () => {
    setAiRules(savedAiRules);
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
            onChange={(e) => setAiRules(e.target.value)}
            placeholder="Enter your custom rules or instructions here..."
            className="min-h-[300px] font-mono text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCancelUserRules} disabled={!hasUserRulesChanges}>
              Cancel
            </Button>
            <Button onClick={handleSaveUserRules} disabled={!hasUserRulesChanges}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
