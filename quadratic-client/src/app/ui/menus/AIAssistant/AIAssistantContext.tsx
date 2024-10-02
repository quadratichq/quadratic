import { aiAssistantContextAtom, aiAssistantLoadingAtom } from '@/app/atoms/aiAssistantAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { Selection } from '@/app/quadratic-core-types';
import { AIAssistantContextModelMenu } from '@/app/ui/menus/AIAssistant/AIAssistantSelectContextMenu';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export const AIAssistantContext = () => {
  const context = useRecoilValue(aiAssistantContextAtom);
  const loading = useRecoilValue(aiAssistantLoadingAtom);

  return (
    <div
      className={`z-10 mx-3 mt-2 flex select-none flex-wrap items-center gap-2 text-xs ${loading ? 'opacity-60' : ''} `}
    >
      <span>{'Context: '}</span>
      <CodeCellContext codeCell={context.codeCell} />
      <CursorSelectionContext selection={context.cursorSelection} />
      {!!context.visibleData && <span>{'[Visible data]'}</span>}
      {!!context.currentSheet && <span>{'[Current sheet]'}</span>}
      {!!context.allSheets && <span>{'[All sheets]'}</span>}
      {!!context.connections && <span>{'[Connections]'}</span>}
      {!!context.quadraticDocs && <span>{'[Quadratic docs]'}</span>}
      <AIAssistantContextModelMenu />
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
  return <span>{`[CodeCell: ${sheetName} (${pos.x}, ${pos.y})]`}</span>;
};

interface CursorSelectionContextProps {
  selection?: Selection;
}

const CursorSelectionContext = ({ selection }: CursorSelectionContextProps) => {
  const selectionString = useMemo(
    () =>
      selection?.rects?.map((rect) => `((${rect.min.x}, ${rect.min.y}), (${rect.max.x}, ${rect.max.y}))`).join(', '),
    [selection]
  );

  if (!selection || !selection.rects || selection.rects.length === 0) return null;

  return <span>{`[Cursor selection: ${selectionString}]`}</span>;
};
