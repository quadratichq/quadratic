import { aiAssistantContextAtom, aiAssistantLoadingAtom } from '@/app/atoms/aiAssistantAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { CursorSelectionDisplay } from '@/app/ui/components/CursorSelectionDisplay';
import { AIAssistantContextModelMenu } from '@/app/ui/menus/AIAssistant/AIAssistantSelectContextMenu';
import { useRecoilValue } from 'recoil';

export const AIAssistantContext = () => {
  const context = useRecoilValue(aiAssistantContextAtom);
  const loading = useRecoilValue(aiAssistantLoadingAtom);

  return (
    <div
      className={`z-10 mx-3 mt-2 flex select-none flex-wrap items-center gap-2 text-xs ${loading ? 'opacity-60' : ''} `}
    >
      <span>{'Context: '}</span>

      {!!context.codeCell && <CodeCellContext codeCell={context.codeCell} />}
      {!!context.cursorSelection && (
        <span>
          {'[Cursor selection: '}
          <CursorSelectionDisplay />
          {']'}
        </span>
      )}
      {!!context.currentSheet && <span>{'[Current sheet]'}</span>}
      {!!context.allSheets && <span>{'[All sheets]'}</span>}
      {!!context.connections && <span>{'[Connections]'}</span>}
      {!!context.quadraticDocs && <span>{'[Quadratic docs]'}</span>}
      <AIAssistantContextModelMenu />
    </div>
  );
};

interface CodeCellContextProps {
  codeCell: CodeCell;
}

const CodeCellContext = ({ codeCell }: CodeCellContextProps) => {
  const { sheetId, pos } = codeCell;
  const sheetName = sheets.getById(sheetId)?.name ?? '';
  return <span>{`[CodeCell: ${sheetName} (${pos.x}, ${pos.y})]`}</span>;
};
