import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { CursorPosition } from '@/app/ui/menus/Toolbar/CursorPosition';
import { FormulaBar } from '@/app/ui/menus/Toolbar/FormulaBar/FormulaBar';
import { ZoomMenu } from '@/app/ui/menus/Toolbar/ZoomMenu';
import { memo } from 'react';
import { useRecoilValue } from 'recoil';

export const Toolbar = memo(() => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);

  return (
    <div className="hidden h-10 select-none justify-between border-b border-border md:flex">
      <div className="w-48 flex-shrink-0 border-r border-border xl:w-64 2xl:w-80">
        <CursorPosition />
      </div>

      <div className="no-scrollbar flex flex-1 items-center justify-center overflow-y-hidden overflow-x-scroll">
        {permissions.includes('FILE_EDIT') && <FormulaBar />}
      </div>

      <div className="flex items-center justify-end xl:w-64 2xl:w-80">
        <ZoomMenu />
      </div>
    </div>
  );
});
