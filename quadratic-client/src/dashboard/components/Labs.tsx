import { featureFlagSelector } from '@/shared/atoms/featureFlags';
import { useFeatureFlag, type FeatureFlagKey } from '@/shared/components/FeatureFlags';
import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';
import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';
import { useRecoilState } from 'recoil';

type LabProps = {
  featureFlagKey: FeatureFlagKey;
  label: string;
  description: string;
  Component: React.ComponentType<any>;
};

const labFeatures = [
  {
    featureFlagKey: 'themeAppearanceMode',
    label: 'Appearance',
    description: 'Choose light or dark mode (or use your system’s setting).',
    Component: ThemeAppearanceModes,
  },
  {
    featureFlagKey: 'themeAccentColor',
    label: 'Accent color',
    description: 'Choose a custom accent color used throughout the app.',
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
  const [, setFlags] = useRecoilState(featureFlagSelector);

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
          checked={isOn}
          onCheckedChange={(checked) => {
            setFlags((prev) => ({ themeAccentColor: checked }));
            setIsOn(checked);
          }}
        />
      </div>
      {isOn && (
        <div className="flex gap-2 border-t border-border pt-3">
          <Component />
        </div>
      )}
    </div>
  );
}
