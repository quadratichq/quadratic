import { cn } from '@/shared/shadcn/utils';
import { HtmlValidationsData } from './useHtmlValidations';
import { useInlineEditorStatus } from '../inlineEditor/useInlineEditorStatus';
import { useCallback, useEffect, useRef, useState } from 'react';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '../inlineEditor/inlineEditorHandler';
import { events } from '@/app/events/events';
import { inlineEditorEvents } from '../inlineEditor/inlineEditorEvents';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { Coordinate } from '../../types/size';
import { pixiApp } from '../../pixiApp/PixiApp';

interface Props {
  htmlValidationsData: HtmlValidationsData;
}

export const HtmlValidationList = (props: Props) => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { validation, offsets, location, readOnly } = props.htmlValidationsData;

  // used to track the index of the selected value (as changed via keyboard or
  // when matching when first opening the dropdown)
  const [index, setIndex] = useState<number>(-1);

  const [list, setList] = useState<string[] | undefined>();

  const listCoordinate = useRef<Coordinate | undefined>();

  const inlineEditorStatus = useInlineEditorStatus();

  useEffect(() => {
    // this closes the dropdown when the cursor moves except when the user
    // clicked on the dropdown in a different cells (this handles the race
    // condition between changing the cell and opening the annotation)
    if (location?.x !== listCoordinate.current?.x && location?.y !== listCoordinate.current?.y) {
      setEditorInteractionState((prev) => ({ ...prev, annotationState: undefined }));
    }
  }, [location, location?.x, location?.y, setEditorInteractionState, validation]);

  const [filter, setFilter] = useState<string | undefined>();
  useEffect(() => {
    inlineEditorEvents.on('valueChanged', (value) => {
      if (value.trim()) {
        setFilter(value);
      } else {
        setFilter(undefined);
      }
    });
  }, []);

  useEffect(() => {
    const updateShowDropdown = async (column: number, row: number, forceOpen: boolean) => {
      // if the dropdown is already open and the user clicked on the dropdown in
      // the same cell, then close it
      if (
        !forceOpen &&
        editorInteractionState.annotationState === 'dropdown' &&
        listCoordinate.current?.x === column &&
        listCoordinate.current?.y === row
      ) {
        setEditorInteractionState((prev) => ({ ...prev, annotationState: undefined }));
        return;
      }
      listCoordinate.current = { x: column, y: row };
      const list = await quadraticCore.getValidationList(sheets.sheet.id, column, row);
      if (!list) return;
      setEditorInteractionState((prev) => ({ ...prev, annotationState: 'dropdown' }));
      const value = await quadraticCore.getDisplayCell(sheets.sheet.id, column, row);
      setList(list);
      setIndex(list?.indexOf(value || '') ?? -1);
    };
    events.on('triggerCell', updateShowDropdown);

    const changeStatus = (opened: boolean) => {
      if (opened) {
        updateShowDropdown(sheets.sheet.cursor.cursorPosition.x, sheets.sheet.cursor.cursorPosition.y, true);
      }
    };
    inlineEditorEvents.on('status', changeStatus);

    return () => {
      events.off('triggerCell', updateShowDropdown);
      inlineEditorEvents.off('status', changeStatus);
    };
  }, [editorInteractionState.annotationState, list, setEditorInteractionState]);

  // trigger the dropdown when opening the inline editor
  useEffect(() => {
    return () => {};
  }, [setEditorInteractionState]);

  const changeValue = useCallback(
    (value: string) => {
      quadraticCore.setCellValue(
        sheets.sheet.id,
        sheets.sheet.cursor.cursorPosition.x,
        sheets.sheet.cursor.cursorPosition.y,
        value,
        sheets.getCursorPosition()
      );
      setEditorInteractionState((prev) => ({ ...prev, annotationState: undefined }));
      inlineEditorHandler.close(0, 0, true);
    },
    [setEditorInteractionState]
  );

  // handle keyboard events when list is open
  useEffect(() => {
    const dropdownKeyboard = (key: 'ArrowDown' | 'ArrowUp' | 'ArrowLeft' | 'ArrowRight' | 'Enter' | 'Escape') => {
      if (!list) return;

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        setIndex((index) => {
          const i = key === 'ArrowDown' ? (index + 1) % list.length : (index - 1 + list.length) % list.length;
          if (inlineEditorHandler.isOpen()) {
            inlineEditorEvents.emit('replaceText', list[i], true);
          }
          return i;
        });
      } else if (key === 'Enter') {
        if (index >= 0) {
          changeValue(list[index]);
        }
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        changeValue(list[index]);
        sheets.sheet.cursor.changePosition({
          cursorPosition: {
            x: sheets.sheet.cursor.cursorPosition.x + (key === 'ArrowLeft' ? -1 : 1),
            y: sheets.sheet.cursor.cursorPosition.y,
          },
        });
      } else if (key === 'Escape') {
        setEditorInteractionState((prev) => ({ ...prev, annotationState: undefined }));
      }
    };
    events.on('dropdownKeyboard', dropdownKeyboard);
    return () => {
      events.off('dropdownKeyboard', dropdownKeyboard);
    };
  }, [changeValue, index, list, setEditorInteractionState]);

  if (editorInteractionState.annotationState !== 'dropdown' || !offsets || !list || readOnly) return;

  const viewportBottom = pixiApp.viewport.bottom;

  return (
    <div
      className={cn(
        'border.gray-300 pointer-events-auto absolute cursor-pointer overflow-y-auto border bg-white text-gray-500',
        inlineEditorStatus ? 'mt-1' : 'mt-0'
      )}
      style={{
        top: offsets.bottom,
        left: offsets.left,
        minWidth: offsets.width,
        maxHeight: `min(50vh, calc(${viewportBottom - offsets.bottom}px))`,
      }}
    >
      <div className="block w-full px-1">
        {list
          .filter((item) => {
            if (!filter) return true;
            return item.toLowerCase().includes(filter.toLowerCase());
          })
          .map((item, i) => (
            <div
              className={cn('block w-full whitespace-nowrap px-1 hover:bg-gray-100', index === i ? 'bg-gray-100' : '')}
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
