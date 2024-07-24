/* eslint-disable @typescript-eslint/no-unused-vars */

import { Validation as ValidationRust } from '@/app/quadratic-core-types';
import { ValidationHeader } from './ValidationHeader';
import { useEffect, useState } from 'react';
import { events } from '@/app/events/events';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sheets } from '@/app/grid/controller/Sheets';
import { SheetRange } from './SheetRange';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { getSelectionRange } from '@/app/grid/sheet/selection';

export const Validation = () => {
  const [range, setRange] = useState(getSelectionRange(sheets.sheet.cursor));
  const [validation, setValidation] = useState<ValidationRust | undefined>();

  useEffect(() => {
    const changeValidation = async () => {
      setValidation(await quadraticCore.getValidation(sheets.getRustSelection()));
    };
    events.on('cursorPosition', changeValidation);
    return () => {
      events.off('cursorPosition', changeValidation);
    };
  }, []);

  return (
    <div
      className="border-gray relative flex h-full flex-col justify-between border-l bg-background px-3 py-1 text-sm"
      style={{ width: '30rem' }}
    >
      <div className="flex flex-col gap-5 overflow-y-auto">
        <ValidationHeader />
        <div>
          <Label htmlFor="validation-name">Name</Label>
          <Input id="validation-name" />
        </div>

        <SheetRange label="Apply to Range" initial={range} />
      </div>

      <div className="mx-auto my-1 flex gap-3">
        <Button variant="secondary">Cancel</Button>
        <Button>Done</Button>
      </div>
    </div>
  );
};
