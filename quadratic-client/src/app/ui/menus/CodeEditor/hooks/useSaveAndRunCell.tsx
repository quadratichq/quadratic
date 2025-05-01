import {
  codeEditorCodeCellAtom,
  codeEditorCodeStringAtom,
  codeEditorDiffEditorContentAtom,
  codeEditorEditorContentAtom,
} from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
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

        const codeString = editorContent ?? '';
        quadraticCore.setCodeCellValue({
          sheetId,
          x: pos.x,
          y: pos.y,
          codeString,
          language,
          cursor: sheets.getCursorPosition(),
        });

        set(codeEditorEditorContentAtom, codeString);
        set(codeEditorCodeStringAtom, codeString);
        set(codeEditorDiffEditorContentAtom, undefined);

        // we need to add the unsaved codeCell to the client since it does not
        // yet exist in the grid
        const tables = pixiApp.cellsSheets.getById(sheetId)?.tables;
        if (tables) {
          if (!tables.isTable(pos.x, pos.y)) {
            events.emit('updateCodeCell', {
              sheetId,
              x: pos.x,
              y: pos.y,
              codeCell: {
                x: BigInt(pos.x),
                y: BigInt(pos.y),
                code_string: codeString,
                language,
                std_out: null,
                std_err: null,
                evaluation_result: null,
                spill_error: null,
                return_info: null,
                cells_accessed: null,
              },
              renderCodeCell: {
                x: pos.x,
                y: pos.y,
                w: 1,
                h: 1,
                language,
                state: 'NotYetRun',
                spill_error: null,
                name: '',
                columns: [],
                first_row_header: false,
                sort: null,
                sort_dirty: false,
                alternating_colors: false,
                is_code: true,
                is_html: false,
                is_html_image: false,
                show_name: false,
                show_columns: false,
              },
            });
          }
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
