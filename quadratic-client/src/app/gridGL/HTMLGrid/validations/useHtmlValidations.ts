//! Gets the current cell's validation and offsets.

import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { ErrorValidation } from '@/app/gridGL/cells/CellsSheet';
import type { EditingCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import type { JsCoordinate, JsRenderCodeCell, Validation } from '@/app/quadratic-core-types';
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
  const [hoverCell, setHoverCell] = useState(false);

  useEffect(() => {
    const updateHoverCell = (cell?: JsRenderCodeCell | EditingCell | ErrorValidation) => setHoverCell(!!cell);
    events.on('hoverCell', updateHoverCell);
    return () => {
      events.off('hoverCell', updateHoverCell);
    };
  }, []);

  // Change in cursor position triggers update of validation
  useEffect(() => {
    const updateCursor = async () => {
      if (hoverCell || sheets.sheet.cursor.isMultiCursor()) {
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

      // Check if the cell is part of a merged cell and use the full merged cell rect
      const mergeRect = sheets.sheet.getMergeCellRect(x, y);
      let offsets;
      if (mergeRect) {
        offsets = sheets.sheet.getScreenRectangle(
          Number(mergeRect.min.x),
          Number(mergeRect.min.y),
          Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
          Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
        );
      } else {
        offsets = sheets.sheet.getCellOffsets(x, y);
      }
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
    events.on('mergeCells', updateCursor);

    return () => {
      events.off('cursorPosition', updateCursor);
      events.off('sheetValidations', updateCursor);
      events.off('changeSheet', updateCursor);
      events.off('sheetOffsetsUpdated', updateCursor);
      events.off('resizeHeadingColumn', updateCursor);
      events.off('resizeHeadingRow', updateCursor);
      events.off('setCursor', updateCursor);
      events.off('validationWarnings', updateCursor);
      events.off('mergeCells', updateCursor);
    };
  }, [hoverCell]);

  return {
    offsets,
    validation,
    validationRuleSimple: validationType,
    location,
    readOnly,
  };
};
