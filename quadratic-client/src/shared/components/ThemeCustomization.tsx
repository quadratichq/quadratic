import { ThemeAccentColors } from '@/shared/components/ThemeAccentColors';
import { ThemeAppearanceModes } from '@/shared/components/ThemeAppearanceModes';

export function ThemeCustomization() {
  return (
    <>
      <h3 className="mb-1 text-xs font-semibold">Accent color</h3>
      <div className="grid grid-cols-3 gap-2">
        <ThemeAccentColors />
      </div>

      <h3 className="mb-1 mt-4 text-xs font-semibold">Appearance</h3>
      <div className="grid grid-cols-3 gap-2">
        <ThemeAppearanceModes />
      </div>
    </>
  );
}
