import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { formulaBarExpandedAtom } from '@/app/atoms/formulaBarAtom';
import { CursorPosition } from '@/app/ui/menus/Toolbar/CursorPosition';
import { FormulaBar } from '@/app/ui/menus/Toolbar/FormulaBar/FormulaBar';
import { ZoomMenu } from '@/app/ui/menus/Toolbar/ZoomMenu';
import { memo } from 'react';
import { useRecoilValue } from 'recoil';

export const Toolbar = memo(() => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const isFormulaBarExpanded = useRecoilValue(formulaBarExpandedAtom);

  return (
    <div
      className={`hidden select-none justify-between border-b border-border md:flex ${isFormulaBarExpanded ? 'h-auto min-h-10' : 'h-10'}`}
    >
      <div className="w-48 flex-shrink-0 border-r border-border xl:w-64 2xl:w-80">
        <CursorPosition />
      </div>

      <div
        className={`no-scrollbar flex flex-1 justify-center overflow-x-scroll ${isFormulaBarExpanded ? 'items-start overflow-y-auto' : 'items-center overflow-y-hidden'}`}
      >
        {permissions.includes('FILE_EDIT') && <FormulaBar />}
      </div>

      <div className="flex items-center justify-end xl:w-64 2xl:w-80">
        <ZoomMenu />
      </div>
    </div>
  );
});
