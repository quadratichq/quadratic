import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import GoTo from '@/app/ui/menus/GoTo';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

export const CursorPosition = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const [cursorPositionString, setCursorPositionString] = useState('');
  const [multiCursorPositionString, setMultiCursorPositionString] = useState('');

  useEffect(() => {
    const updateCursor = () => {
      const cursor = sheets.sheet.cursor;
      setCursorPositionString(`(${cursor.cursorPosition.x}, ${cursor.cursorPosition.y})`);
      if (cursor.multiCursor && cursor.multiCursor.length === 1) {
        const multiCursor = cursor.multiCursor[0];
        setMultiCursorPositionString(
          `(${multiCursor.left}, ${multiCursor.top}), (${multiCursor.right - 1}, ${multiCursor.bottom - 1})`
        );
      } else {
        setMultiCursorPositionString('');
      }
    };
    updateCursor();
    events.on('cursorPosition', updateCursor);
    events.on('changeSheet', updateCursor);
    return () => {
      events.off('cursorPosition', updateCursor);
      events.off('changeSheet', updateCursor);
    };
  }, []);

  return (
    <Popover
      open={editorInteractionState.showGoToMenu}
      onOpenChange={(open) => setEditorInteractionState((prev) => ({ ...prev, showGoToMenu: open }))}
    >
      <PopoverTrigger className="group flex h-full w-full items-center justify-between pl-2 pr-1 text-sm hover:bg-accent focus:bg-accent focus:outline-none">
        <span className="truncate">{multiCursorPositionString ? multiCursorPositionString : cursorPositionString}</span>
        <ArrowDropDownIcon className="text-muted-foreground group-hover:text-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <GoTo />
      </PopoverContent>
    </Popover>
  );
};
