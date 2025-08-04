import { editorInteractionStateAnnotationStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorEvents } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorEvents';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { useInlineEditorStatus } from '@/app/gridGL/HTMLGrid/inlineEditor/useInlineEditorStatus';
import type { HtmlValidationsData } from '@/app/gridGL/HTMLGrid/validations/useHtmlValidations';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

interface Props {
  htmlValidationsData: HtmlValidationsData;
}

export const HtmlValidationList = (props: Props) => {
  const { validation, offsets, location, readOnly } = props.htmlValidationsData;
  const [annotationState, setAnnotationState] = useRecoilState(editorInteractionStateAnnotationStateAtom);

  // used to track the index of the selected value (as changed via keyboard or
  // when matching when first opening the dropdown)
  const [index, setIndex] = useState<number>(-1);

  const [list, setList] = useState<string[] | undefined>();

  const listCoordinate = useRef<JsCoordinate | undefined>(undefined);

  const inlineEditorStatus = useInlineEditorStatus();
  useEffect(() => {
    // this closes the dropdown when the cursor moves except when the user
    // clicked on the dropdown in a different cells (this handles the race
    // condition between changing the cell and opening the annotation)
    if (location?.x !== listCoordinate.current?.x || location?.y !== listCoordinate.current?.y) {
      setAnnotationState(undefined);
      setList(undefined);
      setIndex(-1);
      listCoordinate.current = location ? { x: location.x, y: location.y } : undefined;
    }
  }, [location, location?.x, location?.y, setAnnotationState, validation]);

  const [filter, setFilter] = useState<string | undefined>();
  useEffect(() => {
    const updateFilter = (value: string) => {
      if (value.trim()) {
        setFilter(value);
      } else {
        setFilter(undefined);
      }
    };
    inlineEditorEvents.on('valueChanged', updateFilter);
    return () => {
      inlineEditorEvents.off('valueChanged', updateFilter);
    };
  }, []);

  useEffect(() => {
    const updateShowDropdown = async (column: number, row: number, forceOpen: boolean) => {
      // if the dropdown is already open and the user clicked on the dropdown in
      // the same cell, then close it
      if (
        !forceOpen &&
        annotationState === 'dropdown' &&
        listCoordinate.current?.x === column &&
        listCoordinate.current?.y === row
      ) {
        setAnnotationState(undefined);
        return;
      }
      listCoordinate.current = { x: column, y: row };
      const list = await quadraticCore.getValidationList(sheets.current, column, row);
      if (!list) return;
      setAnnotationState('dropdown');
      const value = await quadraticCore.getDisplayCell(sheets.current, column, row);
      setList(list);
      setIndex(list?.indexOf(value || '') ?? -1);
    };
    events.on('triggerCell', updateShowDropdown);

    const changeStatus = (opened: boolean) => {
      if (opened) {
        updateShowDropdown(sheets.sheet.cursor.position.x, sheets.sheet.cursor.position.y, true);
      }
    };
    inlineEditorEvents.on('status', changeStatus);

    return () => {
      events.off('triggerCell', updateShowDropdown);
      inlineEditorEvents.off('status', changeStatus);
    };
  }, [annotationState, list, setAnnotationState]);

  const changeValue = useCallback(
    (value: string) => {
      quadraticCore.setCellValue(
        sheets.current,
        sheets.sheet.cursor.position.x,
        sheets.sheet.cursor.position.y,
        value,
        false
      );
      setAnnotationState(undefined);
      inlineEditorHandler.close({ cancel: true });
    },
    [setAnnotationState]
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
        sheets.sheet.cursor.moveTo(
          sheets.sheet.cursor.position.x + (key === 'ArrowLeft' ? -1 : 1),
          sheets.sheet.cursor.position.y,
          { checkForTableRef: true }
        );
      } else if (key === 'Escape') {
        setAnnotationState(undefined);
      }
    };
    events.on('dropdownKeyboard', dropdownKeyboard);
    return () => {
      events.off('dropdownKeyboard', dropdownKeyboard);
    };
  }, [changeValue, index, list, setAnnotationState]);

  if (annotationState !== 'dropdown' || !offsets || !list || readOnly) return;

  return (
    <div
      className={cn(
        'border.gray-300 pointer-events-auto absolute cursor-pointer overflow-y-auto border bg-white text-gray-500',
        inlineEditorStatus ? 'mt-1' : 'mt-0'
      )}
      data-testid="validation-list"
      style={{
        top: offsets.bottom,
        left: offsets.left,
        transformOrigin: `0 0`,
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
        minWidth: offsets.width,
        maxHeight: `min(50vh, calc(${pixiApp.viewport.bottom - offsets.bottom}px))`,
      }}
    >
      <div className="pointer-up-ignore block w-full px-1">
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
