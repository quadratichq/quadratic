import type { ColorScaleThreshold } from '@/app/quadratic-core-types';
import { ColorPicker } from '@/app/ui/components/ColorPicker';
import {
  ColorScalePresets,
  getGradientFromThresholds,
} from '@/app/ui/menus/ConditionalFormatting/ConditionalFormat/ColorScalePresets';
import { ValidationInput } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationInput';
import { Button } from '@/shared/shadcn/ui/button';
import { Checkbox } from '@/shared/shadcn/ui/checkbox';
import { Label } from '@/shared/shadcn/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Generate a unique ID for threshold tracking
const generateThresholdId = (() => {
  let counter = 0;
  return () => `threshold-${counter++}`;
})();

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
  invertTextOnDark: boolean;
  setInvertTextOnDark: (value: boolean) => void;
}

export const ColorScaleEditor = ({
  thresholds,
  setThresholds,
  invertTextOnDark,
  setInvertTextOnDark,
}: ColorScaleEditorProps) => {
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [openColorPicker, setOpenColorPicker] = useState<string | null>(null);

  // Stable IDs for each threshold to use as React keys
  const [thresholdIds, setThresholdIds] = useState<string[]>(() => thresholds.map(() => generateThresholdId()));

  // Track previous thresholds to detect external changes (like preset selection)
  const prevThresholdsRef = useRef(thresholds);

  // Sync IDs when thresholds change externally (not from our own add/remove operations)
  useEffect(() => {
    const prevThresholds = prevThresholdsRef.current;
    if (thresholds !== prevThresholds) {
      // Check if this is likely an external change (preset selection replaces all thresholds)
      // vs. our own add/remove which only changes length by 1
      const lengthDiff = Math.abs(thresholds.length - thresholdIds.length);
      const isExternalChange = lengthDiff !== 0 && lengthDiff !== 1;

      if (isExternalChange || thresholds.length !== thresholdIds.length) {
        // Regenerate all IDs for external changes
        setThresholdIds(thresholds.map(() => generateThresholdId()));
        setErrors({});
        setOpenColorPicker(null);
      }
      prevThresholdsRef.current = thresholds;
    }
  }, [thresholds, thresholdIds.length]);

  const updateThreshold = useCallback(
    (index: number, updates: Partial<ColorScaleThreshold>) => {
      const newThresholds = [...thresholds];
      newThresholds[index] = { ...newThresholds[index], ...updates };
      setThresholds(newThresholds);
    },
    [thresholds, setThresholds]
  );

  const updateValueType = useCallback(
    (index: number, typeKey: string, numericValue?: number) => {
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
    },
    [updateThreshold]
  );

  const handleNumericValueChange = useCallback(
    (index: number, thresholdId: string, typeKey: string, value: string) => {
      const trimmed = value.trim();

      if (trimmed === '') {
        // Empty value - use default
        setErrors((prev) => ({ ...prev, [thresholdId]: undefined }));
        updateValueType(index, typeKey, typeKey === 'Number' ? 0 : 50);
        return;
      }

      const parsed = parseFloat(trimmed);
      if (isNaN(parsed)) {
        setErrors((prev) => ({ ...prev, [thresholdId]: 'Please enter a valid number' }));
        return;
      }

      // Validate percent/percentile range
      if ((typeKey === 'Percent' || typeKey === 'Percentile') && (parsed < 0 || parsed > 100)) {
        setErrors((prev) => ({ ...prev, [thresholdId]: 'Value must be between 0 and 100' }));
        return;
      }

      setErrors((prev) => ({ ...prev, [thresholdId]: undefined }));
      updateValueType(index, typeKey, parsed);
    },
    [updateValueType]
  );

  const addThreshold = () => {
    // Add a new threshold in the middle with a default percentile value
    const newThreshold: ColorScaleThreshold = {
      value_type: { Percentile: 50 },
      color: '#ffeb84', // Yellow
    };
    // Insert before the last threshold (which should be Max)
    const newThresholds = [...thresholds];
    newThresholds.splice(thresholds.length - 1, 0, newThreshold);

    // Add a new ID for the new threshold
    const newIds = [...thresholdIds];
    newIds.splice(thresholds.length - 1, 0, generateThresholdId());
    setThresholdIds(newIds);

    setThresholds(newThresholds);
  };

  const removeThreshold = (index: number) => {
    if (thresholds.length <= 2) return; // Keep at least 2 thresholds

    // Remove the corresponding ID
    const removedId = thresholdIds[index];
    setThresholdIds(thresholdIds.filter((_, i) => i !== index));

    // Clear any state associated with the removed threshold
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[removedId];
      return newErrors;
    });
    if (openColorPicker === removedId) {
      setOpenColorPicker(null);
    }

    const newThresholds = thresholds.filter((_, i) => i !== index);
    setThresholds(newThresholds);
  };

  // Generate gradient preview using the shared helper
  const gradientPreview = useMemo(() => getGradientFromThresholds(thresholds), [thresholds]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Color Scale</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Cells are colored based on their numeric values using a gradient between the colors below.
        </p>
      </div>

      {/* Preset Selector */}
      <ColorScalePresets
        currentThresholds={thresholds}
        onSelectPreset={(newThresholds, presetInvertTextOnDark) => {
          setThresholds(newThresholds);
          if (presetInvertTextOnDark !== undefined) {
            setInvertTextOnDark(presetInvertTextOnDark);
          }
        }}
      />

      {/* Gradient Preview */}
      <div
        className="h-6 w-full rounded border border-border"
        style={{ background: gradientPreview }}
        title="Color scale preview"
      />

      {/* Threshold Editors */}
      <div className="flex flex-col gap-3">
        {thresholds.map((threshold, index) => {
          const thresholdId = thresholdIds[index];
          const typeKey = getValueTypeKey(threshold.value_type);
          const numericValue = getNumericValue(threshold.value_type);
          const needsNumericInput = typeKey === 'Number' || typeKey === 'Percent' || typeKey === 'Percentile';
          const isFirst = index === 0;
          const isLast = index === thresholds.length - 1;
          const canRemove = thresholds.length > 2 && !isFirst && !isLast;

          return (
            <div key={thresholdId} className="flex items-end gap-2">
              {/* Color Picker */}
              <div className="flex flex-col">
                <Label className="mb-1 text-xs">Color</Label>
                <Popover
                  open={openColorPicker === thresholdId}
                  onOpenChange={(open) => setOpenColorPicker(open ? thresholdId : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-9 w-12 cursor-pointer rounded border border-border transition-all hover:ring-2 hover:ring-ring hover:ring-offset-1"
                      style={{ backgroundColor: threshold.color }}
                      title="Pick color"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-fit p-1" align="start">
                    <ColorPicker
                      color={threshold.color}
                      onChangeComplete={(color) => updateThreshold(index, { color: color.hex })}
                      onClose={() => setOpenColorPicker(null)}
                    />
                  </PopoverContent>
                </Popover>
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
                <div className="flex w-24 flex-col">
                  <ValidationInput
                    label="Value"
                    type="number"
                    value={numericValue?.toString() ?? ''}
                    onChange={(value) => handleNumericValueChange(index, thresholdId, typeKey, value)}
                    placeholder={typeKey === 'Number' ? '0' : '50'}
                    error={errors[thresholdId]}
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

      {/* Invert Text on Dark Checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="invert-text-on-dark"
          checked={invertTextOnDark}
          onCheckedChange={(checked) => setInvertTextOnDark(checked === true)}
        />
        <Label htmlFor="invert-text-on-dark" className="cursor-pointer text-sm font-normal">
          Auto-contrast text color
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        When enabled, text will automatically switch between black and white based on the background color to ensure
        readability.
      </p>
    </div>
  );
};
