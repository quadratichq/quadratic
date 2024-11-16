import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { validationRuleSimple } from '@/app/ui/menus/Validations/Validation/validationType';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { cn } from '@/shared/shadcn/utils';
import { Rectangle } from 'pixi.js';
import { useCallback, useEffect, useState } from 'react';
import { pixiApp } from '../pixiApp/PixiApp';
import { inlineEditorEvents } from './inlineEditor/inlineEditorEvents';
import { inlineEditorHandler } from './inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from './inlineEditor/inlineEditorMonaco';
import { useInlineEditorStatus } from './inlineEditor/useInlineEditorStatus';

export const SuggestionDropDown = () => {
  const inlineEditorStatus = useInlineEditorStatus();

  const [list, setList] = useState<string[] | undefined>();
  const [filteredList, setFilteredList] = useState<string[] | undefined>();
  const [offsets, setOffsets] = useState<Rectangle | undefined>();
  useEffect(() => {
    const populateList = async () => {
      const sheet = sheets.sheet;
      const pos = sheet.cursor.position;

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
            quadraticCore.getValidationList(sheets.sheet.id, pos.x, pos.y).then((values) => {
              if (values) {
                // we set the list to undefined so the dropdown doesn't show (it will show only if validation is set to show list)
                // we still want the autocomplete to work so we send the values to the monaco editor
                setList(undefined);
                inlineEditorMonaco.autocompleteList = values;
              }
            });
          }
        } else {
          setList(undefined);
          inlineEditorMonaco.autocompleteShowingList = false;
        }
        return;
      }
      const values = await quadraticCore.neighborText(sheet.id, pos.x, pos.y);
      setList(values);
      inlineEditorMonaco.autocompleteList = values;
      if (values) {
        setOffsets(sheet.getCellOffsets(pos.x, pos.y));
      }
    };

    const valueChanged = (input = inlineEditorMonaco.get()) => {
      if (inlineEditorHandler.formula || input.trim() === '' || !list) {
        inlineEditorMonaco.autocompleteShowingList = false;
        setFilteredList(undefined);
        return;
      }
      const lowerCaseValue = input.toLowerCase();
      const possibleValues = list.filter((v) => v.toLowerCase().startsWith(lowerCaseValue));
      if (possibleValues.length === 1) {
        setFilteredList(undefined);
        inlineEditorMonaco.autocompleteShowingList = false;
        setTimeout(() => inlineEditorMonaco.triggerSuggestion(), 100);
      } else if (possibleValues.length > 1) {
        const lowerCaseValue = input.toLowerCase();
        const possibleValues = list.filter((v) => v.toLowerCase().startsWith(lowerCaseValue));
        setFilteredList(possibleValues);
        inlineEditorMonaco.autocompleteShowingList = true;
      } else {
        setFilteredList(undefined);
        inlineEditorMonaco.autocompleteShowingList = false;
      }
    };

    events.on('cursorPosition', populateList);
    inlineEditorEvents.on('valueChanged', valueChanged);

    return () => {
      inlineEditorEvents.off('status', populateList);
      inlineEditorEvents.off('valueChanged', valueChanged);
    };
  }, [filteredList, list]);

  const changeValue = useCallback((value: string) => {
    inlineEditorEvents.emit('replaceText', value, 0);
    inlineEditorHandler.close(0, 1, false);
    inlineEditorMonaco.autocompleteShowingList = false;
  }, []);

  // handle keyboard events when list is open
  const [index, setIndex] = useState(-1);
  useEffect(() => {
    const dropdownKeyboard = (key: 'ArrowDown' | 'ArrowUp' | 'Enter' | 'Escape' | 'Tab') => {
      if (!filteredList) return;

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        setIndex((index) => {
          const i =
            key === 'ArrowDown'
              ? (index + 1) % filteredList.length
              : (index - 1 + filteredList.length) % filteredList.length;
          return i;
        });
      } else if (key === 'Enter') {
        if (index >= 0) {
          changeValue(filteredList[index]);
        }
      } else if (key === 'Escape') {
        inlineEditorMonaco.autocompleteShowingList = false;
        setFilteredList(undefined);
      } else if (key === 'Tab') {
        inlineEditorMonaco.autocompleteSuggestionShowing = false;
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
        'border.gray-300 pointer-events-auto absolute cursor-pointer overflow-y-auto border bg-white text-gray-500',
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
      <div className="block w-full px-1">
        {filteredList.map((item, i) => (
          <div
            className={cn('block w-full whitespace-nowrap px-1 hover:bg-gray-100', i === index ? 'bg-gray-200' : '')}
            key={item}
            onClick={() => changeValue(item)}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};
