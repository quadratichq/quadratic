import { aiAssistantContextAtom, aiAssistantLoadingAtom, CodeCell } from '@/app/atoms/aiAssistantAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { AIAssistantContextModelMenu } from '@/app/ui/menus/AIAssistant/AIAssistantSelectContextMenu';
import { useRecoilValue } from 'recoil';

export const AIAssistantContext = () => {
  const context = useRecoilValue(aiAssistantContextAtom);
  const loading = useRecoilValue(aiAssistantLoadingAtom);

  return (
    <div className={`z-10 mx-3 mt-2 flex select-none items-center gap-2 text-xs ${loading ? 'opacity-60' : ''} `}>
      <span>{'Context: '}</span>

      {!!context.codeCell && <CodeCellContext {...context.codeCell} />}

      <AIAssistantContextModelMenu />
    </div>
  );
};

const CodeCellContext = (context: CodeCell) => {
  const { sheetId, pos } = context;
  const sheetName = sheets.getById(sheetId)?.name ?? '';
  return <span>{`[CodeCell: ${sheetName} (${pos.x}, ${pos.y})]`}</span>;
};
