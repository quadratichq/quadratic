import { hexToRgb, normalizeColor } from '@/app/helpers/convertColor';
import { PaletteIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import Color from 'color';
import * as React from 'react';
import { CustomColorPicker } from './CustomColorPicker';

// ColorResult interface
export interface ColorResult {
  hex: string;
  rgb: {
    r: number;
    g: number;
    b: number;
    a?: number;
  };
  hsl: {
    h: number;
    s: number;
    l: number;
    a?: number;
  };
}

export type ColorChangeHandler = (color: ColorResult) => void;

interface ColorPickerProps {
  onChangeComplete?: ColorChangeHandler;
  onClear?: () => void;
  onClose?: () => void;
  color?: string;
  removeColor?: boolean;
  className?: string;
  clearLabel?: string;
  showClearIcon?: boolean;
  showCustomColor?: boolean;
}

export const ColorPicker = React.forwardRef<HTMLDivElement, ColorPickerProps>(
  (
    {
      onChangeComplete,
      onClear,
      onClose,
      color,
      removeColor = false,
      className,
      clearLabel = 'Clear',
      showClearIcon = true,
      showCustomColor = true,
    },
    ref
  ) => {
    const [showCustomPicker, setShowCustomPicker] = React.useState(false);
    const colors = [
      '#F9D2CE' /* first row of colors */,
      '#FFEAC8',
      '#FFF3C1',
      '#D8FFE8',
      '#D5FFF7',
      '#DAF0FF',
      '#EBD7F3',
      '#D9F2FA',
      '#FFB4AC' /* second row of colors */,
      '#FFDA9F',
      '#F2E2A4',
      '#AAF1C8',
      '#ADEFE2',
      '#AFD0E7',
      '#D1B4DD',
      '#B4D3DC',
      '#EE8277' /* third row of colors */,
      '#F8C97D',
      '#F5D657',
      '#86E3AE',
      '#7BE9D3',
      '#84BFE7',
      '#C39BD3',
      '#A1B9BA',
      '#E74C3C' /* forth row of colors */,
      '#F39C12',
      '#F1C40F',
      '#2ECC71',
      '#17C8A5',
      '#3498DB',
      '#9B59B6',
      '#698183',
      '#963127' /* fifth row of colors */,
      '#C46B1D',
      '#B69100',
      '#1C8347',
      '#056D6D',
      '#1F608B',
      '#6F258E',
      '#34495E',
      '#000000' /* sixth row of colors */,
      '#333333',
    ];

    if (removeColor) {
      colors.push(
        '#737373',
        '#cccccc',
        '#dddddd',
        '#eeeeee',
        '#ffffff',
        '#123456' // special indicator for remove color. See useBorders.tsx#CLEAR_COLOR
      );
    } else {
      colors.push('#4d4d4d', '#737373', '#cccccc', '#dddddd', '#eeeeee', '#ffffff');
    }

    // Check if current color is a custom color (not in the preset list)
    const normalizedCurrentColor = color ? normalizeColor(color) : null;
    const isCustomColor =
      showCustomColor && normalizedCurrentColor && !colors.some((c) => normalizeColor(c) === normalizedCurrentColor);
    const customColor = isCustomColor ? normalizedCurrentColor : null;

    const handleColorClick = (hex: string) => {
      if (onChangeComplete) {
        const rgb = hexToRgb(hex);
        const color = Color(hex);
        const hsl = color.hsl().object();

        onChangeComplete({
          hex,
          rgb: {
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
            a: 1,
          },
          hsl: {
            h: Math.round(hsl.h || 0),
            s: Math.round((hsl.s || 0) * 100),
            l: Math.round((hsl.l || 0) * 100),
            a: 1,
          },
        });
      }
    };

    const isLastColor = (index: number) => removeColor && index === colors.length - 1;

    // Handle custom color selection
    const handleCustomColorChange = (hex: string) => {
      handleColorClick(hex);
    };

    // Show custom picker view
    if (showCustomColor && showCustomPicker) {
      return (
        <div ref={ref} className={className}>
          <CustomColorPicker
            color={color}
            onChange={handleCustomColorChange}
            onBack={() => setShowCustomPicker(false)}
            onClose={onClose}
          />
        </div>
      );
    }

    return (
      <div ref={ref} className={cn('w-40 p-1', className)}>
        <div className="grid grid-cols-8 gap-1">
          {colors.map((hex, index) => {
            const normalizedHex = hex.toLowerCase();
            const normalizedColor = color ? normalizeColor(color) : null;
            const isSelected = normalizedColor === normalizedHex;
            const isClearColor = isLastColor(index);

            return (
              <button
                key={`${hex}-${index}`}
                type="button"
                onClick={() => handleColorClick(hex)}
                className={cn(
                  'duration-50 relative h-4 w-4 rounded-md transition-all hover:z-20 hover:scale-110 hover:ring-2 hover:ring-ring hover:ring-offset-1',
                  isSelected && 'z-10 ring-2 ring-ring ring-offset-1',
                  (hex === '#ffffff' || isClearColor) && 'ring-1 ring-border'
                )}
                style={{ backgroundColor: hex }}
                aria-label={`Select color ${hex}`}
              >
                {/* Border for white colors */}
                {hex === '#ffffff' && <div className="absolute inset-0 rounded-sm ring-1 ring-border/20" />}

                {/* Special clear color indicator */}
                {isClearColor && (
                  <>
                    <div className="absolute inset-0 rounded-sm bg-white ring-1 ring-border/20" />
                    <div
                      className="absolute left-1/2 top-1/2 h-full w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-red-500"
                      style={{ transform: 'translate(-50%, -50%) rotate(45deg)' }}
                    />
                  </>
                )}
              </button>
            );
          })}
        </div>
        {/* Custom color and Clear buttons */}
        {(showCustomColor || onClear) && (
          <div className="mt-2 flex items-center justify-center gap-1">
            {showCustomColor && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowCustomPicker(true)}
                className="duration-50 h-6 px-2 transition-all hover:bg-accent"
              >
                {/* Show custom color swatch if selected, otherwise show eyedropper icon */}
                {customColor ? (
                  <span
                    className={cn(
                      'mr-1.5 h-3.5 w-3.5 shrink-0 rounded-md ring-1 ring-border',
                      isCustomColor && 'ring-2 ring-ring ring-offset-1'
                    )}
                    style={{ background: customColor }}
                  />
                ) : (
                  <PaletteIcon className="mr-1 !text-sm" />
                )}
                Custom…
              </Button>
            )}
            {onClear && (
              <Button
                variant="ghost"
                type="button"
                onClick={onClear}
                className={cn('duration-50 h-6 px-2 transition-all hover:bg-accent', showClearIcon && 'relative')}
              >
                {showClearIcon && (
                  <span
                    className={cn(
                      'relative mr-1 h-3.5 w-3.5 shrink-0 rounded-md bg-white ring-1 ring-border',
                      !color && 'ring-2 ring-ring ring-offset-1'
                    )}
                  >
                    <span
                      className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rounded-sm bg-red-500"
                      style={{ transform: 'rotate(45deg) translate(-1px, 1px)' }}
                    />
                  </span>
                )}
                {clearLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
);
