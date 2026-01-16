import type { ColorScaleThreshold } from '@/app/quadratic-core-types';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { useMemo } from 'react';

// Value type options for color scale thresholds
const VALUE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Min', label: 'Minimum' },
  { value: 'Max', label: 'Maximum' },
  { value: 'Number', label: 'Number' },
  { value: 'Percent', label: 'Percent' },
  { value: 'Percentile', label: 'Percentile' },
];

// Helper to get value type key from threshold
const getValueTypeKey = (valueType: ColorScaleThreshold['value_type']): string => {
  if (typeof valueType === 'string') return valueType;
  if ('Number' in valueType) return 'Number';
  if ('Percent' in valueType) return 'Percent';
  if ('Percentile' in valueType) return 'Percentile';
  return 'Min';
};

// Helper to get numeric value from threshold (for Number, Percent, Percentile)
const getNumericValue = (valueType: ColorScaleThreshold['value_type']): number | undefined => {
  if (typeof valueType === 'object') {
    if ('Number' in valueType) return valueType.Number;
    if ('Percent' in valueType) return valueType.Percent;
    if ('Percentile' in valueType) return valueType.Percentile;
  }
  return undefined;
};

interface ColorScaleEditorProps {
  thresholds: ColorScaleThreshold[];
  setThresholds: (thresholds: ColorScaleThreshold[]) => void;
}

export const ColorScaleEditor = ({ thresholds, setThresholds }: ColorScaleEditorProps) => {
  const updateThreshold = (index: number, updates: Partial<ColorScaleThreshold>) => {
    const newThresholds = [...thresholds];
    newThresholds[index] = { ...newThresholds[index], ...updates };
    setThresholds(newThresholds);
  };

  const updateValueType = (index: number, typeKey: string, numericValue?: number) => {
    let newValueType: ColorScaleThreshold['value_type'];
    if (typeKey === 'Min') {
      newValueType = 'Min';
    } else if (typeKey === 'Max') {
      newValueType = 'Max';
    } else if (typeKey === 'Number') {
      newValueType = { Number: numericValue ?? 0 };
    } else if (typeKey === 'Percent') {
      newValueType = { Percent: numericValue ?? 50 };
    } else if (typeKey === 'Percentile') {
      newValueType = { Percentile: numericValue ?? 50 };
    } else {
      newValueType = 'Min';
    }
    updateThreshold(index, { value_type: newValueType });
  };

  const addThreshold = () => {
    // Add a new threshold in the middle with a default percentile value
    const newThreshold: ColorScaleThreshold = {
      value_type: { Percentile: 50 },
      color: '#ffeb84', // Yellow
    };
    // Insert before the last threshold (which should be Max)
    const newThresholds = [...thresholds];
    newThresholds.splice(thresholds.length - 1, 0, newThreshold);
    setThresholds(newThresholds);
  };

  const removeThreshold = (index: number) => {
    if (thresholds.length <= 2) return; // Keep at least 2 thresholds
    const newThresholds = thresholds.filter((_, i) => i !== index);
    setThresholds(newThresholds);
  };

  // Generate gradient preview
  const gradientPreview = useMemo(() => {
    if (thresholds.length < 2) return 'transparent';
    const stops = thresholds.map((t, i) => {
      const percent = (i / (thresholds.length - 1)) * 100;
      return `${t.color} ${percent}%`;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [thresholds]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Color Scale</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Cells are colored based on their numeric values using a gradient between the colors below.
        </p>
      </div>

      {/* Gradient Preview */}
      <div
        className="h-6 w-full rounded border border-border"
        style={{ background: gradientPreview }}
        title="Color scale preview"
      />

      {/* Threshold Editors */}
      <div className="flex flex-col gap-3">
        {thresholds.map((threshold, index) => {
          const typeKey = getValueTypeKey(threshold.value_type);
          const numericValue = getNumericValue(threshold.value_type);
          const needsNumericInput = typeKey === 'Number' || typeKey === 'Percent' || typeKey === 'Percentile';
          const isFirst = index === 0;
          const isLast = index === thresholds.length - 1;
          const canRemove = thresholds.length > 2 && !isFirst && !isLast;

          return (
            <div key={index} className="flex items-end gap-2">
              {/* Color Picker */}
              <div className="flex flex-col">
                <Label className="mb-1 text-xs">Color</Label>
                <input
                  type="color"
                  value={threshold.color}
                  onChange={(e) => updateThreshold(index, { color: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border border-border"
                  title="Pick color"
                />
              </div>

              {/* Value Type Selector */}
              <div className="flex flex-1 flex-col">
                <Label className="mb-1 text-xs">Type</Label>
                <Select value={typeKey} onValueChange={(value) => updateValueType(index, value, numericValue)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALUE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Numeric Value Input (for Number, Percent, Percentile) */}
              {needsNumericInput && (
                <div className="flex w-20 flex-col">
                  <Label className="mb-1 text-xs">Value</Label>
                  <Input
                    type="number"
                    value={numericValue ?? ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      updateValueType(index, typeKey, val);
                    }}
                    className="h-9"
                    placeholder={typeKey === 'Number' ? '0' : '50'}
                  />
                </div>
              )}

              {/* Remove Button */}
              {canRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => removeThreshold(index)}
                  title="Remove threshold"
                >
                  <span className="text-lg">×</span>
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Threshold Button */}
      <Button variant="outline" size="sm" onClick={addThreshold} className="self-start">
        + Add Color Stop
      </Button>
    </div>
  );
};
