import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { forwardRef, KeyboardEvent, useEffect, useRef, useState } from 'react';

interface Props {
  close: () => void;
}

export const SheetSize = forwardRef<HTMLDivElement, Props>((props, ref): JSX.Element => {
  const { close } = props;

  const widthRef = useRef<HTMLInputElement | null>(null);
  const heightRef = useRef<HTMLInputElement | null>(null);

  const [size, setSize] = useState<[bigint, bigint] | undefined>();
  useEffect(() => {
    const updateSize = () => {
      setSize(sheets.sheet.sheetSize);
    };

    updateSize();
    events.on('sheetInfo', updateSize);
    return () => {
      events.off('sheetInfo', updateSize);
    };
  }, []);

  const onChange = () => {
    if (!widthRef.current || !heightRef.current) return;
    const width = parseInt(widthRef.current.value);
    const height = parseInt(heightRef.current.value);

    if (width && height && !(BigInt(width) === size?.[0] || BigInt(height) === size?.[1])) {
      quadraticCore.setSheetSize(sheets.sheet.id, width, height, false, sheets.getCursorPosition());
    }
  };

  const handleEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onChange();
      close();
    }
  };

  return (
    <div className="flex gap-2" ref={ref}>
      <div className="flex items-center gap-1">
        <Label htmlFor="width">Columns</Label>
        <Input
          ref={widthRef}
          type="number"
          min={1}
          id="width"
          className="h-5 w-20 text-right"
          height="1rem"
          defaultValue={size?.[0].toString() ?? ''}
          onChange={onChange}
          onKeyDown={handleEnter}
        />
      </div>
      <div className="flex items-center gap-1">
        <Label htmlFor="height">Rows</Label>
        <Input
          ref={heightRef}
          type="number"
          min={1}
          id="height"
          className="h-5 w-20 text-right"
          defaultValue={size?.[1].toString() ?? ''}
          onChange={onChange}
          onKeyDown={handleEnter}
        />
      </div>
    </div>
  );
});
