import { DashboardHeader } from '@/dashboard/components/DashboardHeader';

import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useFeatureFlag, type FeatureFlagKey } from '@/shared/hooks/useFeatureFlag';
import { Button } from '@/shared/shadcn/ui/button';
import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';
import { useEffect, useState } from 'react';

type LabProps = {
  featureFlagKey: FeatureFlagKey;
  label: string;
  description: string;
  Component: React.ComponentType<any>;
};

const labFeatures = [
  {
    featureFlagKey: 'themeAccentColor',
    label: 'Accent color',
    description: 'Choose a custom accent color used throughout the app.',
    Component: ThemeAccentColors,
  },
  {
    featureFlagKey: 'themeAppearanceMode',
    label: 'Appearance',
    description: 'Choose light or dark mode (or use your system setting).',
    Component: ThemeAppearanceModes,
  },
] as const;

const labSettings = [
  {
    label: 'AI rules',
    description: 'Define custom rules for Quadratic AI. These rules are stored in your browser local storage only - they are not shared with your other devices or other browsers.',
    Component: AILabsAISettings,
  },
] as const;

export const Component = () => {
  return (
    <>
      <div className="max-w-xl">
        <DashboardHeader title="Labs" />

        <p className="text-sm text-muted-foreground">
          These are experimental features you can try while they're still under active development. If you have
          feedback, we'd love to hear it! Please{' '}
          <a href={CONTACT_URL} className="underline hover:text-primary">
            contact us
          </a>
          .
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <em>Note: these preferences are stored in the browser and do not persist across devices.</em>
        </p>

        <div className="mb-4 w-full space-y-6">
          <div className="mt-4 space-y-4">
            {labFeatures.map((props) => (
              <LabToggle key={props.featureFlagKey} {...props} />
            ))}
          </div>
          
          <div className="mt-4 space-y-4">
            {labSettings.map((setting, index) => (
              <div key={index} className="space-y-3 rounded-lg border p-3 shadow-sm">
                <div className="mr-auto space-y-0.5 text-sm">
                  <Label className="font-medium">{setting.label}</Label>
                  <p className="text-muted-foreground">{setting.description}</p>
                </div>
                <div className="flex gap-2 pt-3">
                  <setting.Component />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

function LabToggle({ featureFlagKey, label, description, Component }: LabProps) {
  const [featureFlag, setFeatureFlag] = useFeatureFlag(featureFlagKey);

  return (
    <div className="space-y-3 rounded-lg border p-3 shadow-sm">
      <div className="flex w-full flex-row items-center justify-between gap-3">
        <div className="mr-auto space-y-0.5 text-sm">
          <Label htmlFor={featureFlagKey} className="font-medium">
            {label}
          </Label>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <Switch
          id={featureFlagKey}
          checked={featureFlag}
          onCheckedChange={(checked) => {
            setFeatureFlag(checked);
          }}
        />
      </div>
      {featureFlag && (
        <div className="flex gap-2 border-t border-border pt-3">
          <Component />
        </div>
      )}
    </div>
  );
}

function AILabsAISettings() {
  // Track original AI rules for comparison
  const [originalAiRules, setOriginalAiRules] = useState('');
  const [aiRulesText, setAiRulesText] = useState('');
  const [isSavingRules, setIsSavingRules] = useState(false);

  // On component mount, load from localStorage
  useEffect(() => {
    const storedRules = localStorage.getItem('quadratic_ai_rules') || '';
    setAiRulesText(storedRules);
    setOriginalAiRules(storedRules);
  }, []);

  // Save on submit
  const handleAiRulesSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSavingRules(true);
    localStorage.setItem('quadratic_ai_rules', aiRulesText);
    setOriginalAiRules(aiRulesText);
    // Reset saving state after a brief delay to show feedback
    setTimeout(() => setIsSavingRules(false), 500);
  };

  // Calculate if save button should be disabled
  const aiRulesSaveDisabled = aiRulesText === originalAiRules || isSavingRules;

  return (
    <div className="w-full">

      <form onSubmit={handleAiRulesSubmit}>
        <textarea
          className="min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="Enter AI rules here..."
          value={aiRulesText}
          onChange={(e) => setAiRulesText(e.target.value)}
        />
        <div className="mt-2 flex">
          <Button 
            type="submit" 
            variant="secondary"
            disabled={aiRulesSaveDisabled}
          >
            {isSavingRules ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  );
}
