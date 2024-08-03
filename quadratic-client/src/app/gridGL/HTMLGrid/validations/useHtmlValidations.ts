//! Gets the current cell's validation and offsets.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';
import { useEffect, useState } from 'react';
import { validationRuleSimple, ValidationRuleSimple } from '@/app/ui/menus/Validations/Validation/validationType';
import { Validation } from '@/app/quadratic-core-types';

export interface HtmlValidationsData {
  offsets?: Rectangle;
  validation?: Validation;
  validationRuleSimple: ValidationRuleSimple;
  uiShowing: boolean;
  setUiShowing: (showing: boolean) => void;
}

export const useHtmlValidations = (): HtmlValidationsData => {
  const [uiShowing, setUiShowing] = useState(false);
  const [offsets, setOffsets] = useState<Rectangle | undefined>();
  const [validation, setValidation] = useState<Validation | undefined>();
  const [validationType, setValidationType] = useState<ValidationRuleSimple>('');

  // Change in cursor position triggers update of validation
  useEffect(() => {
    const updateCursor = async () => {
      if (sheets.sheet.cursor.multiCursor) {
        setValidation(undefined);
        setValidationType('');
        return;
      }
      const { x, y } = sheets.sheet.cursor.cursorPosition;
      const validation = await quadraticCore.getValidationFromPos(sheets.sheet.id, x, y);

      if (!validation) {
        setValidation(undefined);
        setValidationType('');
        return;
      } else {
        setValidation(validation);
        setValidationType(validationRuleSimple(validation));
      }

      // we only need offsets if validation is present
      if (validation) {
        const offsets = sheets.sheet.getCellOffsets(x, y);
        setOffsets(offsets);
      } else {
        setOffsets(undefined);
      }
    };
    updateCursor();

    events.on('cursorPosition', updateCursor);
    events.on('sheetValidations', updateCursor);
    events.on('changeSheet', updateCursor);
    events.on('sheetOffsets', updateCursor);
    events.on('resizeHeadingColumn', updateCursor);
    events.on('setCursor', updateCursor);

    return () => {
      events.off('cursorPosition', updateCursor);
      events.off('sheetValidations', updateCursor);
      events.off('changeSheet', updateCursor);
      events.off('sheetOffsets', updateCursor);
      events.off('resizeHeadingColumn', updateCursor);
      events.off('setCursor', updateCursor);
    };
  }, []);

  return {
    offsets,
    validation,
    validationRuleSimple: validationType,
    uiShowing,
    setUiShowing,
  };
};
