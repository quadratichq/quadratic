import { IconButton } from '@mui/material';
import { TooltipHint } from '../../components/TooltipHint';
import { useSetRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { Close } from '@mui/icons-material';
import { useCallback } from 'react';
import { cn } from '@/shared/shadcn/utils';
import { ValidationData } from './useValidationData';

export const ValidationHeader = (props: { validationData: ValidationData }) => {
  const { unsaved } = props.validationData;
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);

  const close = useCallback(() => {
    setEditorInteractionState((prev) => ({
      ...prev,
      showValidation: false,
    }));
  }, [setEditorInteractionState]);

  return (
    <div className="mb-2 flex items-center justify-between border-b border-b-gray-100 pb-2">
      <div
        className={cn(
          `relative font-medium leading-4`,
          unsaved &&
            `after:pointer-events-none after:absolute after:-right-3 after:-top-0.5 after:h-3 after:w-3 after:rounded-full after:border-2 after:border-solid after:border-background after:bg-gray-400 after:content-['']`
        )}
      >
        Data Validation
      </div>
      <TooltipHint title="Close" shortcut="ESC" placement="bottom">
        <IconButton size="small" onClick={close}>
          <Close />
        </IconButton>
      </TooltipHint>
    </div>
  );
};
