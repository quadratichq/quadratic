import { editorInteractionStateShowGoToMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { useCursorPosition } from '@/app/ui/hooks/useCursorPosition';
import GoTo from '@/app/ui/menus/GoTo';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import { Input } from '@/shared/shadcn/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { memo, useCallback } from 'react';
import { useRecoilState } from 'recoil';

export const CursorPosition = memo(() => {
  const [showGoToMenu, setShowGoToMenu] = useRecoilState(editorInteractionStateShowGoToMenuAtom);
  const { cursorString } = useCursorPosition();

  const onSelect = useCallback((value: string) => {
    // If sheet, set to that
    if (sheets.nameExists(value)) {
      sheets.current = sheets.getSheetIdFromName(value);
      return;
    }

    // Otherwise, parse as a selection
    try {
      const selection = sheets.stringToSelection(value, sheets.current);
      sheets.changeSelection(selection);
    } catch (_) {
      // nothing to do if we can't parse the input
    }
  }, []);

  return (
    <div className="flex h-full items-center justify-between">
      <Input
        data-testid="cursor-position"
        value={cursorString}
        onChange={(e) => {}}
        className="h-full flex-grow rounded-none border-none shadow-none focus:bg-accent focus-visible:ring-inset"
        onFocus={(e) => e.target.select()}
      />
      <Popover open={showGoToMenu} onOpenChange={(open) => setShowGoToMenu(open)}>
        <PopoverTrigger className="group mx-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-sm hover:bg-accent focus:bg-accent focus:outline-none data-[state=open]:bg-accent">
          <ArrowDropDownIcon className="text-muted-foreground group-hover:text-foreground" />
        </PopoverTrigger>

        <PopoverContent
          alignOffset={-120}
          className="w-96 p-0"
          align="start"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <GoTo onSelect={onSelect} />
        </PopoverContent>
      </Popover>
    </div>
  );
});
