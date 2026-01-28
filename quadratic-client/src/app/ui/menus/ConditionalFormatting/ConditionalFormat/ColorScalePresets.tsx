import type { ColorScaleThreshold } from '@/app/quadratic-core-types';
import { Label } from '@/shared/shadcn/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { cn } from '@/shared/shadcn/utils';
import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { useMemo, useState } from 'react';

// Preset color scale definitions
export interface ColorScalePreset {
  id: string;
  name: string;
  thresholds: ColorScaleThreshold[];
  /** When true, auto-contrast text is enabled by default for this preset */
  invertTextOnDark?: boolean;
}

// Helper to create thresholds with Min, mid-percentile, and Max
const createThreePointScale = (minColor: string, midColor: string, maxColor: string): ColorScaleThreshold[] => [
  { value_type: 'Min', color: minColor },
  { value_type: { Percentile: 50 }, color: midColor },
  { value_type: 'Max', color: maxColor },
];

// Helper to create thresholds with just Min and Max
const createTwoPointScale = (minColor: string, maxColor: string): ColorScaleThreshold[] => [
  { value_type: 'Min', color: minColor },
  { value_type: 'Max', color: maxColor },
];

// Helper to create 4-point scales
const createFourPointScale = (
  color1: string,
  color2: string,
  color3: string,
  color4: string
): ColorScaleThreshold[] => [
  { value_type: 'Min', color: color1 },
  { value_type: { Percentile: 33 }, color: color2 },
  { value_type: { Percentile: 66 }, color: color3 },
  { value_type: 'Max', color: color4 },
];

// Preset categories for organizing in the UI
export const PRESET_CATEGORIES = {
  PERFORMANCE: { start: 0, end: 3, label: 'Performance' },
  INTENSITY: { start: 3, end: 7, label: 'Intensity' },
  COMPARISON: { start: 7, end: 10, label: 'Comparison' },
  DECORATIVE: { start: 10, end: 14, label: 'Decorative' },
};

export const COLOR_SCALE_PRESETS: ColorScalePreset[] = [
  // ─────────────────────────────────────────────────────────────
  // Performance - Status, KPIs, good/bad indicators
  // ─────────────────────────────────────────────────────────────
  {
    id: 'red-yellow-green',
    name: 'Traffic Light',
    thresholds: createThreePointScale('#ef4444', '#facc15', '#22c55e'),
  },
  {
    id: 'red-white-green',
    name: 'Red → Green',
    thresholds: createThreePointScale('#ef4444', '#ffffff', '#22c55e'),
  },
  {
    id: 'green-yellow-red',
    name: 'Green → Red',
    thresholds: createThreePointScale('#22c55e', '#facc15', '#ef4444'),
  },

  // ─────────────────────────────────────────────────────────────
  // Intensity - Single hue, light to dark for magnitude
  // ─────────────────────────────────────────────────────────────
  {
    id: 'green-intensity',
    name: 'Green',
    thresholds: createTwoPointScale('#dcfce7', '#15803d'),
    invertTextOnDark: true,
  },
  {
    id: 'blue-intensity',
    name: 'Blue',
    thresholds: createTwoPointScale('#dbeafe', '#1d4ed8'),
    invertTextOnDark: true,
  },
  {
    id: 'red-intensity',
    name: 'Red',
    thresholds: createTwoPointScale('#fee2e2', '#dc2626'),
  },
  {
    id: 'orange-intensity',
    name: 'Orange',
    thresholds: createTwoPointScale('#ffedd5', '#c2410c'),
  },

  // ─────────────────────────────────────────────────────────────
  // Comparison - Diverging scales for deviation, temperature
  // ─────────────────────────────────────────────────────────────
  {
    id: 'blue-white-red',
    name: 'Blue → Red',
    thresholds: createThreePointScale('#3b82f6', '#ffffff', '#ef4444'),
  },
  {
    id: 'heat-map',
    name: 'Heat Map',
    thresholds: createThreePointScale('#fef9c3', '#f97316', '#7c2d12'),
  },
  {
    id: 'cool-warm',
    name: 'Cool → Warm',
    thresholds: createTwoPointScale('#0ea5e9', '#f97316'),
  },

  // ─────────────────────────────────────────────────────────────
  // Decorative - Aesthetic gradients
  // ─────────────────────────────────────────────────────────────
  {
    id: 'purple-seq',
    name: 'Purple',
    thresholds: createTwoPointScale('#ede9fe', '#6d28d9'),
    invertTextOnDark: true,
  },
  {
    id: 'spectrum',
    name: 'Spectrum',
    thresholds: createFourPointScale('#ef4444', '#facc15', '#22c55e', '#3b82f6'),
  },
  {
    id: 'ocean-depth',
    name: 'Ocean',
    thresholds: createFourPointScale('#a5f3fc', '#22d3ee', '#0891b2', '#164e63'),
    invertTextOnDark: true,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    thresholds: createFourPointScale('#f0abfc', '#a78bfa', '#38bdf8', '#34d399'),
  },
];

// Generate CSS gradient from thresholds
export const getGradientFromThresholds = (thresholds: ColorScaleThreshold[]): string => {
  if (thresholds.length < 2) return 'transparent';
  const stops = thresholds.map((t, i) => {
    const percent = (i / (thresholds.length - 1)) * 100;
    return `${t.color} ${percent}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
};

interface ColorScalePresetsProps {
  currentThresholds: ColorScaleThreshold[];
  onSelectPreset: (thresholds: ColorScaleThreshold[], invertTextOnDark?: boolean) => void;
}

export const ColorScalePresets = ({ currentThresholds, onSelectPreset }: ColorScalePresetsProps) => {
  const [open, setOpen] = useState(false);

  // Find currently selected preset (if any)
  const selectedPreset = useMemo(() => {
    const currentGradient = getGradientFromThresholds(currentThresholds);
    return COLOR_SCALE_PRESETS.find((p) => getGradientFromThresholds(p.thresholds) === currentGradient);
  }, [currentThresholds]);

  const handleSelect = (preset: ColorScalePreset) => {
    onSelectPreset([...preset.thresholds], preset.invertTextOnDark);
    setOpen(false);
  };

  const currentGradient = getGradientFromThresholds(currentThresholds);

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium">Presets</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background',
              'hover:bg-accent hover:text-accent-foreground',
              'focus:outline-none focus:ring-1 focus:ring-ring'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="h-4 w-20 rounded-sm border border-border/50" style={{ background: currentGradient }} />
              <span className="text-muted-foreground">{selectedPreset?.name ?? 'Custom'}</span>
            </div>
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="max-h-80 w-64 overflow-y-auto p-2" align="start">
          <div className="flex flex-col gap-1">
            {Object.values(PRESET_CATEGORIES).map((category, index) => (
              <div key={category.label}>
                {index > 0 && <div className="my-1 h-px bg-border" />}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{category.label}</div>
                <div className="grid grid-cols-2 gap-1">
                  {COLOR_SCALE_PRESETS.slice(category.start, category.end).map((preset) => (
                    <PresetButton
                      key={preset.id}
                      preset={preset}
                      isSelected={selectedPreset?.id === preset.id}
                      onClick={() => handleSelect(preset)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

interface PresetButtonProps {
  preset: ColorScalePreset;
  isSelected: boolean;
  onClick: () => void;
}

const PresetButton = ({ preset, isSelected, onClick }: PresetButtonProps) => {
  const gradient = getGradientFromThresholds(preset.thresholds);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-1 rounded-md p-2 text-left transition-colors',
        'hover:bg-accent',
        isSelected && 'bg-accent ring-1 ring-ring'
      )}
    >
      <div
        className="h-4 w-full rounded-sm border border-border/50 transition-transform group-hover:scale-[1.02]"
        style={{ background: gradient }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground group-hover:text-foreground">{preset.name}</span>
        {isSelected && <CheckIcon className="h-3 w-3 text-primary" />}
      </div>
    </button>
  );
};
