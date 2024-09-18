import { aiAssistantContextAtom, ContextType } from '@/app/atoms/aiAssistantAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { useRecoilValue } from 'recoil';

export const AIAssistantContext = () => {
  const context = useRecoilValue(aiAssistantContextAtom);
  if (context?.type === ContextType.CodeCell) {
    const { sheetId, pos } = context;
    const sheetName = sheets.getById(sheetId)?.name ?? '';
    return (
      <div className="z-10 mx-3 mt-2 text-xs">
        <span>{`Context: [CodeCell: ${sheetName} (${pos.x}, ${pos.y})]`}</span>
      </div>
    );
  }
  return null;
};
