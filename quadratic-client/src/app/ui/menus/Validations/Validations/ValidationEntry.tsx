import { getSelectionString } from '@/app/grid/sheet/selection';
import { Validation } from '@/app/quadratic-core-types';
import { Button } from '@/shared/shadcn/ui/button';
import { useCallback, useMemo } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';

import { ValidationsData } from './useValidationsData';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useSetRecoilState } from 'recoil';

interface Props {
  validation: Validation;
  validationsData: ValidationsData;
}

export const ValidationEntry = (props: Props) => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const { validation, validationsData } = props;
  const { deleteValidation } = validationsData;

  const title = useMemo(() => {
    if ('List' in validation.rule) {
      const type = validation.rule.List.drop_down ? 'Dropdown' : 'Value';
      if ('List' in validation.rule.List.source) {
        return `${type} from user-defined list`;
      } else if ('Selection' in validation.rule.List.source) {
        return `${type} from selection`;
      }
    } else if ('Checkbox' in validation.rule) {
      return 'Logical';
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
    <Button variant="ghost" className="h-fit w-full border-b border-gray-100" onClick={selectValidation}>
      <div className="group flex w-full items-center justify-between py-3">
        <div className="flex shrink flex-col items-start text-left">
          <div className="mb-2">{title}</div>
          <div className="opacity-40">{selection}</div>
        </div>
        <Button
          className="invisible px-1 group-hover:visible"
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
