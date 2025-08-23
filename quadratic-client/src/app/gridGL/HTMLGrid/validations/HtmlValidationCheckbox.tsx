import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { HtmlValidationsData } from '@/app/gridGL/HTMLGrid/validations/useHtmlValidations';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useEffect } from 'react';

interface Props {
  htmlValidationsData: HtmlValidationsData;
}

export const HtmlValidationCheckbox = (props: Props) => {
  const { validation, location } = props.htmlValidationsData;

  useEffect(() => {
    const triggerCell = async (column: number, row: number) => {
      if (!validation) return;
      if (!location || location.x !== column || location.y !== row) return;
      if (validation.rule !== 'None' && 'Logical' in validation.rule) {
        const value = await quadraticCore.getDisplayCell(sheets.current, column, row);
        quadraticCore.setCellValue(sheets.current, column, row, value === 'true' ? 'false' : 'true', false);
      }
    };
    events.on('triggerCell', triggerCell);

    return () => {
      events.off('triggerCell', triggerCell);
    };
  }, [location, validation]);

  return null;
};
