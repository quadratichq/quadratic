import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { ValidationMessage } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Close } from '@mui/icons-material';
import { Divider, IconButton } from '@mui/material';
import { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { inlineEditorEvents } from '../inlineEditor/inlineEditorEvents';
import { cn } from '@/shared/shadcn/utils';

export const HtmlValidations = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [hide, setHide] = useState(true);
  const [message, setMessage] = useState<ValidationMessage | undefined>();
  const [offsets, setOffsets] = useState<Rectangle | undefined>();

  const [inlineEditorOpen, setInlineEditorOpen] = useState(false);
  useEffect(() => {
    const changeStatus = (status: boolean) => setInlineEditorOpen(status);
    inlineEditorEvents.on('status', changeStatus);
    return () => {
      inlineEditorEvents.off('status', changeStatus);
    };
  }, []);

  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownChoices, setDropdownChoices] = useState<string[] | undefined>(['a', 'b', 'c']);

  const clearDropdown = useCallback(() => {
    setShowDropdown(false);
    setDropdownChoices(undefined);
  }, []);

  useEffect(() => {
    const updateShowDropdown = async (column: number, row: number) => {
      const validation = await quadraticCore.getValidationList(sheets.sheet.id, column, row);

      if (validation) {
        setDropdownChoices(validation);
      } else {
        clearDropdown();
      }
    };
    events.on('dropdown', updateShowDropdown);

    return () => {
      events.off('dropdown', updateShowDropdown);
    };
  }, [clearDropdown]);

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
        clearDropdown();
        return;
      }

      // console.log(validation);
      // todo: handle error case

      // only a List can show a dropdown
      if (!('List' in validation.rule)) {
        clearDropdown();
      }

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
    events.on('sheetOffsets', updateCursor);
    events.on('resizeHeadingColumn', updateCursor);
    events.on('setCursor', updateCursor);

    return () => {
      events.off('cursorPosition', updateCursor);
      events.off('sheetValidations', updateCursor);
      events.off('changeSheet', updateCursor);
      events.off('sheetOffsets', updateCursor);
      events.off('resizeHeadingColumn', updateCursor);
      events.off('setCursor', updateCursor);
    };
  }, [clearDropdown]);

  const changeValue = useCallback(
    (value: string) => {
      console.log('changing to value', value);
      clearDropdown();
    },
    [clearDropdown]
  );

  if (hide || !offsets || !message) return null;
  if (showDropdown && dropdownChoices) {
    return (
      <div
        ref={ref}
        className={cn(
          'border.gray-300 pointer-events-auto absolute cursor-pointer border bg-white text-gray-500',
          inlineEditorOpen ? 'mt-1' : 'mt-0'
        )}
        style={{ top: offsets.bottom, left: offsets.left, minWidth: offsets.width }}
        tabIndex={0}
      >
        <div className="block w-full px-1">
          {dropdownChoices.map((item) => (
            <div className="block w-full px-1 hover:bg-gray-100" key={item} onClick={() => changeValue(item)}>
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  } else if (message.message) {
    return (
      <div
        ref={ref}
        className={'border.gray-300 pointer-events-none absolute mt-1 border bg-white text-gray-500'}
        style={{ top: offsets.bottom, left: offsets.left + offsets.width / 2 }}
      >
        <div className="leading-2 mt- whitespace-nowrap px-2 py-1 text-xs">
          <div className="flex items-center justify-between gap-1">
            <div className="pb-2 font-medium">{message.title}</div>
            <IconButton sx={{ padding: 0 }} className="pointer-events-auto" onClick={() => setHide(true)}>
              <Close sx={{ padding: 0, width: 15, marginTop: -1 }} />
            </IconButton>
          </div>
          <Divider />
          {message.message && <div className="pb-1 pt-2 text-gray-500">{message.message}</div>}
        </div>
      </div>
    );
  }

  return null;
};
