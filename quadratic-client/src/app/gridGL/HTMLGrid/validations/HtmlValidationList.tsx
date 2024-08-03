import { cn } from '@/shared/shadcn/utils';
import { HtmlValidationsData } from './useHtmlValidations';
import { useInlineEditorStatus } from '../inlineEditor/useInlineEditorStatus';
import { useCallback, useEffect, useState } from 'react';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '../inlineEditor/inlineEditorHandler';
import { events } from '@/app/events/events';
import { inlineEditorEvents } from '../inlineEditor/inlineEditorEvents';

interface Props {
  htmlValidationsData: HtmlValidationsData;
}

export const HtmlValidationList = (props: Props) => {
  const { offsets, setUiShowing, uiShowing } = props.htmlValidationsData;

  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownChoices, setDropdownChoices] = useState<string[] | undefined>();
  const [currentValue, setCurrentValue] = useState<string | undefined>();

  const inlineEditorStatus = useInlineEditorStatus();

  const clearDropdown = useCallback(() => {
    setShowDropdown(false);
    setDropdownChoices(undefined);
    setUiShowing(false);
  }, [setUiShowing]);

  useEffect(() => {
    const updateShowDropdown = async (column: number, row: number) => {
      if (showDropdown) {
        clearDropdown();
        return;
      }
      const list = await quadraticCore.getValidationList(sheets.sheet.id, column, row);
      setCurrentValue(await quadraticCore.getDisplayCell(sheets.sheet.id, column, row));
      if (list) {
        setDropdownChoices(list);
        setShowDropdown(true);
        setUiShowing(true);
      } else {
        clearDropdown();
      }
    };
    events.on('dropdown', updateShowDropdown);

    const changeStatus = (opened: boolean) => {
      if (opened) {
        updateShowDropdown(sheets.sheet.cursor.cursorPosition.x, sheets.sheet.cursor.cursorPosition.y);
      }
    };
    inlineEditorEvents.on('status', changeStatus);

    return () => {
      events.off('dropdown', updateShowDropdown);
      inlineEditorEvents.off('status', changeStatus);
    };
  }, [clearDropdown, setUiShowing, showDropdown]);

  const changeValue = useCallback(
    (value: string) => {
      quadraticCore.setCellValue(
        sheets.sheet.id,
        sheets.sheet.cursor.cursorPosition.x,
        sheets.sheet.cursor.cursorPosition.y,
        value,
        sheets.getCursorPosition()
      );
      clearDropdown();
      inlineEditorHandler.close(0, 0, true);
    },
    [clearDropdown]
  );

  if (!uiShowing || !offsets || !dropdownChoices) return;

  return (
    <div
      className={cn(
        'border.gray-300 pointer-events-auto absolute cursor-pointer border bg-white text-gray-500',
        inlineEditorStatus ? 'mt-1' : 'mt-0'
      )}
      style={{ top: offsets.bottom, left: offsets.left, minWidth: offsets.width }}
      tabIndex={0}
    >
      <div className="block w-full px-1">
        {dropdownChoices.map((item) => (
          <div
            className={cn('block w-full px-1 hover:bg-gray-100', currentValue === item ? 'bg-gray-50' : '')}
            key={item}
            onClick={() => changeValue(item)}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};
