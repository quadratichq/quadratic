import { editorInteractionStateShowGoToMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { selectionToA1 } from '@/app/quadratic-rust-client/quadratic_rust_client';
import GoTo from '@/app/ui/menus/GoTo';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

export const CursorPosition = () => {
  const [showGoToMenu, setShowGoToMenu] = useRecoilState(editorInteractionStateShowGoToMenuAtom);
  const [cursorPositionString, setCursorPositionString] = useState('');

  useEffect(() => {
    const updateCursor = () => {
      try {
        setCursorPositionString(
          selectionToA1(sheets.getRustSelectionStringified(), sheets.sheet.id, sheets.getRustSheetMap())
        );
      } catch (e) {
        console.log(e);
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
    <Popover open={showGoToMenu} onOpenChange={(open) => setShowGoToMenu(open)}>
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
