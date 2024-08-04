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

interface Props {
  htmlValidationsData: HtmlValidationsData;
}

export const HtmlValidationList = (props: Props) => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { validation, offsets, location } = props.htmlValidationsData;
  const [value, setValue] = useState<string | undefined>();
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
  }, [location?.x, location?.y, setEditorInteractionState, validation]);

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
      setEditorInteractionState((prev) => ({ ...prev, annotationState: 'dropdown' }));
      setList(await quadraticCore.getValidationList(sheets.sheet.id, column, row));
      setValue(await quadraticCore.getDisplayCell(sheets.sheet.id, column, row));
    };
    events.on('toggleDropdown', updateShowDropdown);

    return () => {
      events.off('toggleDropdown', updateShowDropdown);
    };
  }, [editorInteractionState.annotationState, list, setEditorInteractionState]);

  // trigger the dropdown when opening the inline editor
  useEffect(() => {
    const changeStatus = (opened: boolean) => {
      if (opened) {
        setEditorInteractionState((prev) => ({ ...prev, annotationState: 'dropdown' }));
      } else {
        setEditorInteractionState((prev) => ({ ...prev, annotationState: undefined }));
      }
    };
    inlineEditorEvents.on('status', changeStatus);

    return () => {
      inlineEditorEvents.off('status', changeStatus);
    };
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

  if (editorInteractionState.annotationState !== 'dropdown' || !offsets || !list) return;

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
        {list.map((item) => (
          <div
            className={cn('block w-full px-1 hover:bg-gray-100', value === item ? 'bg-gray-50' : '')}
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
