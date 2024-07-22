/* eslint-disable @typescript-eslint/no-unused-vars */

import { Validation as ValidationRust } from '@/app/quadratic-core-types';
import { ValidationHeader } from './ValidationHeader';
import { useEffect, useState } from 'react';
import { events } from '@/app/events/events';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { sheets } from '@/app/grid/controller/Sheets';

export const Validation = () => {
  const [validation, setValidation] = useState<ValidationRust | undefined>();

  useEffect(() => {
    const changeValidation = async () => {
      const cursor = sheets.sheet.cursor;
      if (cursor.)
      const validation = await quadraticCore.getValidation()
    };
    events.on('cursorPosition', changeValidation);
    return () => {
      events.off('cursorPosition', changeValidation);
    };
  }, []);

  return (
    <div
      id="code-editor-container"
      className="border-gray relative flex h-full w-max flex-col border-l bg-background px-3 py-1"
    >
      <ValidationHeader />
    </div>
  );
};
