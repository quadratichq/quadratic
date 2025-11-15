//! Stores data for the ScheduledTaskType component.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { JsSelection, scheduledTaskDecode } from '@/app/quadratic-core/quadratic_core';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type TaskType = 'run-selected-cells' | 'run-sheet-cells' | 'run-all-code';

export interface CronRange {
  task: TaskType;
  range: JsSelection | undefined;
  rangeError: string | undefined;
  setRangeError: (error: string | undefined) => void;
  setTaskCallback: (task: string) => void;
  setSheet: (sheet: string) => void;
  sheetId: string;
  changeSelection: (selection: JsSelection | undefined) => void;
  sheetList: { value: string; label: string }[];
}

export const useCronRange = (operations?: number[]): CronRange => {
  const [task, setTask] = useState<TaskType>('run-all-code');
  const [range, setRange] = useState<JsSelection | undefined>();
  const [rangeError, setRangeError] = useState<string | undefined>(undefined);

  // decode any existing operations
  useEffect(() => {
    if (operations) {
      const range = scheduledTaskDecode(new Uint8Array(operations));
      if (!range) {
        setTask('run-all-code');
      } else if (range.isAllSelected()) {
        setTask('run-sheet-cells');
      } else {
        setTask('run-selected-cells');
      }
      setRange(range);
    }
  }, [operations]);

  const setTaskCallback = useCallback((task: string) => {
    if (task === 'run-all-code') {
      setRange(undefined);
      setRangeError(undefined);
    } else if (task === 'run-sheet-cells') {
      const selection = new JsSelection(sheets.current);
      selection.selectSheet(sheets.current);
      setRange(selection);
      setRangeError(undefined);
    } else if (task === 'run-selected-cells') {
      setRange(sheets.sheet.cursor.jsSelection.clone());
      setRangeError(undefined);
    }
    setTask(task as TaskType);
  }, []);

  const setSheet = useCallback((sheet: string) => {
    const selection = new JsSelection(sheet);
    selection.selectSheet(sheet);
    setRange(selection);
  }, []);

  const sheetId = useMemo((): string => {
    if (!range) return sheets.current;
    return range.getSheetId();
  }, [range]);

  const changeSelection = useCallback((selection: JsSelection | undefined) => {
    if (selection) {
      setRange(selection);
      setRangeError(undefined);
    } else {
      setRangeError('Selection is empty');
    }
  }, []);

  const [sheetList, setSheetList] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    const setSheets = () => setSheetList(sheets.sheets.map((sheet) => ({ value: sheet.id, label: sheet.name })));
    events.on('sheetsInfo', setSheets);
    events.on('addSheet', setSheets);
    events.on('deleteSheet', setSheets);
    events.on('sheetInfoUpdate', setSheets);
    setSheets();
    return () => {
      events.off('sheetsInfo', setSheets);
      events.off('addSheet', setSheets);
      events.off('deleteSheet', setSheets);
      events.off('sheetInfoUpdate', setSheets);
    };
  }, []);

  return { task, range, rangeError, setTaskCallback, setRangeError, setSheet, sheetId, changeSelection, sheetList };
};
