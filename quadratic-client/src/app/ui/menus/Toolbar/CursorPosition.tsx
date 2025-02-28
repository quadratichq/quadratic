import { editorInteractionStateShowGoToMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { JsTableInfo } from '@/app/quadratic-core-types';
import { getTableInfo } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { useCursorPosition } from '@/app/ui/hooks/useCursorPosition';
import GoTo from '@/app/ui/menus/GoTo';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import { Input } from '@/shared/shadcn/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

export const CursorPosition = () => {
  const [showGoToMenu, setShowGoToMenu] = useRecoilState(editorInteractionStateShowGoToMenuAtom);
  const cursorPosition = useCursorPosition();
  const [tableInfo, setTablesInfo] = useState<JsTableInfo[]>([]);

  useEffect(() => {
    const sync = () => {
      let tableInfo: JsTableInfo[] = [];
      try {
        tableInfo = getTableInfo(sheets.a1Context);
      } catch (e) {
        console.error('Error getting table info in CursorPosition.tsx', e);
      }
      tableInfo.sort((a, b) => a.name.localeCompare(b.name));
      setTablesInfo(tableInfo);
    };

    sync();

    events.on('updateCodeCell', sync);
    events.on('renderCodeCells', sync);
    return () => {
      events.off('updateCodeCell', sync);
      events.off('renderCodeCells', sync);
    };
  }, []);

  return (
    <div className="flex h-full items-center justify-between">
      <Input
        value={cursorPosition}
        onChange={(e) => {}}
        className="h-full flex-grow rounded-none border-none shadow-none focus:bg-accent focus-visible:ring-inset"
        onFocus={(e) => e.target.select()}
      />
      <Popover open={showGoToMenu} onOpenChange={(open) => setShowGoToMenu(open)}>
        <PopoverTrigger className="group flex h-full w-12 items-center justify-center text-sm hover:bg-accent focus:bg-accent focus:outline-none data-[state=open]:bg-accent">
          <ArrowDropDownIcon className="text-muted-foreground group-hover:text-foreground" />
        </PopoverTrigger>

        <PopoverContent
          alignOffset={-120}
          className="w-80 p-0"
          align="start"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <GoTo tableInfo={tableInfo} />
        </PopoverContent>
      </Popover>
    </div>
  );
};
