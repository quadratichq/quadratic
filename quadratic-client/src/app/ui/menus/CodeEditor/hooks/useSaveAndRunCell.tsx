import { codeEditorCellLocationAtom, codeEditorEditorContentAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateModeAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { googleAnalyticsAvailable } from '@/shared/utils/analytics';
import mixpanel from 'mixpanel-browser';
import { useCallback, useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export const useSaveAndRunCell = () => {
  const editorMode = useRecoilValue(editorInteractionStateModeAtom);
  const mode = useMemo(() => getLanguage(editorMode), [editorMode]);

  const cellLocation = useRecoilValue(codeEditorCellLocationAtom);
  const editorContent = useRecoilValue(codeEditorEditorContentAtom);

  const saveAndRunCell = useCallback(async () => {
    if (cellLocation === undefined) throw new Error(`cellLocation is undefined in CodeEditor#saveAndRunCell`);
    if (editorMode === undefined) throw new Error(`Language ${editorMode} not supported in CodeEditor#saveAndRunCell`);

    quadraticCore.setCodeCellValue({
      sheetId: cellLocation.sheetId,
      x: cellLocation.x,
      y: cellLocation.y,
      codeString: editorContent ?? '',
      language: editorMode,
      cursor: sheets.getCursorPosition(),
    });

    mixpanel.track('[CodeEditor].cellRun', {
      type: mode,
    });

    // Google Ads Conversion for running a cell
    if (googleAnalyticsAvailable()) {
      //@ts-expect-error
      gtag('event', 'conversion', {
        send_to: 'AW-11007319783/C-yfCJOe6JkZEOe92YAp',
      });
    }
  }, [cellLocation, editorContent, editorMode, mode]);

  return { saveAndRunCell };
};
