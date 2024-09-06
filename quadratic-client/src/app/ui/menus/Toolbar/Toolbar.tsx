import { CursorPosition } from '@/app/ui/menus/Toolbar/CursorPosition';
import { FormattingBar } from '@/app/ui/menus/Toolbar/FormattingBar';
import { ZoomMenu } from '@/app/ui/menus/Toolbar/ZoomMenu';

export const Toolbar = () => {
  return (
    <div className="flex h-8 flex-shrink-0 border-b border-border">
      <div className="w-44 border-r border-border">
        <CursorPosition />
      </div>
      <FormattingBar />
      <div className="flex w-44 items-center justify-end">
        <ZoomMenu />
      </div>
    </div>
  );
};
