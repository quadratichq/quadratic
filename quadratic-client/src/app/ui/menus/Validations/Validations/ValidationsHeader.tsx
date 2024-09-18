import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { Close } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';

export const ValidationsHeader = () => {
  const setShowValidation = useSetRecoilState(editorInteractionStateShowValidationAtom);

  const [sheetName, setSheetName] = useState(` - ${sheets.sheet.name}`);
  useEffect(() => {
    const updateSheetName = () => setSheetName(` - ${sheets.sheet.name}`);
    events.on('changeSheet', updateSheetName);
    return () => {
      events.off('changeSheet', updateSheetName);
    };
  }, []);

  return (
    <div className="mb-2 flex items-center justify-between border-b border-b-gray-100 pb-2">
      <div className="relative font-medium leading-4">Data Validations{sheetName}</div>
      <TooltipHint title="Close" shortcut="ESC" placement="bottom">
        <IconButton size="small" onClick={() => setShowValidation(false)}>
          <Close />
        </IconButton>
      </TooltipHint>
    </div>
  );
};
