//! Gets the current cell's validation and offsets.

import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { JsCoordinate, Validation } from '@/app/quadratic-core-types';
import type { ValidationRuleSimple } from '@/app/ui/menus/Validations/Validation/validationType';
import { validationRuleSimple } from '@/app/ui/menus/Validations/Validation/validationType';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { Rectangle } from 'pixi.js';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export interface HtmlValidationsData {
  offsets?: Rectangle;
  validation?: Validation;
  validationRuleSimple: ValidationRuleSimple;
  location?: JsCoordinate;
  readOnly: boolean;
}

export const useHtmlValidations = (): HtmlValidationsData => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const readOnly = !hasPermissionToEditFile(permissions);

  const [offsets, setOffsets] = useState<Rectangle | undefined>();
  const [validation, setValidation] = useState<Validation | undefined>();
  const [validationType, setValidationType] = useState<ValidationRuleSimple>('');
  const [location, setLocation] = useState<JsCoordinate | undefined>();

  // Change in cursor position triggers update of validation
  useEffect(() => {
    const updateCursor = async () => {
      if (sheets.sheet.cursor.isMultiCursor()) {
        setValidation(undefined);
        setValidationType('');
        return;
      }
      const { x, y } = sheets.sheet.cursor.position;
      setLocation({ x, y });
      const validation = await quadraticCore.getValidationFromPos(sheets.current, x, y);

      if (!validation) {
        setValidation(undefined);
        setValidationType('');
        setLocation(undefined);
        setOffsets(undefined);
        return;
      }

      setValidation(validation);
      setValidationType(validationRuleSimple(validation));
      setLocation({ x, y });
      const offsets = sheets.sheet.getCellOffsets(x, y);
      setOffsets(offsets);
    };

    updateCursor();

    events.on('cursorPosition', updateCursor);
    events.on('sheetValidations', updateCursor);
    events.on('changeSheet', updateCursor);
    events.on('sheetOffsetsUpdated', updateCursor);
    events.on('resizeHeadingColumn', updateCursor);
    events.on('resizeHeadingRow', updateCursor);
    events.on('setCursor', updateCursor);
    events.on('validationWarnings', updateCursor);

    return () => {
      events.off('cursorPosition', updateCursor);
      events.off('sheetValidations', updateCursor);
      events.off('changeSheet', updateCursor);
      events.off('sheetOffsetsUpdated', updateCursor);
      events.off('resizeHeadingColumn', updateCursor);
      events.off('resizeHeadingRow', updateCursor);
      events.off('setCursor', updateCursor);
      events.off('validationWarnings', updateCursor);
    };
  }, []);

  return {
    offsets,
    validation,
    validationRuleSimple: validationType,
    location,
    readOnly,
  };
};
