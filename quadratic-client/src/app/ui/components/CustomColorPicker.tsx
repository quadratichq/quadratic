import { hexToHsl, hexToHsv, hexToRgb, hslToHex, hsvToHex, isValidHex, rgbToHex } from '@/app/helpers/convertColor';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

interface CustomColorPickerProps {
  color?: string;
  onChange: (hex: string) => void;
  onBack: () => void;
  onClose?: () => void;
}

type ColorMode = 'hex' | 'rgb' | 'hsl';

// Clamp a number to a range
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const CustomColorPicker = ({ color, onChange, onBack, onClose }: CustomColorPickerProps) => {
  const initialHsv = color ? hexToHsv(color) : { h: 0, s: 1, v: 1 };
  const [hue, setHue] = useState(initialHsv.h);
  const [saturation, setSaturation] = useState(initialHsv.s);
  const [brightness, setBrightness] = useState(initialHsv.v);
  const [colorMode, setColorMode] = useState<ColorMode>('hex');
  const [inputError, setInputError] = useState(false);

  // Input values for each mode
  const [hexInput, setHexInput] = useState(color?.replace('#', '') || 'ff0000');
  const [rgbInput, setRgbInput] = useState({ r: '255', g: '0', b: '0' });
  const [hslInput, setHslInput] = useState({ h: '0', s: '100', l: '50' });

  const satBrightRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const isDraggingSatBright = useRef(false);
  const isDraggingHue = useRef(false);

  // Compute current color
  const currentHex = hsvToHex(hue, saturation, brightness);

  // Update all input values when color changes from sliders
  useEffect(() => {
    setHexInput(currentHex.replace('#', ''));
    const rgb = hexToRgb(currentHex);
    setRgbInput({ r: rgb.r.toString(), g: rgb.g.toString(), b: rgb.b.toString() });
    const hsl = hexToHsl(currentHex);
    setHslInput({ h: hsl.h.toString(), s: hsl.s.toString(), l: hsl.l.toString() });
    setInputError(false);
  }, [currentHex]);

  // Handle saturation/brightness area interaction
  const handleSatBrightInteraction = useCallback((clientX: number, clientY: number) => {
    if (!satBrightRef.current) return;
    const rect = satBrightRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setSaturation(x);
    setBrightness(1 - y);
  }, []);

  // Handle hue slider interaction
  const handleHueInteraction = useCallback((clientX: number) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setHue(x * 360);
  }, []);

  // Mouse/touch event handlers for saturation/brightness
  const handleSatBrightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSatBright.current = true;
    handleSatBrightInteraction(e.clientX, e.clientY);
  };

  // Mouse/touch event handlers for hue
  const handleHueMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingHue.current = true;
    handleHueInteraction(e.clientX);
  };

  // Global mouse move/up handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSatBright.current) {
        handleSatBrightInteraction(e.clientX, e.clientY);
      }
      if (isDraggingHue.current) {
        handleHueInteraction(e.clientX);
      }
    };

    const handleMouseUp = () => {
      isDraggingSatBright.current = false;
      isDraggingHue.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleSatBrightInteraction, handleHueInteraction, onChange, currentHex]);

  // Update color from hex input
  const updateFromHex = (value: string) => {
    const cleanValue = value.replace('#', '').slice(0, 6);
    setHexInput(cleanValue);

    if (isValidHex(cleanValue) && cleanValue.length === 6) {
      setInputError(false);
      const hex = `#${cleanValue}`;
      const hsv = hexToHsv(hex);
      setHue(hsv.h);
      setSaturation(hsv.s);
      setBrightness(hsv.v);
    } else if (cleanValue.length === 6) {
      setInputError(true);
    }
  };

  // Update color from RGB input
  const updateFromRgb = (component: 'r' | 'g' | 'b', value: string) => {
    const newRgb = { ...rgbInput, [component]: value };
    setRgbInput(newRgb);

    const r = parseInt(newRgb.r, 10);
    const g = parseInt(newRgb.g, 10);
    const b = parseInt(newRgb.b, 10);

    if (!isNaN(r) && !isNaN(g) && !isNaN(b) && r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
      setInputError(false);
      const hex = rgbToHex(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255));
      const hsv = hexToHsv(hex);
      setHue(hsv.h);
      setSaturation(hsv.s);
      setBrightness(hsv.v);
    } else {
      setInputError(true);
    }
  };

  // Update color from HSL input
  const updateFromHsl = (component: 'h' | 's' | 'l', value: string) => {
    const newHsl = { ...hslInput, [component]: value };
    setHslInput(newHsl);

    const h = parseInt(newHsl.h, 10);
    const s = parseInt(newHsl.s, 10);
    const l = parseInt(newHsl.l, 10);

    if (!isNaN(h) && !isNaN(s) && !isNaN(l) && h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100) {
      setInputError(false);
      const hex = hslToHex(clamp(h, 0, 360), clamp(s, 0, 100), clamp(l, 0, 100));
      const hsv = hexToHsv(hex);
      setHue(hsv.h);
      setSaturation(hsv.s);
      setBrightness(hsv.v);
    } else {
      setInputError(true);
    }
  };

  // Pure hue color for the saturation/brightness gradient background
  const pureHueColor = hsvToHex(hue, 1, 1);

  const modeButtonClass = (mode: ColorMode) =>
    cn(
      'flex-1 rounded px-2 py-0.5 text-xs font-medium transition-colors',
      colorMode === mode ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
    );

  return (
    <div className="flex w-40 flex-col gap-3 p-1">
      {/* Saturation/Brightness picker */}
      <div
        ref={satBrightRef}
        className="relative h-28 w-full cursor-crosshair overflow-hidden rounded-md border border-border"
        style={{
          background: `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, transparent),
            ${pureHueColor}
          `,
        }}
        onMouseDown={handleSatBrightMouseDown}
      >
        {/* Picker handle */}
        <div
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.2)]"
          style={{
            left: `${saturation * 100}%`,
            top: `${(1 - brightness) * 100}%`,
            backgroundColor: currentHex,
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        className="relative h-3 w-full cursor-pointer overflow-hidden rounded-md border border-border"
        style={{
          background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
        onMouseDown={handleHueMouseDown}
      >
        {/* Hue handle */}
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.2)]"
          style={{
            left: `${(hue / 360) * 100}%`,
            backgroundColor: hsvToHex(hue, 1, 1),
          }}
        />
      </div>

      {/* Color preview and inputs */}
      <div className="flex items-stretch gap-2">
        {/* Color preview */}
        <div
          className="w-8 shrink-0 rounded-md border border-border"
          style={{ backgroundColor: currentHex }}
          title={currentHex}
        />

        {/* Mode tabs and inputs */}
        <div className="flex flex-1 flex-col gap-1.5">
          {/* Color mode tabs */}
          <div className="flex rounded-md border border-border bg-muted/50 p-0.5">
            <button type="button" className={modeButtonClass('hex')} onClick={() => setColorMode('hex')}>
              Hex
            </button>
            <button type="button" className={modeButtonClass('rgb')} onClick={() => setColorMode('rgb')}>
              RGB
            </button>
            <button type="button" className={modeButtonClass('hsl')} onClick={() => setColorMode('hsl')}>
              HSL
            </button>
          </div>

          {/* Hex input */}
          {colorMode === 'hex' && (
            <div className="flex items-center">
              <span className="mr-1 text-xs text-muted-foreground">#</span>
              <Input
                value={hexInput}
                onChange={(e) => updateFromHex(e.target.value)}
                className={cn(
                  'h-7 flex-1 px-1.5 text-xs uppercase',
                  inputError && 'border-red-500 focus-visible:ring-red-500'
                )}
                maxLength={6}
                placeholder="000000"
              />
            </div>
          )}

          {/* RGB inputs */}
          {colorMode === 'rgb' && (
            <div className="flex gap-1">
              <div className="flex flex-1 flex-col">
                <span className="mb-0.5 text-center text-[10px] text-muted-foreground">R</span>
                <Input
                  value={rgbInput.r}
                  onChange={(e) => updateFromRgb('r', e.target.value)}
                  className={cn(
                    'h-6 px-1 text-center text-xs',
                    inputError && 'border-red-500 focus-visible:ring-red-500'
                  )}
                  maxLength={3}
                />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="mb-0.5 text-center text-[10px] text-muted-foreground">G</span>
                <Input
                  value={rgbInput.g}
                  onChange={(e) => updateFromRgb('g', e.target.value)}
                  className={cn(
                    'h-6 px-1 text-center text-xs',
                    inputError && 'border-red-500 focus-visible:ring-red-500'
                  )}
                  maxLength={3}
                />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="mb-0.5 text-center text-[10px] text-muted-foreground">B</span>
                <Input
                  value={rgbInput.b}
                  onChange={(e) => updateFromRgb('b', e.target.value)}
                  className={cn(
                    'h-6 px-1 text-center text-xs',
                    inputError && 'border-red-500 focus-visible:ring-red-500'
                  )}
                  maxLength={3}
                />
              </div>
            </div>
          )}

          {/* HSL inputs */}
          {colorMode === 'hsl' && (
            <div className="flex gap-1">
              <div className="flex flex-1 flex-col">
                <span className="mb-0.5 text-center text-[10px] text-muted-foreground">H</span>
                <Input
                  value={hslInput.h}
                  onChange={(e) => updateFromHsl('h', e.target.value)}
                  className={cn(
                    'h-6 px-1 text-center text-xs',
                    inputError && 'border-red-500 focus-visible:ring-red-500'
                  )}
                  maxLength={3}
                />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="mb-0.5 text-center text-[10px] text-muted-foreground">S</span>
                <Input
                  value={hslInput.s}
                  onChange={(e) => updateFromHsl('s', e.target.value)}
                  className={cn(
                    'h-6 px-1 text-center text-xs',
                    inputError && 'border-red-500 focus-visible:ring-red-500'
                  )}
                  maxLength={3}
                />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="mb-0.5 text-center text-[10px] text-muted-foreground">L</span>
                <Input
                  value={hslInput.l}
                  onChange={(e) => updateFromHsl('l', e.target.value)}
                  className={cn(
                    'h-6 px-1 text-center text-xs',
                    inputError && 'border-red-500 focus-visible:ring-red-500'
                  )}
                  maxLength={3}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1">
        <Button variant="ghost" type="button" onClick={onBack} className="h-6 flex-1 text-xs">
          Cancel
        </Button>
        <Button
          variant="default"
          type="button"
          onClick={() => {
            onChange(currentHex);
            onClose?.();
          }}
          className="h-6 flex-1 text-xs"
        >
          OK
        </Button>
      </div>
    </div>
  );
};
