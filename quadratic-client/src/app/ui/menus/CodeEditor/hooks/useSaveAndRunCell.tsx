import { aiResearcherQueryAtom, aiResearcherRefCellAtom } from '@/app/atoms/aiResearcherAtom';
import {
  codeEditorCodeCellAtom,
  codeEditorDiffEditorContentAtom,
  codeEditorEditorContentAtom,
} from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { getAIResearcherCodeString } from '@/app/ui/menus/AIResearcher/helpers/getAIResearcherCodeString.helper';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { googleAnalyticsAvailable } from '@/shared/utils/analytics';
import mixpanel from 'mixpanel-browser';
import { useRecoilCallback } from 'recoil';

export const useSaveAndRunCell = () => {
  const saveAndRunCell = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
        const editorContent = await snapshot.getPromise(codeEditorEditorContentAtom);

        const { sheetId, pos, language } = codeCell;
        if (!sheetId) return;

        if (codeCell.language === 'AIResearcher') {
          const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
          const query = await snapshot.getPromise(aiResearcherQueryAtom);
          const refCell = await snapshot.getPromise(aiResearcherRefCellAtom);
          quadraticCore.setCodeCellValue({
            sheetId: codeCell.sheetId,
            x: codeCell.pos.x,
            y: codeCell.pos.y,
            language: 'AIResearcher',
            codeString: getAIResearcherCodeString(query, refCell),
            cursor: sheets.getCursorPosition(),
          });
        } else {
          quadraticCore.setCodeCellValue({
            sheetId,
            x: pos.x,
            y: pos.y,
            codeString: editorContent ?? '',
            language,
            cursor: sheets.getCursorPosition(),
          });

          set(codeEditorDiffEditorContentAtom, undefined);
        }

        mixpanel.track('[CodeEditor].cellRun', {
          type: getLanguage(codeCell.language),
        });

        // Google Ads Conversion for running a cell
        if (googleAnalyticsAvailable()) {
          //@ts-expect-error
          gtag('event', 'conversion', {
            send_to: 'AW-11007319783/C-yfCJOe6JkZEOe92YAp',
          });
        }
      },
    []
  );

  return { saveAndRunCell };
};
