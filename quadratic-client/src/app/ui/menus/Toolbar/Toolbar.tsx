import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { formulaBarExpandedAtom } from '@/app/atoms/formulaBarAtom';
import { CursorPosition } from '@/app/ui/menus/Toolbar/CursorPosition';
import { FormattingBar } from '@/app/ui/menus/Toolbar/FormattingBar/FormattingBar';
import { FormulaBar } from '@/app/ui/menus/Toolbar/FormulaBar/FormulaBar';
import { ZoomMenu } from '@/app/ui/menus/Toolbar/ZoomMenu';
import { memo } from 'react';
import { useRecoilValue } from 'recoil';

export const Toolbar = memo(() => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const isFormulaBarExpanded = useRecoilValue(formulaBarExpandedAtom);

  return (
    <div className="hidden select-none border-b border-border md:block">
      {/* Formatting Bar Row */}
      <div className="flex h-10 justify-between border-b border-border">
        <div className="w-48 flex-shrink-0 xl:w-64 2xl:w-80">
          {/* Empty space to align with cursor position below */}
        </div>

        <div className="no-scrollbar flex flex-1 items-center justify-center overflow-y-hidden overflow-x-scroll">
          {permissions.includes('FILE_EDIT') && <FormattingBar />}
        </div>

        <div className="flex items-center justify-end xl:w-64 2xl:w-80">
          <ZoomMenu />
        </div>
      </div>

      {/* Formula Bar Row */}
      <div className={`flex justify-between ${isFormulaBarExpanded ? 'h-auto min-h-10' : 'h-10'}`}>
        <div className="w-48 flex-shrink-0 border-r border-border xl:w-64 2xl:w-80">
          <CursorPosition />
        </div>

        <div
          className={`no-scrollbar flex flex-1 justify-center overflow-x-scroll ${isFormulaBarExpanded ? 'items-start overflow-y-auto' : 'items-center overflow-y-hidden'}`}
        >
          {permissions.includes('FILE_EDIT') && <FormulaBar />}
        </div>

        <div className="flex items-center justify-end xl:w-64 2xl:w-80">
          {/* Empty space to align with zoom menu above */}
        </div>
      </div>
    </div>
  );
});
