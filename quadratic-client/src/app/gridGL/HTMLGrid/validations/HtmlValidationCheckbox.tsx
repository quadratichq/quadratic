import { useEffect } from 'react';
import { HtmlValidationsData } from './useHtmlValidations';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

interface Props {
  htmlValidationsData: HtmlValidationsData;
}

export const HtmlValidationCheckbox = (props: Props) => {
  const { validation } = props.htmlValidationsData;

  useEffect(() => {
    const triggerCell = async (column: number, row: number, forceOpen: boolean) => {
      if (!validation) return;
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
  }, [validation]);

  return null;
};
