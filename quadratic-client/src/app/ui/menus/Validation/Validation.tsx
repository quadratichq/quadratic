/* eslint-disable @typescript-eslint/no-unused-vars */

import { ValidationHeader } from './ValidationHeader';
import { SheetRange } from './SheetRange';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { useValidationData } from './useValidationData';
import { ValidationCriteria } from './ValidationCriteria';
import { useMemo } from 'react';
import { ValidationList } from './ValidationList';

export const Validation = () => {
  const validationData = useValidationData();
  const { validation, rule } = validationData;

  const changeName = (name: string) => {
    validationData.setValidation((old) => {
      if (old) {
        return { ...old, name };
      }
    });
  };

  const validationParameters: JSX.Element | null = useMemo(() => {
    switch (rule) {
      case 'list':
        return <ValidationList validationData={validationData} />;
    }
    return null;
  }, [rule, validationData]);

  return (
    <div
      className="border-gray relative flex h-full flex-col justify-between border-l bg-background px-3 py-1 text-sm"
      style={{ width: '30rem' }}
    >
      <div className="flex flex-col gap-5 overflow-y-auto">
        <ValidationHeader />
        <div>
          <Label htmlFor="validation-name">Name</Label>
          <Input
            id="validation-name"
            value={validationData.validation?.name || ''}
            onChange={(e) => changeName(e.currentTarget.value)}
          />
        </div>

        <SheetRange label="Apply to Range" initial={validationData.range} />
        <ValidationCriteria validationData={validationData} />
        {validationParameters}
      </div>

      <div className="mx-auto my-1 flex gap-3">
        <Button variant="secondary">Cancel</Button>
        <Button>Done</Button>
      </div>
    </div>
  );
};
