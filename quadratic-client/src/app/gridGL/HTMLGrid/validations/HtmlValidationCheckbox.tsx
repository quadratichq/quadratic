import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { HtmlValidationsData } from '@/app/gridGL/HTMLGrid/validations/useHtmlValidations';
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
        const value = await quadraticCore.getDisplayCell(sheets.sheet.id, column, row);
        quadraticCore.setCellValue(
          sheets.sheet.id,
          column,
          row,
          value === 'true' ? 'false' : 'true',
          sheets.getCursorPosition()
        );
      }
    };
    events.on('triggerCell', triggerCell);

    return () => {
      events.off('triggerCell', triggerCell);
    };
  }, [location, validation]);

  return null;
};
