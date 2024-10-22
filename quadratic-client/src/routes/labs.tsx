import { DashboardHeader } from '@/dashboard/components/DashboardHeader';

import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useFeatureFlag, type FeatureFlagKey } from '@/shared/hooks/useFeatureFlag';
import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';

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
    description: 'Choose light or dark mode (or use your system’s setting).',
    Component: ThemeAppearanceModes,
  },
] as const;

export const Component = () => {
  return (
    <>
      <div className="max-w-xl">
        <DashboardHeader title="Labs" />

        <p className="text-sm text-muted-foreground">
          These are experimental features you can try while they’re still under active development. If you have
          feedback, we’d love to hear it! Please{' '}
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
