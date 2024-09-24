import { aiAssistantContextAtom, aiAssistantLoadingAtom } from '@/app/atoms/aiAssistantAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { AIAssistantContextModelMenu } from '@/app/ui/menus/AIAssistant/AIAssistantSelectContextMenu';
import { useRecoilValue } from 'recoil';

export const AIAssistantContext = () => {
  const context = useRecoilValue(aiAssistantContextAtom);
  const loading = useRecoilValue(aiAssistantLoadingAtom);

  return (
    <div className={`z-10 mx-3 mt-2 flex select-none items-center gap-2 text-xs ${loading ? 'opacity-60' : ''} `}>
      <span>{'Context: '}</span>

      {!!context.codeCell && <CodeCellContext codeCell={context.codeCell} />}

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
