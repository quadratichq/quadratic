import { CursorPosition } from '@/app/ui/menus/Toolbar/CursorPosition';
import { ZoomMenu } from '@/app/ui/menus/Toolbar/ZoomMenu';

export const Toolbar = () => {
  return (
    <div className="flex h-8 flex-shrink-0 border-b border-border">
      <CursorPosition />
      <div className="flex flex-grow items-center justify-center border-l border-r text-sm text-muted-foreground"></div>
      <ZoomMenu />
    </div>
  );
};
