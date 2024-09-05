import { CursorPosition } from '@/app/ui/menus/Toolbar/CursorPosition';
import { FormattingBar } from '@/app/ui/menus/Toolbar/FormattingBar';
import { ZoomMenu } from '@/app/ui/menus/Toolbar/ZoomMenu';

export const Toolbar = () => {
  return (
    <div className="flex h-8 flex-shrink-0 border-b border-border">
      <CursorPosition />
      <FormattingBar />
      <ZoomMenu />
    </div>
  );
};
