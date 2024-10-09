import { useFeatureFlag, type FeatureFlagKey } from '@/shared/components/FeatureFlags';
import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';
import { Switch } from '@/shared/shadcn/ui/switch';

// TODO: wire these up in the dashboard
// TODO: persist these?

type LabProps = {
  featureFlagKey: FeatureFlagKey;
  label: string;
  description: string;
  Component: React.ComponentType<any>;
};

const labFeatures = [
  {
    featureFlagKey: 'themeAppearanceMode',
    label: 'Appearance (dark mode)',
    description: 'Customize the app’s appearance for light, dark, or system mode.',
    Component: ThemeAppearanceModes,
  },
  {
    featureFlagKey: 'themeAccentColor',
    label: 'Accent color',
    description: 'Customize the primary color of the app.',
    Component: ThemeAccentColors,
  },
] as const;

export function Labs() {
  return (
    <div className="mb-4 w-full space-y-6">
      <div className="mt-4 space-y-4">
        {labFeatures.map((props) => (
          <LabToggle key={props.featureFlagKey} {...props} />
        ))}
      </div>
    </div>
  );
}

function LabToggle({ featureFlagKey, label, description, Component }: LabProps) {
  const [isOn, setIsOn] = useFeatureFlag(featureFlagKey);

  return (
    <div className="space-y-3 rounded-lg border p-3 shadow-sm">
      <div className="flex w-full flex-row items-center justify-between">
        <div className="mr-auto space-y-0.5 text-sm">
          <p className="font-medium">{label}</p>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <Switch checked={isOn} onCheckedChange={setIsOn} />
      </div>
      {isOn && (
        <div className="flex gap-2 border-t border-border pt-3">
          <Component />
        </div>
      )}
    </div>
  );
}
