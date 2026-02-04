import { Action } from '@/app/actions/actions';
import type { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { gridToDataTable } from '@/app/actions/dataTableSpec';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { FILE_INPUT_ID } from '@/app/gridGL/HTMLGrid/GridFileInput';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import { SNIPPET_JS_API, SNIPPET_JS_CHART } from '@/app/ui/menus/CodeEditor/snippetsJS';
import { SNIPPET_PY_API, SNIPPET_PY_CHART } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import {
  ArrowDropDownIcon,
  CheckBoxIcon,
  DataValidationsIcon,
  FormatDateTimeIcon,
  FormatPaintIcon,
  InsertLinkIcon,
  ScheduledTasksIcon,
  SheetIcon,
  TableConvertIcon,
} from '@/shared/components/Icons';

type InsertActionSpec = Pick<
  ActionSpecRecord,
  | Action.InsertCodePython
  | Action.InsertCodeJavascript
  | Action.InsertCodeFormula
  | Action.InsertChartPython
  | Action.InsertChartJavascript
  | Action.InsertApiRequestJavascript
  | Action.InsertApiRequestPython
  | Action.InsertDataTable
  | Action.InsertSheet
  | Action.InsertCheckbox
  | Action.InsertDropdown
  | Action.ToggleDataValidation
  | Action.ToggleConditionalFormat
  | Action.AddConditionalFormat
  | Action.InsertScheduledTask
  | Action.InsertHyperlink
  | Action.InsertCellReference
  | Action.RemoveInsertedCells
  | Action.InsertToday
  | Action.InsertTodayTime
  | Action.InsertFile
>;

export const insertCellReference = () => {
  if (pixiAppSettings.codeEditorState.showCodeEditor) {
    const { sheetId, language } = pixiAppSettings.codeEditorState.codeCell;
    insertCellRef(sheetId, language);
  }
};

export const insertActionsSpec: InsertActionSpec = {
  [Action.InsertCodePython]: {
    label: () => 'Python',
    labelVerbose: 'Insert Python code',
    run: () => {
      if (!pixiAppSettings.setCodeEditorState) return;
      const cursor = sheets.sheet.cursor.position;
      pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();
      pixiAppSettings.setCodeEditorState((prev) => ({
        ...prev,
        aiAssistant: {
          abortController: undefined,
          loading: false,
          id: '',
          messages: [],
          waitingOnMessageIndex: undefined,
        },
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: cursor.x, y: cursor.y },
            language: 'Python',
            lastModified: 0,
          },
          showCellTypeMenu: false,
          inlineEditor: false,
          initialCode: '',
        },
      }));
    },
  },
  [Action.InsertCodeJavascript]: {
    label: () => 'JavaScript',
    labelVerbose: 'Insert JavaScript code',
    run: () => {
      if (!pixiAppSettings.setCodeEditorState) return;
      const cursor = sheets.sheet.cursor.position;
      pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();
      pixiAppSettings.setCodeEditorState((prev) => ({
        ...prev,
        aiAssistant: {
          abortController: undefined,
          loading: false,
          id: '',
          messages: [],
          waitingOnMessageIndex: undefined,
        },
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: cursor.x, y: cursor.y },
            language: 'Javascript',
            lastModified: 0,
          },
          showCellTypeMenu: false,
          inlineEditor: false,
          initialCode: '',
        },
      }));
    },
  },
  [Action.InsertCodeFormula]: {
    label: () => 'Formula',
    labelVerbose: 'Insert Formula',
    run: () => {
      if (!pixiAppSettings.setCodeEditorState) return;
      const cursor = sheets.sheet.cursor.position;
      pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();
      pixiAppSettings.setCodeEditorState((prev) => ({
        ...prev,
        aiAssistant: {
          abortController: undefined,
          loading: false,
          id: '',
          messages: [],
          waitingOnMessageIndex: undefined,
        },
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: cursor.x, y: cursor.y },
            language: 'Formula',
            lastModified: 0,
            isSingleCell: true,
          },
          showCellTypeMenu: false,
          inlineEditor: false,
          initialCode: '',
        },
      }));
    },
  },
  [Action.InsertChartPython]: {
    label: () => 'Python (Plotly)',
    labelVerbose: 'Insert Python chart (Plotly)',
    run: () => {
      if (!pixiAppSettings.setCodeEditorState) return;
      const cursor = sheets.sheet.cursor.position;
      pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();
      pixiAppSettings.setCodeEditorState((prev) => ({
        ...prev,
        aiAssistant: {
          abortController: undefined,
          loading: false,
          id: '',
          messages: [],
          waitingOnMessageIndex: undefined,
        },
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: cursor.x, y: cursor.y },
            language: 'Python',
            lastModified: 0,
          },
          showCellTypeMenu: false,
          inlineEditor: false,
          initialCode: SNIPPET_PY_CHART,
        },
      }));
    },
  },
  [Action.InsertChartJavascript]: {
    label: () => 'JavaScript (Chart.js)',
    labelVerbose: 'Insert JavaScript chart (Chart.js)',
    run: () => {
      if (!pixiAppSettings.setCodeEditorState) return;
      const cursor = sheets.sheet.cursor.position;
      pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();
      pixiAppSettings.setCodeEditorState((prev) => ({
        ...prev,
        aiAssistant: {
          abortController: undefined,
          loading: false,
          id: '',
          messages: [],
          waitingOnMessageIndex: undefined,
        },
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: cursor.x, y: cursor.y },
            language: 'Javascript',
            lastModified: 0,
          },
          showCellTypeMenu: false,
          inlineEditor: false,
          initialCode: SNIPPET_JS_CHART,
        },
      }));
    },
  },
  [Action.InsertFile]: {
    label: () => 'From file (CSV, Excel, or Parquet)',
    labelVerbose: 'Insert file (CSV, Excel, or Parquet)',
    run: () => {
      const el = document.getElementById(FILE_INPUT_ID) as HTMLInputElement;
      if (el) {
        el.click();

        // clear the file input to trigger the onChange event for subsequent
        // file imports
        el.value = '';
      }
    },
  },
  [Action.InsertApiRequestJavascript]: {
    label: () => 'From JavaScript API request',
    labelVerbose: 'Insert JavaScript API request',
    run: () => {
      if (!pixiAppSettings.setCodeEditorState) return;
      const cursor = sheets.sheet.cursor.position;
      pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();
      pixiAppSettings.setCodeEditorState((prev) => ({
        ...prev,
        aiAssistant: {
          abortController: undefined,
          loading: false,
          id: '',
          messages: [],
          waitingOnMessageIndex: undefined,
        },
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: cursor.x, y: cursor.y },
            language: 'Javascript',
            lastModified: 0,
          },
          showCellTypeMenu: false,
          inlineEditor: false,
          initialCode: SNIPPET_JS_API,
        },
      }));
    },
  },
  [Action.InsertApiRequestPython]: {
    label: () => 'From Python API request',
    labelVerbose: 'Insert Python API request',
    run: () => {
      if (!pixiAppSettings.setCodeEditorState) return;
      const cursor = sheets.sheet.cursor.position;
      pixiAppSettings.codeEditorState.aiAssistant.abortController?.abort();
      pixiAppSettings.setCodeEditorState((prev) => ({
        ...prev,
        aiAssistant: {
          abortController: undefined,
          loading: false,
          id: '',
          messages: [],
          waitingOnMessageIndex: undefined,
        },
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: cursor.x, y: cursor.y },
            language: 'Python',
            lastModified: 0,
          },
          showCellTypeMenu: false,
          inlineEditor: false,
          initialCode: SNIPPET_PY_API,
        },
      }));
    },
  },
  [Action.InsertDataTable]: {
    label: () => 'Table',
    labelVerbose: 'Insert a table',
    Icon: TableConvertIcon,
    isDisabled: () => sheets.sheet.cursor.canConvertToDataTable(),
    run: () => gridToDataTable(),
  },
  [Action.InsertSheet]: {
    label: () => 'Sheet',
    labelVerbose: 'Insert Sheet',
    Icon: SheetIcon,
    run: () => {
      sheets.userAddSheet();
    },
  },
  [Action.InsertCheckbox]: {
    label: () => 'Checkbox',
    labelVerbose: 'Insert checkbox',
    Icon: CheckBoxIcon,
    run: () => {
      sheets.sheet.addCheckbox();
    },
  },
  [Action.InsertDropdown]: {
    label: () => 'Dropdown',
    labelVerbose: 'Insert dropdown',
    Icon: ArrowDropDownIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showValidation: 'list',
      }));
    },
  },
  [Action.ToggleDataValidation]: {
    label: () => 'Data validation rule',
    labelVerbose: 'Manage data validation rules',
    Icon: DataValidationsIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showValidation: true,
      }));
    },
  },
  [Action.ToggleConditionalFormat]: {
    label: () => 'Conditional formatting',
    labelVerbose: 'Manage conditional formatting rules',
    Icon: FormatPaintIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showConditionalFormat: true,
      }));
    },
  },
  [Action.AddConditionalFormat]: {
    label: () => 'Add conditional format',
    labelVerbose: 'Add conditional formatting rule',
    Icon: FormatPaintIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showConditionalFormat: 'new',
      }));
    },
  },
  [Action.InsertScheduledTask]: {
    label: () => 'Scheduled task',
    labelVerbose: 'Insert scheduled task',
    Icon: ScheduledTasksIcon,
    run: async () => {
      const { showScheduledTasksDialog, CREATE_TASK_ID } = await import('@/jotai/scheduledTasksAtom');
      showScheduledTasksDialog(CREATE_TASK_ID);
    },
  },
  [Action.InsertHyperlink]: {
    label: () => 'Hyperlink',
    labelVerbose: 'Insert hyperlink',
    Icon: InsertLinkIcon,
    run: () => {
      events.emit('insertLink');
    },
  },
  [Action.InsertCellReference]: {
    label: () => 'Cell reference',
    labelVerbose: 'Insert cell reference',
    run: insertCellReference,
  },
  [Action.RemoveInsertedCells]: {
    label: () => 'Remove inserted cells',
    run: () => {}, // TODO(ayush): add this when refactoring shortcuts to use action specs
  },
  [Action.InsertToday]: {
    label: () => "Insert today's date",
    Icon: FormatDateTimeIcon,
    run: () => {
      const sheet = sheets.sheet;
      const cursor = sheet.cursor;
      const today = new Date();
      const formattedDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
      quadraticCore.setCellValue(sheet.id, cursor.position.x, cursor.position.y, formattedDate, false);
    },
  },
  [Action.InsertTodayTime]: {
    label: () => "Insert today's time",
    Icon: FormatDateTimeIcon,
    run: () => {
      const sheet = sheets.sheet;
      const cursor = sheet.cursor;
      const today = new Date();
      const formattedTime = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`;
      quadraticCore.setCellValue(sheet.id, cursor.position.x, cursor.position.y, formattedTime, false);
    },
  },
};
