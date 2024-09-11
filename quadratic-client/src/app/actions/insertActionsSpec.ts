import { Action } from '@/app/actions/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { SNIPPET_JS_API, SNIPPET_JS_CHART } from '@/app/ui/menus/CodeEditor/snippetsJS';
import { SNIPPET_PY_API, SNIPPET_PY_CHART } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { ArrowDropDownCircleIcon, CheckBoxIcon, SheetIcon } from '@/shared/components/Icons';

export const insertActionsSpec = {
  [Action.InsertCodePython]: {
    label: 'Python',
    labelVerbose: 'Insert Python code',
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      const cursor = sheets.sheet.cursor.getCursor();
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showCodeEditor: true,
        mode: 'Python',
        selectedCell: { x: cursor.x, y: cursor.y },
        selectedCellSheet: sheets.sheet.id,
      }));
    },
  },
  [Action.InsertCodeJavascript]: {
    label: 'JavaScript',
    labelVerbose: 'Insert JavaScript code',
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      const cursor = sheets.sheet.cursor.getCursor();
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showCodeEditor: true,
        mode: 'Javascript',
        selectedCell: { x: cursor.x, y: cursor.y },
        selectedCellSheet: sheets.sheet.id,
      }));
    },
  },
  [Action.InsertCodeFormula]: {
    label: 'Formula',
    labelVerbose: 'Insert Formula',
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      const cursor = sheets.sheet.cursor.getCursor();
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showCodeEditor: true,
        mode: 'Formula',
        selectedCell: { x: cursor.x, y: cursor.y },
        selectedCellSheet: sheets.sheet.id,
      }));
    },
  },
  [Action.InsertChartPython]: {
    label: 'Python (Plotly)',
    labelVerbose: 'Insert Python chart (Plotly)',
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      const cursor = sheets.sheet.cursor.getCursor();
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showCodeEditor: true,
        mode: 'Python',
        selectedCell: { x: cursor.x, y: cursor.y },
        selectedCellSheet: sheets.sheet.id,
        initialCode: SNIPPET_PY_CHART,
      }));
    },
  },
  [Action.InsertChartJavascript]: {
    label: 'JavaScript (Chart.js)',
    labelVerbose: 'Insert JavaScript chart (Chart.js)',
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      const cursor = sheets.sheet.cursor.getCursor();
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showCodeEditor: true,
        mode: 'Javascript',
        selectedCell: { x: cursor.x, y: cursor.y },
        selectedCellSheet: sheets.sheet.id,
        initialCode: SNIPPET_JS_CHART,
      }));
    },
  },
  [Action.InsertApiRequestJavascript]: {
    label: 'From JavaScript API request',
    labelVerbose: 'Insert JavaScript API request',
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      const cursor = sheets.sheet.cursor.getCursor();
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showCodeEditor: true,
        mode: 'Javascript',
        selectedCell: { x: cursor.x, y: cursor.y },
        selectedCellSheet: sheets.sheet.id,
        initialCode: SNIPPET_JS_API,
      }));
    },
  },
  [Action.InsertApiRequestPython]: {
    label: 'From Python API request',
    labelVerbose: 'Insert Python API request',
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      const cursor = sheets.sheet.cursor.getCursor();
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showCodeEditor: true,
        mode: 'Python',
        selectedCell: { x: cursor.x, y: cursor.y },
        selectedCellSheet: sheets.sheet.id,
        initialCode: SNIPPET_PY_API,
      }));
    },
  },
  [Action.InsertSheet]: {
    label: 'Sheet',
    labelVerbose: 'Insert Sheet',
    Icon: SheetIcon,
    run: () => {
      sheets.userAddSheet();
    },
  },
  [Action.InsertCheckbox]: {
    label: 'Checkbox',
    Icon: CheckBoxIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showValidation: 'logical',
      }));
    },
  },
  [Action.InsertDropdown]: {
    label: 'Dropdown',
    Icon: ArrowDropDownCircleIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showValidation: 'list',
      }));
    },
  },
};
