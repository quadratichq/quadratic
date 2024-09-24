import { aiAssistantContextAtom, aiAssistantLoadingAtom } from '@/app/atoms/aiAssistantAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { CodeCell } from '@/app/gridGL/types/codeCell';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { AIAssistantContextModelMenu } from '@/app/ui/menus/AIAssistant/AIAssistantSelectContextMenu';
import { useRecoilValue } from 'recoil';

export const AIAssistantContext = () => {
  const context = useRecoilValue(aiAssistantContextAtom);
  const loading = useRecoilValue(aiAssistantLoadingAtom);

  return (
    <div className={`z-10 mx-3 mt-2 flex select-none items-center gap-2 text-xs ${loading ? 'opacity-60' : ''} `}>
      <span>{'Context: '}</span>

      {!!context.codeCell && <CodeCellContext {...context.codeCell.location} />}

      <AIAssistantContextModelMenu />
    </div>
  );
};

const CodeCellContext = (location: CodeCell, language: CodeCellLanguage) => {
  const { sheetId, pos } = location;
  const sheetName = sheets.getById(sheetId)?.name ?? '';
  return <span>{`[CodeCell: ${sheetName} (${pos.x}, ${pos.y})]`}</span>;
};
