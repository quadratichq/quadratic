import { Action } from '@/app/actions/actions';
import { ActionSpecRecord } from '@/app/actions/actionsSpec';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import { SNIPPET_JS_API, SNIPPET_JS_CHART } from '@/app/ui/menus/CodeEditor/snippetsJS';
import { SNIPPET_PY_API, SNIPPET_PY_CHART } from '@/app/ui/menus/CodeEditor/snippetsPY';
import { ArrowDropDownCircleIcon, CheckBoxIcon, DataValidationsIcon, SheetIcon } from '@/shared/components/Icons';

type InsertActionSpec = Pick<
  ActionSpecRecord,
  | Action.InsertCodePython
  | Action.InsertCodeJavascript
  | Action.InsertCodeFormula
  | Action.InsertChartPython
  | Action.InsertChartJavascript
  | Action.InsertApiRequestJavascript
  | Action.InsertApiRequestPython
  | Action.InsertSheet
  | Action.InsertCheckbox
  | Action.InsertDropdown
  | Action.ToggleDataValidation
  | Action.InsertCellReference
  | Action.RemoveInsertedCells
>;

export const insertActionsSpec: InsertActionSpec = {
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
        initialCode: '',
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
        initialCode: '',
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
        initialCode: '',
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
    labelVerbose: 'Insert checkbox',
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
    labelVerbose: 'Insert dropdown',
    Icon: ArrowDropDownCircleIcon,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({
        ...prev,
        showValidation: 'list',
      }));
    },
  },
  [Action.ToggleDataValidation]: {
    label: 'Data validation rule',
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
  [Action.InsertCellReference]: {
    label: 'Cell reference',
    labelVerbose: 'Insert cell reference',
    run: () => {
      if (pixiAppSettings.editorInteractionState.showCodeEditor) {
        insertCellRef(pixiAppSettings.editorInteractionState);
      }
    },
  },
  [Action.RemoveInsertedCells]: {
    label: 'Remove inserted cells',
    run: () => {
      // TODO(ayush): add this when refactoring shortcuts to use action specs
    },
  },
};
