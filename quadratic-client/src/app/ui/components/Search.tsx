import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { editorInteractionStateShowSearchAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { focusGrid } from '@/app/helpers/focusGrid';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import type { JsSheetPosText, SearchOptions, SheetPos } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Input } from '@/shared/shadcn/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/shadcn/ui/popover';
import { ChevronLeftIcon, ChevronRightIcon, Cross2Icon, DotsHorizontalIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

const findInSheetActionSpec = defaultActionSpec[Action.FindInCurrentSheet];
const findInSheetsActionSpec = defaultActionSpec[Action.FindInAllSheets];

export function Search() {
  const [showSearch, setShowSearch] = useRecoilState(editorInteractionStateShowSearchAtom);
  const [cursor, setCursor] = useState<SheetPos | undefined>(undefined);

  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    case_sensitive: false,
    whole_cell: false,
    search_code: false,
    sheet_id: sheets.current,
    regex: null,
  });
  const [results, setResults] = useState<JsSheetPosText[]>([]);
  const [current, setCurrent] = useState(0);
  const [inputEl, setInputEl] = useState<HTMLInputElement | null>(null);
  const ref = useCallback((el: HTMLInputElement) => {
    if (el) {
      setInputEl(el);
      el.focus();
    }
  }, []);

  const placeholder = !searchOptions.sheet_id ? findInSheetsActionSpec.label() : findInSheetActionSpec.label();

  useEffect(() => {
    if (cursor) {
      if (sheets.current !== cursor.sheet_id.id) {
        sheets.current = cursor.sheet_id.id;
      }
      sheets.sheet.cursor.moveTo(Number(cursor.x), Number(cursor.y), {
        ensureVisible: { x: Number(cursor.x), y: Number(cursor.y) },
      });
      inputEl?.focus();
    }
  }, [cursor, inputEl]);

  const onChange = useCallback(
    async (search: string | undefined, updatedSearchOptions = searchOptions) => {
      if (search && search.length > 0) {
        const found = await quadraticCore.search(search, updatedSearchOptions);
        if (found.length) {
          setResults(found);
          setCurrent(0);
          setCursor({ x: found[0].x, y: found[0].y, sheet_id: { id: found[0].sheet_id } });
          events.emit(
            'search',
            found.map((found) => ({ x: Number(found.x), y: Number(found.y), sheetId: found.sheet_id })),
            0
          );
          return;
        }
      }
      setResults([]);
      events.emit('search');
    },
    [searchOptions]
  );

  useEffect(() => {
    const updateSearch = async () => {
      if (!showSearch || !inputEl?.value) return;
      const found = await quadraticCore.search(inputEl?.value, searchOptions);
      if (found) {
        setResults(found);
        const currentLocal = current > found.length - 1 ? 0 : current;
        setCurrent((current) => {
          if (current > found.length - 1) return 0;
          return current;
        });
        setCursor({
          x: found[currentLocal].x,
          y: found[currentLocal].y,
          sheet_id: { id: found[currentLocal].sheet_id },
        });
        events.emit(
          'search',
          found.map((found) => ({ x: Number(found.x), y: Number(found.y), sheetId: found.sheet_id })),
          currentLocal
        );
      } else {
        setResults([]);
        events.emit('search');
      }
    };
    events.on('transactionEnd', updateSearch);

    return () => {
      events.off('transactionEnd', updateSearch);
    };
  }, [current, inputEl?.value, searchOptions, showSearch]);

  const navigate = useCallback(
    (delta: 1 | -1) => {
      setCurrent((current) => {
        let next = (current + delta) % results.length;
        if (next < 0) next = results.length - 1;
        events.emit(
          'search',
          results.map((found) => ({ x: Number(found.x), y: Number(found.y), sheetId: found.sheet_id })),
          next
        );
        const result = results[next];
        setCursor({ x: result.x, y: result.y, sheet_id: { id: result.sheet_id } });
        return next;
      });
    },
    [results]
  );

  const changeOptions = useCallback(
    (option: 'case_sensitive' | 'whole_cell' | 'search_code' | 'sheet') => {
      let updatedSearchOptions: SearchOptions;
      if (option === 'sheet') {
        if (searchOptions.sheet_id) {
          setSearchOptions((prev) => {
            updatedSearchOptions = { ...prev, sheet_id: null };
            return updatedSearchOptions;
          });
        } else {
          setSearchOptions((prev) => {
            updatedSearchOptions = { ...prev, sheet_id: sheets.current };
            return updatedSearchOptions;
          });
        }
      } else {
        setSearchOptions((prev) => {
          updatedSearchOptions = { ...prev, [option]: !prev[option] };
          return updatedSearchOptions;
        });
      }

      onChange(inputEl?.value, updatedSearchOptions!);
    },
    [inputEl?.value, onChange, searchOptions.sheet_id]
  );

  const closeSearch = useCallback(() => {
    setCursor(undefined);
    setSearchOptions({ case_sensitive: null, whole_cell: null, search_code: null, sheet_id: null, regex: null });
    events.emit('search');
    focusGrid();
  }, []);

  useEffect(() => {
    const changeSheet = () => {
      if (!showSearch || !searchOptions.sheet_id) {
        return;
      }
      const newSearchOptions = { ...searchOptions };
      if (searchOptions.sheet_id) {
        newSearchOptions.sheet_id = sheets.current;
      }
      setSearchOptions(newSearchOptions);
      onChange(inputEl?.value, newSearchOptions);
    };
    events.on('changeSheet', changeSheet);
    return () => {
      events.off('changeSheet', changeSheet);
    };
  }, [inputEl?.value, onChange, searchOptions, showSearch]);

  useEffect(() => {
    if (!showSearch) {
      closeSearch();
    } else {
      setResults([]);
      setSearchOptions({
        case_sensitive: false,
        whole_cell: false,
        search_code: false,
        sheet_id: sheets.current,
        regex: null,
      });

      // if it's not true then it's of type SearchOptions
      if (showSearch !== true) {
        setSearchOptions(showSearch);
      }
    }
  }, [closeSearch, showSearch]);

  return (
    <Popover open={!!showSearch}>
      <PopoverAnchor />
      <PopoverContent
        align="end"
        className="m-2 flex w-[100vw] flex-col items-center gap-1 p-2 min-[400px]:w-[400px] min-[400px]:flex-row min-[400px]:p-3"
        onKeyDown={(e) => {
          e.stopPropagation();

          // close search
          if (e.key === 'Escape') {
            setShowSearch(false);
          }
          if (matchShortcut(Action.FindInCurrentSheet, e)) {
            e.preventDefault();
            inputEl?.focus();
            inputEl?.select();
            // shift+cmd+f let's you change to all sheets search mode while in the dialog box
            if (e.shiftKey) {
              setSearchOptions((prev) => {
                if (!prev.sheet_id) return prev;
                const updatedSearchOptions = { ...prev, sheet_id: null };
                onChange(inputEl?.value, { ...searchOptions, sheet_id: null });
                return updatedSearchOptions;
              });
            }
          }
          if (e.key === 'Enter') {
            // If other elements have focus, like the 'close' button, don't handle Enter
            if (document.activeElement !== inputEl) return;

            e.preventDefault();
            if (results.length > 1) {
              navigate(e.shiftKey ? -1 : 1);
            } else if (results.length === 1) {
              setShowSearch(false);
            }
          }
        }}
      >
        <div className="relative w-full">
          <Input
            id="search-input"
            type="text"
            ref={ref}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={`pr-[4rem]`}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />
          {inputEl && inputEl.value.length !== 0 && (
            <div
              className="absolute right-3 top-[.625rem] text-nowrap text-xs text-muted-foreground"
              data-testid="search-results-count"
            >
              {results.length === 0 ? '0' : current + 1} of {results.length}
            </div>
          )}
        </div>
        <div className="flex w-full justify-between min-[400px]:w-auto">
          <Button
            variant="ghost"
            className="px-2"
            onClick={() => navigate(-1)}
            disabled={results.length === 0}
            data-testid="search-results-previous"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            className="px-2"
            onClick={() => navigate(1)}
            disabled={results.length === 0}
            data-testid="search-results-next"
          >
            <ChevronRightIcon />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="px-2">
                <DotsHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                inputEl?.focus();
              }}
            >
              <DropdownMenuCheckboxItem
                checked={!searchOptions.sheet_id}
                onCheckedChange={() => changeOptions('sheet')}
              >
                Search all sheets
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={!!searchOptions.case_sensitive}
                onCheckedChange={() => changeOptions('case_sensitive')}
              >
                Case sensitive search
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={!!searchOptions.whole_cell}
                onCheckedChange={() => changeOptions('whole_cell')}
              >
                Match entire cell contents
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={!!searchOptions.search_code}
                onCheckedChange={() => changeOptions('search_code')}
              >
                Search within code
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" className="px-2" onClick={() => setShowSearch(false)}>
            <Cross2Icon />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
