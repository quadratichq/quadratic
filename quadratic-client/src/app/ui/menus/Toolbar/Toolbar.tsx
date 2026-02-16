import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { isEmbed } from '@/app/helpers/isEmbed';
import { CursorPosition } from '@/app/ui/menus/Toolbar/CursorPosition';
import { FormattingBar } from '@/app/ui/menus/Toolbar/FormattingBar/FormattingBar';
import { ZoomMenu } from '@/app/ui/menus/Toolbar/ZoomMenu';
import { cn } from '@/shared/shadcn/utils';
import { memo } from 'react';
import { useRecoilValue } from 'recoil';

export const Toolbar = memo(() => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const canEdit = permissions.includes('FILE_EDIT');

  return (
    <div
      className={cn(
        'pointer-up-ignore h-10 select-none justify-between border-b border-border',
        // In embed mode, always show the toolbar (FormattingBar handles overflow with more menu)
        // In regular mode, hide on small screens
        isEmbed ? 'flex' : 'hidden md:flex'
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 border-r border-border',
          // In embed mode, hide CursorPosition on very small screens to give more space to FormattingBar.
          // In the app, grow at xl/2xl to align with the sidebar.
          isEmbed ? 'hidden w-32 sm:block sm:w-48' : 'w-48 xl:w-64 2xl:w-80'
        )}
      >
        <CursorPosition />
      </div>

      <div className="no-scrollbar flex min-w-0 flex-1 items-center justify-center overflow-hidden">
        {canEdit && <FormattingBar />}
      </div>

      <div
        className={cn(
          'flex items-center justify-end',
          // In embed mode, hide ZoomMenu on very small screens to give more space to FormattingBar.
          // In the app, grow at xl/2xl to align with the sidebar.
          isEmbed ? 'hidden sm:flex' : 'xl:w-64 2xl:w-80'
        )}
      >
        <ZoomMenu />
      </div>
    </div>
  );
});
