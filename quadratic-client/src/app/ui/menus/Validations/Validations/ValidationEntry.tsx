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
    if (validation.rule === 'None') return 'None';
    if ('List' in validation.rule) {
      if ('source' in validation.rule.List) {
        return 'List from user-defined values';
      } else if ('range' in validation.rule.List) {
        return 'List from selection';
      }
    } else if ('Checkbox' in validation.rule) {
      return 'Checkbox';
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
    <Button variant="outline" className="h-fit w-full" style={{ marginTop: -1 }} onClick={selectValidation}>
      <div className="group flex w-full items-center justify-between py-3">
        <div className="flex flex-col items-start">
          <div className="mb-2">{title}</div>
          <div className="opacity-40">{selection}</div>
        </div>
        <Button
          className="invisible px-1 group-hover:visible"
          asChild
          variant="outline-destructive"
          onClick={() => deleteValidation(validation.id)}
        >
          <span>
            <DeleteIcon />
          </span>
        </Button>
      </div>
    </Button>
  );
};
