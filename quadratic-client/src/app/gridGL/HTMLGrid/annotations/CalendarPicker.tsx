import { editorInteractionStateAnnotationStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorEvents } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorEvents';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { formatDateTime, formatTime, parseTime } from '@/app/quadratic-core/quadratic_core';
import { ValidationInput } from '@/app/ui/menus/Validations/Validation/ValidationUI/ValidationInput';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import { Calendar } from '@/shared/shadcn/ui/calendar';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { dateToDateString, dateToDateTimeString } from '@/shared/utils/dateTime';
import { CheckSharp, Close } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';

export const CalendarPicker = () => {
  const [annotationState, setAnnotationState] = useRecoilState(editorInteractionStateAnnotationStateAtom);

  const showTime = useMemo(() => annotationState === 'calendar-time', [annotationState]);
  const showCalendar = useMemo(
    () => annotationState === 'calendar' || annotationState === 'calendar-time',
    [annotationState]
  );

  useEffect(() => {
    const close = (opened: boolean) => {
      if (!opened) {
        setAnnotationState(undefined);
      }
    };

    inlineEditorEvents.on('status', close);
    return () => {
      inlineEditorEvents.off('status', close);
    };
  }, [setAnnotationState]);

  const [value, setValue] = useState<string | undefined>();
  const [date, setDate] = useState<Date | undefined>();
  const [dateFormat, setDateFormat] = useState<string | undefined>('');
  useEffect(() => {
    const fetchValue = async () => {
      const position = sheets.sheet.cursor.position;
      const value = await quadraticCore.getDisplayCell(sheets.current, position.x, position.y);
      if (value) {
        const d = new Date(value as string);

        // this tests if the Date is valid
        if (isNaN(d as any)) {
          setDate(undefined);
        } else {
          setDate(d);
        }
        setValue(value);
      }
      const summary = await quadraticCore.getCellFormatSummary(sheets.current, position.x, position.y);
      if (summary.dateTime) {
        setDateFormat(summary.dateTime);
      } else {
        setDateFormat(undefined);
      }
    };

    if (showCalendar) fetchValue();
  }, [annotationState, showCalendar, showTime]);

  // we need to clear the component when the cursor moves to ensure it properly
  // populates when changing position.
  useEffect(() => {
    const clear = () => {
      setDate(undefined);
      setDateFormat(undefined);
      setValue(undefined);
    };

    events.on('cursorPosition', clear);
    return () => {
      events.off('cursorPosition', clear);
    };
  });

  const changeDate = useCallback(
    (newDate: Date | undefined) => {
      if (!newDate || !date) return;
      let replacement: string;
      if (showTime) {
        newDate.setHours(date.getHours(), date.getMinutes(), date.getSeconds());
        replacement = dateToDateTimeString(newDate);
      } else {
        replacement = dateToDateString(newDate);
      }
      setDate(newDate);
      inlineEditorEvents.emit('replaceText', replacement, false);
      if (!showTime) {
        inlineEditorHandler.close({});
      }
    },
    [date, showTime]
  );

  const changeTime = useCallback(
    (time: string) => {
      if (!date) return;
      const combinedDate = parseTime(dateToDateString(date), time);
      if (combinedDate) {
        const newDate = new Date(combinedDate);
        if (!isNaN(newDate as any)) {
          setDate(newDate);
          inlineEditorEvents.emit('replaceText', formatDateTime(dateToDateTimeString(newDate), dateFormat), false);
        }
      }
    },
    [date, dateFormat]
  );

  const setCurrentDateTime = useCallback(() => {
    const newDate = new Date();
    const replacement = formatDateTime(dateToDateTimeString(newDate), dateFormat);
    setDate(newDate);
    inlineEditorEvents.emit('replaceText', replacement, false);
    inlineEditorHandler.close({});
  }, [dateFormat]);

  const close = useCallback(() => {
    setAnnotationState(undefined);
    inlineEditorMonaco.focus();
  }, [setAnnotationState]);

  const finish = useCallback(() => inlineEditorHandler.close({}), []);

  if (!showCalendar || !date || !value) return null;

  return (
    <div className="pointer-up-ignore pointer-events-auto border bg-white shadow">
      <div className="px-1 pb-0 pt-1 text-right">
        <IconButton sx={{ padding: 0, width: 20, height: 20 }} onClick={close}>
          <Close sx={{ padding: 0, width: 15, height: 15 }} />
        </IconButton>
      </div>
      <Calendar mode="single" selected={date} defaultMonth={date} onSelect={changeDate} />
      {showTime && (
        <div className="flex w-full gap-2 p-3">
          <ValidationInput value={formatTime(value)} onChange={changeTime} onEnter={finish} />
          <TooltipPopover label="Set current date and time">
            <Button onClick={setCurrentDateTime} className="px-2">
              <CheckSharp fontSize="small" />
            </Button>
          </TooltipPopover>
        </div>
      )}
    </div>
  );
};
