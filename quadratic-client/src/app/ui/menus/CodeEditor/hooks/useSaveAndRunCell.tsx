import {
  codeEditorEditorContentAtom,
  codeEditorLanguageAtom,
  codeEditorLocationAtom,
  codeEditorModifiedEditorContentAtom,
} from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { googleAnalyticsAvailable } from '@/shared/utils/analytics';
import mixpanel from 'mixpanel-browser';
import { useCallback, useMemo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const useSaveAndRunCell = () => {
  const location = useRecoilValue(codeEditorLocationAtom);
  const language = useRecoilValue(codeEditorLanguageAtom);
  const mode = useMemo(() => getLanguage(language), [language]);
  const editorContent = useRecoilValue(codeEditorEditorContentAtom);
  const setModifiedEditorContent = useSetRecoilState(codeEditorModifiedEditorContentAtom);

  const saveAndRunCell = useCallback(() => {
    const { sheetId, pos } = location;
    if (!sheetId) return;

    quadraticCore.setCodeCellValue({
      sheetId,
      x: pos.x,
      y: pos.y,
      codeString: editorContent ?? '',
      language,
      cursor: sheets.getCursorPosition(),
    });

    setModifiedEditorContent(undefined);

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
  }, [editorContent, language, location, mode, setModifiedEditorContent]);

  return { saveAndRunCell };
};
