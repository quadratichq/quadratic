import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorEvents } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorEvents';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { useInlineEditorStatus } from '@/app/gridGL/HTMLGrid/inlineEditor/useInlineEditorStatus';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { validationRuleSimple } from '@/app/ui/menus/Validations/Validation/validationType';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { cn } from '@/shared/shadcn/utils';
import type { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';

export const SuggestionDropDown = () => {
  const inlineEditorStatus = useInlineEditorStatus();

  const [list, setList] = useState<string[] | undefined>();
  const [filteredList, setFilteredList] = useState<string[] | undefined>();
  const [offsets, setOffsets] = useState<Rectangle | undefined>();
  const suggestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const populateList = async () => {
      const sheet = sheets.sheet;
      const cursor = sheet.cursor;
      if (cursor.isMultiCursor()) {
        setList(undefined);
        inlineEditorMonaco.setShowingList(false);
        return;
      }

      const pos = sheet.cursor.position;

      // Don't show autocomplete if cursor is in a merged cell
      const mergeRect = sheet.getMergeCellRect(pos.x, pos.y);
      if (mergeRect) {
        setList(undefined);
        inlineEditorMonaco.setShowingList(false);
        return;
      }

      // if there are validations, don't autocomplete
      // todo: we can make this better by showing only validated values
      const validations = sheets.sheet.getValidation(pos.x, pos.y);
      if (validations?.length) {
        const validation = validations[0];
        if (validationRuleSimple(validation) === 'logical') {
          const values = ['TRUE', 'FALSE'];
          setList(values);
          inlineEditorMonaco.autocompleteList = values;
        } else if (validationRuleSimple(validation) === 'list') {
          if (validation && validationRuleSimple(validation) === 'list') {
            const values = await quadraticCore.getValidationList(sheets.current, pos.x, pos.y);
            if (values) {
              // we set the list to undefined so the dropdown doesn't show (it will show only if validation is set to show list)
              // we still want the autocomplete to work so we send the values to the monaco editor
              setList(undefined);
              inlineEditorMonaco.autocompleteList = values;
            }
          }
        } else {
          setList(undefined);
          inlineEditorMonaco.setShowingList(false);
        }
      } else {
        let values: string[] | undefined;
        try {
          values = await quadraticCore.neighborText(sheets.current, pos.x, pos.y);
        } catch (e) {
          console.error(`[SuggestionDropDown] Error getting neighbor text: ${e}`);
        }
        setList(values);
        inlineEditorMonaco.autocompleteList = values;
        if (values) {
          setOffsets(sheets.sheet.getCellOffsets(pos.x, pos.y));
        }
      }
    };

    const valueChanged = (input = inlineEditorMonaco.get()) => {
      // Clear any pending suggestion timeout
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
        suggestionTimeoutRef.current = null;
      }

      if (inlineEditorHandler.formula || input.trim() === '' || !list) {
        inlineEditorMonaco.autocompleteShowingList = false;
        setFilteredList(undefined);
        return;
      }
      const lowerCaseValue = input.toLowerCase();
      const possibleValues = list.filter((v) => v.toLowerCase().startsWith(lowerCaseValue));
      if (possibleValues.length === 1) {
        setFilteredList(undefined);
        inlineEditorMonaco.setShowingList(false);
        suggestionTimeoutRef.current = setTimeout(() => {
          // Only trigger if editor is still open
          if (inlineEditorHandler.isOpen()) {
            inlineEditorMonaco.triggerSuggestion();
          }
          suggestionTimeoutRef.current = null;
        }, 100);
      } else if (possibleValues.length > 1) {
        const lowerCaseValue = input.toLowerCase();
        const possibleValues = list.filter((v) => v.toLowerCase().startsWith(lowerCaseValue));
        setFilteredList(possibleValues);
        inlineEditorMonaco.setShowingList(true);
      } else {
        setFilteredList(undefined);
        inlineEditorMonaco.setShowingList(false);
      }
    };

    events.on('cursorPosition', populateList);
    inlineEditorEvents.on('valueChanged', valueChanged);

    return () => {
      // Clear timeout on cleanup to prevent "Canceled" errors
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
        suggestionTimeoutRef.current = null;
      }
      events.off('cursorPosition', populateList);
      inlineEditorEvents.off('valueChanged', valueChanged);
    };
  }, [filteredList, list]);

  const changeValue = useCallback((value: string, moveRight: boolean) => {
    inlineEditorEvents.emit('replaceText', value, 0);
    inlineEditorHandler.close({ deltaX: moveRight ? 1 : 0, deltaY: moveRight ? 0 : 1 });
    inlineEditorMonaco.setShowingList(false);
    setIndex(-1);
  }, []);

  // handle keyboard events when list is open
  const [index, setIndex] = useState(-1);
  useEffect(() => {
    const dropdownKeyboard = (key: 'ArrowDown' | 'ArrowUp' | 'Enter' | 'Escape' | 'Tab') => {
      if (!filteredList) return;

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        setIndex((index) => {
          return key === 'ArrowDown'
            ? (index + 1) % filteredList.length
            : (index - 1 + filteredList.length) % filteredList.length;
        });
      } else if (key === 'Enter') {
        if (index >= 0) {
          changeValue(filteredList[index], false);
        } else {
          changeValue(inlineEditorMonaco.get(), false);
        }
      } else if (key === 'Escape') {
        setIndex(-1);
        inlineEditorMonaco.autocompleteShowingList = false;
        setFilteredList(undefined);
      } else if (key === 'Tab') {
        if (index >= 0) {
          changeValue(filteredList[index], true);
        } else {
          changeValue(inlineEditorMonaco.get(), true);
        }
      }
    };

    events.on('suggestionDropdownKeyboard', dropdownKeyboard);
    return () => {
      events.off('suggestionDropdownKeyboard', dropdownKeyboard);
    };
  }, [changeValue, index, filteredList]);

  if (!filteredList || !offsets) return null;

  return (
    <div
      className={cn(
        'pointer-events-auto absolute cursor-pointer overflow-y-auto rounded-sm border border-border bg-background text-muted-foreground',
        inlineEditorStatus ? 'mt-1' : 'mt-0'
      )}
      style={{
        top: offsets.bottom,
        left: offsets.left,
        transformOrigin: `0 0`,
        transform: `scale(${1 / pixiApp.viewport.scale.x})`,
        minWidth: offsets.width,
        maxHeight: `min(50vh, calc(${pixiApp.viewport.bottom - offsets.bottom}px))`,
      }}
    >
      <div className="pointer-up-ignore block w-full px-1">
        {filteredList.map((item, i) => (
          <div
            className={cn('block w-full whitespace-nowrap px-1 hover:bg-accent', i === index ? 'bg-accent' : '')}
            key={item}
            onClick={() => changeValue(item, false)}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};
