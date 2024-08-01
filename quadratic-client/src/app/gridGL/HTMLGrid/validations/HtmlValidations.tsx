import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { ValidationMessage } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Divider } from '@mui/material';
import { Rectangle } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';

export const HtmlValidations = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [hide, setHide] = useState(true);
  const [message, setMessage] = useState<ValidationMessage | undefined>();
  const [offsets, setOffsets] = useState<Rectangle | undefined>();

  useEffect(() => {
    const updateCursor = async () => {
      if (sheets.sheet.cursor.multiCursor) {
        setHide(true);
        return;
      }
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      const validation = await quadraticCore.getValidationFromPos(sheets.sheet.id, x, y);

      if (!validation) {
        setHide(true);
        return;
      }
      // console.log(validation);
      // todo: handle error case

      if (validation.message?.show && validation.message?.message) {
        setMessage(validation.message);
        setHide(false);
      } else {
        setHide(true);
        return;
      }

      const offsets = sheets.sheet.getCellOffsets(x, y);
      setOffsets(offsets);
    };
    updateCursor();

    events.on('cursorPosition', updateCursor);
    events.on('sheetValidations', updateCursor);
    events.on('changeSheet', updateCursor);
    //   events.on('setCursor', updateCursor);
    //   events.on('cursorPosition', updateCursor);
    //   events.on('sheetOffsets', updateCursor);
    //   events.on('resizeHeadingColumn', updateCursor);
    return () => {
      //     events.off('setCursor', updateCursor);
      events.off('cursorPosition', updateCursor);
      events.off('changeSheet', updateCursor);
      //     events.off('cursorPosition', updateCursor);
      //     events.off('sheetOffsets', updateCursor);
      //     events.off('resizeHeadingColumn', updateCursor);
    };
  }, []);

  if (hide || !offsets || !message) return null;
  const top = offsets.bottom;
  const left = offsets.left + offsets.width / 2;

  return (
    <div
      ref={ref}
      className="border.gray-300 pointer-events-none absolute mt-1 whitespace-nowrap border bg-white p-2 text-xs leading-3 text-gray-500"
      style={{ top, left }}
    >
      <div className="pb-2 font-medium">{message.title}</div>
      {message.message && <Divider />}
      {message.message && <div className="pt-2 text-gray-500">{message.message}</div>}
    </div>
  );
};
