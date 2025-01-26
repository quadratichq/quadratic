import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { SettingPanel } from '@/shared/components/SettingPanel';

import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useFeatureFlag, type FeatureFlagKey } from '@/shared/hooks/useFeatureFlag';

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
    <SettingPanel label={label} description={description} checked={featureFlag} onCheckedChange={setFeatureFlag}>
      {featureFlag && (
        <div className="flex gap-2 border-t border-border pt-3">
          <Component />
        </div>
      )}
    </SettingPanel>
  );
}
