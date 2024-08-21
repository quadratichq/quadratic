import { IconButton } from '@mui/material';
import { TooltipHint } from '../../../components/TooltipHint';
import { useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { Close } from '@mui/icons-material';
import { useCallback, useEffect, useState } from 'react';
import { sheets } from '@/app/grid/controller/Sheets';
import { events } from '@/app/events/events';

export const ValidationsHeader = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const close = useCallback(() => {
    setEditorInteractionState((prev) => ({
      ...prev,
      showValidation: false,
    }));
  }, [setEditorInteractionState]);

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
        <IconButton size="small" onClick={close}>
          <Close />
        </IconButton>
      </TooltipHint>
    </div>
  );
};
