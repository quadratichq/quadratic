import { aiAnalystContextAtom, aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { SheetRect } from '@/app/quadratic-core-types';
import { AIAnalystSelectContextMenu } from '@/app/ui/menus/AIAnalyst/AIAnalystSelectContextMenu';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export const AIAnalystContext = ({ onClick }: { onClick?: (e: React.MouseEvent) => void }) => {
  const context = useRecoilValue(aiAnalystContextAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);

  return (
    <div
      className={`z-10 mx-2 mt-2 flex select-none flex-wrap items-center gap-2 text-xs ${loading ? 'opacity-60' : ''} `}
      onClick={onClick}
    >
      <AIAnalystSelectContextMenu />

      <CodeCellContext codeCell={context.codeCell} />

      <SelectionContext sheetRect={context.selection} />

      {!!context.visibleData && <span>{'[Visible data]'}</span>}

      {!!context.currentSheet && <span>{'[Current sheet]'}</span>}

      {!!context.allSheets && <span>{'[All sheets]'}</span>}

      {!!context.connections && <span>{'[Connections]'}</span>}

      {!!context.quadraticDocs && <span>{'[Quadratic docs]'}</span>}
    </div>
  );
};

interface CodeCellContextProps {
  codeCell?: CodeCell;
}

const CodeCellContext = ({ codeCell }: CodeCellContextProps) => {
  if (!codeCell) return null;
  const { sheetId, pos } = codeCell;
  const sheetName = sheets.getById(sheetId)?.name ?? '';
  return <span>{`[CodeCell (${codeCell.language}): ${sheetName} (${pos.x}, ${pos.y})]`}</span>;
};

interface SelectionContextProps {
  sheetRect?: SheetRect;
}

const SelectionContext = ({ sheetRect }: SelectionContextProps) => {
  const selectionString = useMemo(
    () => (sheetRect ? `((${sheetRect.min.x}, ${sheetRect.min.y}), (${sheetRect.max.x}, ${sheetRect.max.y}))` : ''),
    [sheetRect]
  );

  if (!sheetRect || !selectionString) return null;

  return <span>{`[Selection: ${selectionString}]`}</span>;
};