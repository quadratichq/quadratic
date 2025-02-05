import { editorInteractionStateShowGoToMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useCursorPosition } from '@/app/ui/hooks/useCursorPosition';
import GoTo from '@/app/ui/menus/GoTo';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import { Input } from '@/shared/shadcn/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { useRecoilState } from 'recoil';

export const CursorPosition = () => {
  const [showGoToMenu, setShowGoToMenu] = useRecoilState(editorInteractionStateShowGoToMenuAtom);
  const cursorPosition = useCursorPosition();
  return (
    <div className="flex h-full items-center justify-between">
      <Input
        value={cursorPosition}
        className="h-full flex-grow rounded-none border-none shadow-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-0"
        onFocus={(e) => e.target.select()}
      />
      <Popover open={showGoToMenu} onOpenChange={(open) => setShowGoToMenu(open)}>
        <PopoverTrigger className="group flex h-full w-12 items-center justify-center text-sm hover:bg-accent focus:bg-accent focus:outline-none data-[state=open]:bg-accent">
          <ArrowDropDownIcon className="text-muted-foreground group-hover:text-foreground" />
        </PopoverTrigger>

        <PopoverContent className="w-80 p-0" align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
          <GoTo />
        </PopoverContent>
      </Popover>
    </div>
  );
};
