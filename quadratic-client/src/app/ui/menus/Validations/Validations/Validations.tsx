import { Button } from '@/shared/shadcn/ui/button';
import { useValidationsData } from './useValidationsData';
import { ValidationsHeader } from './ValidationsHeader';
import { ValidationEntry } from './ValidationEntry';
import { useCallback } from 'react';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useSetRecoilState } from 'recoil';

export const Validations = () => {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const validationsData = useValidationsData();
  const { validations } = validationsData;

  const addValidation = useCallback(() => {
    setEditorInteractionState((old) => ({
      ...old,
      showValidation: 'new',
    }));
  }, [setEditorInteractionState]);

  return (
    <div
      className="border-gray relative flex h-full flex-col border-l bg-background px-3 py-1 text-sm"
      style={{ width: '30rem' }}
    >
      <ValidationsHeader />

      <div className="grow">
        {validations.map((validation) => (
          <ValidationEntry key={validation.id} validation={validation} validationsData={validationsData} />
        ))}
      </div>

      <div className="mt-3 flex w-full border-t border-t-gray-100 pt-2">
        <div className="mx-auto my-1 flex gap-3">
          <Button variant="secondary">Remove All</Button>
          <Button onClick={addValidation}>Add Validation</Button>
        </div>
      </div>
    </div>
  );
};
