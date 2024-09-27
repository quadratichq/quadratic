import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { selectionToA1 } from '@/app/quadratic-rust-client/quadratic_rust_client';
import GoTo from '@/app/ui/menus/GoTo';
import { bigIntReplacer } from '@/app/web-workers/quadraticCore/worker/core';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

export const CursorPosition = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const [cursorPositionString, setCursorPositionString] = useState('');

  useEffect(() => {
    const updateCursor = () => {
      const rustSelection = sheets.sheet.cursor.getRustSelection(false);
      setCursorPositionString(selectionToA1(JSON.stringify(rustSelection, bigIntReplacer)));
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
      <PopoverTrigger className="group flex h-full w-full items-center justify-between pl-2 pr-1 text-sm hover:bg-accent focus:bg-accent focus:outline-none data-[state=open]:bg-accent">
        <span className="truncate">{cursorPositionString}</span>
        <ArrowDropDownIcon className="text-muted-foreground group-hover:text-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <GoTo />
      </PopoverContent>
    </Popover>
  );
};
