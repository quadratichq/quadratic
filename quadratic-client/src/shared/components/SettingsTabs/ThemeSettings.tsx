import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';
import { Label } from '@/shared/shadcn/ui/label';

export function ThemeSettings() {
  return (
    <div className="space-y-6">
      {/* Theme Customization Section */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-normal text-muted-foreground">Pick a style that fits you</p>
        </div>

        <div className="space-y-6">
          <div>
            <Label className="mb-2 block text-xs font-semibold">Accent color</Label>
            <div className="grid grid-cols-3 gap-2">
              <ThemeAccentColors />
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs font-semibold">Appearance</Label>
            <div className="grid grid-cols-3 gap-2">
              <ThemeAppearanceModes />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
