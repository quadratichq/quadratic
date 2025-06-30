import { editorInteractionStateShowValidationAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Validation } from '@/app/quadratic-core-types';
import { validationRuleSimple } from '@/app/ui/menus/Validations/Validation/validationType';
import type { ValidationsData } from '@/app/ui/menus/Validations/Validations/useValidationsData';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCallback, useMemo } from 'react';
import { useSetRecoilState } from 'recoil';

interface Props {
  validation: Validation;
  validationsData: ValidationsData;
  highlight: boolean;
  active: boolean;
}

export const validationText = (validation: Validation) => {
  if (validation.rule === 'None') {
    return 'Message only';
  }
  if ('List' in validation.rule) {
    const dropdown = validation.rule.List.drop_down ? ' (Dropdown)' : '';
    if ('List' in validation.rule.List.source) {
      return `List from values${dropdown}`;
    } else if ('Selection' in validation.rule.List.source) {
      return `List from selection${dropdown}`;
    }
  } else if ('Logical' in validation.rule) {
    return `Logical${validation.rule.Logical.show_checkbox ? ' (Checkbox)' : ''}`;
  } else if ('Text' in validation.rule) {
    return 'Text';
  } else if ('Number' in validation.rule) {
    return 'Number';
  } else if ('DateTime' in validation.rule) {
    return 'Date and time';
  }
  throw new Error(`Unknown validation type: ${validationRuleSimple(validation)}`);
};

export const ValidationEntry = (props: Props) => {
  const setShowValidation = useSetRecoilState(editorInteractionStateShowValidationAtom);
  const { validation, validationsData, highlight, active } = props;
  const { deleteValidation, readOnly } = validationsData;

  const title = useMemo(() => validationText(validation), [validation]);

  const selection = useMemo(() => {
    const jsSelection = sheets.A1SelectionToJsSelection(validation.selection);
    const a1String = jsSelection.toA1String(sheets.current, sheets.jsA1Context);
    jsSelection.free();
    return a1String;
  }, [validation.selection]);

  const selectValidation = useCallback(() => {
    setShowValidation(validation.id);
  }, [setShowValidation, validation.id]);

  const handleDeleteValidation = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      deleteValidation(validation.id);
    },
    [deleteValidation, validation.id]
  );

  const ref = useCallback(
    (node: HTMLButtonElement) => {
      if (active) {
        node?.scrollIntoView({ block: 'center' });
      }
    },
    [active]
  );

  return (
    <Button
      ref={ref}
      variant="ghost"
      className={cn('h-fit w-full border-b border-gray-100', highlight ? 'bg-gray-50' : '')}
      onClick={selectValidation}
    >
      <div className="group flex w-full items-center justify-between py-2">
        <div className="flex shrink flex-col items-start text-left">
          <div className="mb-2">{title}</div>
          <div className="opacity-40">{selection}</div>
        </div>
        {!readOnly && (
          <Button
            className="invisible px-1 hover:bg-white group-hover:visible"
            asChild
            variant="outline"
            onClick={handleDeleteValidation}
          >
            <span>
              <DeleteIcon className="text-gray-400" />
            </span>
          </Button>
        )}
      </div>
    </Button>
  );
};
