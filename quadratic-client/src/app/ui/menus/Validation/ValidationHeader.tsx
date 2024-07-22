import { IconButton } from '@mui/material';
import { TooltipHint } from '../../components/TooltipHint';
import { useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { Close } from '@mui/icons-material';
import { useCallback } from 'react';

export const ValidationHeader = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const close = useCallback(() => {
    setEditorInteractionState((prev) => ({
      ...prev,
      showValidation: false,
    }));
  }, [setEditorInteractionState]);

  return (
    <div className="flex items-center justify-between">
      <div className="whitespace-nowrap text-sm font-medium leading-4">Data Validation</div>
      <TooltipHint title="Close" shortcut="ESC" placement="bottom">
        <IconButton size="small" onClick={close}>
          <Close />
        </IconButton>
      </TooltipHint>
    </div>
  );
};
