import { editorInteractionStateShowGoToMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { CursorSelectionDisplay } from '@/app/ui/components/CursorSelectionDisplay';
import GoTo from '@/app/ui/menus/GoTo';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { useRecoilState } from 'recoil';

export const CursorPosition = () => {
  const [showGoToMenu, setShowGoToMenu] = useRecoilState(editorInteractionStateShowGoToMenuAtom);

  return (
    <Popover open={showGoToMenu} onOpenChange={(open) => setShowGoToMenu(open)}>
      <PopoverTrigger className="group flex h-full w-full items-center justify-between pl-2 pr-1 text-sm hover:bg-accent focus:bg-accent focus:outline-none data-[state=open]:bg-accent">
        <CursorSelectionDisplay />
        <ArrowDropDownIcon className="text-muted-foreground group-hover:text-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
        <GoTo />
      </PopoverContent>
    </Popover>
  );
};
