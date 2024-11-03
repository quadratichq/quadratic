import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { Close } from '@mui/icons-material';
import { useCallback, useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';

export const ValidationsHeader = () => {
  const setShowValidation = useSetRecoilState(editorInteractionStateShowValidationAtom);
  const [sheetName, setSheetName] = useState(` - ${sheets.sheet.name}`);

  const close = useCallback(() => {
    setShowValidation(false);
  }, [setShowValidation]);

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

      <TooltipPopover label={'Close'} shortcut="Esc" side="bottom">
        <Button onClick={close} size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
          <Close />
        </Button>
      </TooltipPopover>
    </div>
  );
};
