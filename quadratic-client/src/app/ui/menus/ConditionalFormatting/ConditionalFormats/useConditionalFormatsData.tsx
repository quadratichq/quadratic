import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { ConditionalFormatClient } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export interface ConditionalFormatsData {
  sheetId: string;
  conditionalFormats: ConditionalFormatClient[];
  deleteConditionalFormat: (conditionalFormatId: string) => void;
  removeAllConditionalFormats: () => void;
  readOnly: boolean;
}

export const useConditionalFormatsData = (): ConditionalFormatsData => {
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const readOnly = !hasPermissionToEditFile(permissions);

  const [sheetId, setSheetId] = useState(sheets.current);
  useEffect(() => {
    const updateSheet = () => {
      setSheetId((current: string) => {
        if (current !== sheets.current) {
          setConditionalFormats([...sheets.sheet.conditionalFormats]);
          return sheets.current;
        }
        return current;
      });
    };
    events.on('changeSheet', updateSheet);
    return () => {
      events.off('changeSheet', updateSheet);
    };
  });

  // we make a copy of conditionalFormats from sheet so we can delete pending ones
  // without affecting the sheet.
  const [conditionalFormats, setConditionalFormats] = useState([...sheets.sheet.conditionalFormats]);
  useEffect(() => {
    const updateConditionalFormats = (cfSheetId: string, sheetConditionalFormats: ConditionalFormatClient[]) => {
      if (cfSheetId === sheetId) {
        setConditionalFormats(sheetConditionalFormats);
      }
    };
    events.on('sheetConditionalFormats', updateConditionalFormats);
    return () => {
      events.off('sheetConditionalFormats', updateConditionalFormats);
    };
  }, [sheetId]);

  const deleteConditionalFormat = useCallback(
    (conditionalFormatId: string) => {
      quadraticCore.removeConditionalFormat(sheetId, conditionalFormatId);
      setConditionalFormats((prev) => prev.filter((cf) => cf.id !== conditionalFormatId));
    },
    [sheetId]
  );

  const removeAllConditionalFormats = useCallback(() => {
    conditionalFormats.forEach((cf) => {
      quadraticCore.removeConditionalFormat(sheetId, cf.id);
    });
    setConditionalFormats([]);
  }, [sheetId, conditionalFormats]);

  return {
    sheetId,
    conditionalFormats,
    deleteConditionalFormat,
    removeAllConditionalFormats,
    readOnly,
  };
};
