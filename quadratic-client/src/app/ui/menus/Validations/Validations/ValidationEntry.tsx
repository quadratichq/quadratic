import { getSelectionString } from '@/app/grid/sheet/selection';
import { Validation } from '@/app/quadratic-core-types';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useMemo } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';

import { ValidationsData } from './useValidationsData';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useSetRecoilState } from 'recoil';
import { cn } from '@/shared/shadcn/utils';

interface Props {
  validation: Validation;
  validationsData: ValidationsData;
  highlight: boolean;
}

export const ValidationEntry = (props: Props) => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const { validation, validationsData, highlight } = props;
  const { deleteValidation } = validationsData;

  const title = useMemo(() => {
    if ('List' in validation.rule) {
      const type = validation.rule.List.drop_down ? 'Dropdown' : 'Value';
      if ('List' in validation.rule.List.source) {
        return `${type} from user-defined list`;
      } else if ('Selection' in validation.rule.List.source) {
        return `${type} from selection`;
      }
    } else if ('Logical' in validation.rule) {
      return `Logical${validation.rule.Logical.show_checkbox ? ' (Checkbox)' : ''}`;
    }
    return 'Unknown';
  }, [validation]);

  const selection = useMemo(() => getSelectionString(validation.selection), [validation.selection]);

  const selectValidation = useCallback(() => {
    setEditorInteractionState((old) => ({
      ...old,
      showValidation: validation.id,
    }));
  }, [setEditorInteractionState, validation.id]);
  return (
    <Button
      variant="ghost"
      className={cn('h-fit w-full border-b border-gray-100', highlight ? 'bg-gray-300' : '')}
      onClick={selectValidation}
    >
      <div className="group flex w-full items-center justify-between py-3">
        <div className="flex shrink flex-col items-start text-left">
          <div className="mb-2">{title}</div>
          <div className="opacity-40">{selection}</div>
        </div>
        <Button
          className="invisible px-1 hover:bg-white group-hover:visible"
          asChild
          variant="outline"
          onClick={(e) => {
            deleteValidation(validation.id);
            e.stopPropagation();
          }}
        >
          <span>
            <DeleteIcon className="text-gray-400" />
          </span>
        </Button>
      </div>
    </Button>
  );
};
