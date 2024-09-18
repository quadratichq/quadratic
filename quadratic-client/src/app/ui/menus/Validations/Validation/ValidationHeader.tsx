import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { ValidationData } from '@/app/ui/menus/Validations/Validation/useValidationData';
import { cn } from '@/shared/shadcn/utils';
import { Close } from '@mui/icons-material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { IconButton } from '@mui/material';
import { useState } from 'react';
import { useSetRecoilState } from 'recoil';

export const ValidationHeader = (props: { validationData: ValidationData }) => {
  const { unsaved, sheetId } = props.validationData;
  const setShowValidation = useSetRecoilState(editorInteractionStateShowValidationAtom);

  const [sheetName] = useState(` - ${sheets.getById(sheetId)?.name}`);

  return (
    <div className="mb-2 flex items-center justify-between border-b border-b-gray-100 pb-2">
      <div className="flex items-center gap-1">
        <TooltipHint title="Back to Data Validations for the sheet" placement="bottom">
          <IconButton size="small" onClick={() => setShowValidation(true)}>
            <ArrowBackIcon />
          </IconButton>
        </TooltipHint>
        <div
          className={cn(
            `relative font-medium leading-4`,
            unsaved &&
              `after:pointer-events-none after:absolute after:-right-3 after:-top-0.5 after:h-3 after:w-3 after:rounded-full after:border-2 after:border-solid after:border-background after:bg-gray-400 after:content-['']`
          )}
        >
          Data Validation{sheetName}
        </div>
      </div>
      <TooltipHint title="Close" shortcut="ESC" placement="bottom">
        <IconButton size="small" onClick={() => setShowValidation(false)}>
          <Close />
        </IconButton>
      </TooltipHint>
    </div>
  );
};
