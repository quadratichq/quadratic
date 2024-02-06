/* eslint-disable @typescript-eslint/no-unused-vars */

import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { focusGrid } from '@/helpers/focusGrid';
import { SearchOptions, SheetPos } from '@/quadratic-core/types';
import { Button } from '@/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shadcn/ui/dropdown-menu';
import { Input } from '@/shadcn/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/shadcn/ui/popover';
import { colors } from '@/theme/colors';
import { MoreHoriz, NavigateBefore, NavigateNext } from '@mui/icons-material';
import { useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

export function Search() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    case_sensitive: false,
    whole_cell: false,
    search_code: false,
    sheet_id: sheets.sheet.id,
  });
  const [results, setResults] = useState<SheetPos[]>([]);
  const [current, setCurrent] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const placeholder = !searchOptions.sheet_id ? 'Search all sheets...' : 'Search this sheet...';

  const onChange = (search: string, updatedSearchOptions = searchOptions) => {
    if (search.length > 0) {
      const found = grid.search(search, updatedSearchOptions);
      if (found.length) {
        setResults(found);
        setCurrent(0);
        moveCursor(found[0]);
        dispatchEvent(new CustomEvent('search', { detail: { found, current: 0 } }));
        return;
      }
    }
    setResults([]);
    dispatchEvent(new CustomEvent('search'));
  };

  const moveCursor = (pos: SheetPos) => {
    if (sheets.sheet.id !== pos.sheet_id.id) {
      sheets.current = pos.sheet_id.id;
    }
    sheets.sheet.cursor.changePosition({
      cursorPosition: { x: Number(pos.x), y: Number(pos.y) },
      ensureVisible: true,
    });
  };

  const navigate = (delta: 1 | -1) => {
    setCurrent((current) => {
      let next = (current + delta) % results.length;
      if (next < 0) next = results.length - 1;
      dispatchEvent(new CustomEvent('search', { detail: { found: results, current: next } }));
      const result = results[next];
      moveCursor(result);
      return next;
    });
  };

  const changeOptions = (option: 'case_sensitive' | 'whole_cell' | 'search_code' | 'sheet') => {
    let updatedSearchOptions: SearchOptions;
    if (option === 'sheet') {
      if (searchOptions.sheet_id) {
        setSearchOptions((prev) => {
          updatedSearchOptions = { ...prev, sheet_id: undefined };
          return updatedSearchOptions;
        });
      } else {
        setSearchOptions((prev) => {
          updatedSearchOptions = { ...prev, sheet_id: sheets.sheet.id };
          return updatedSearchOptions;
        });
      }
    } else {
      setSearchOptions((prev) => {
        updatedSearchOptions = { ...prev, [option]: !prev[option] };
        return updatedSearchOptions;
      });
    }

    const search = (inputRef.current as HTMLInputElement).value;
    onChange(search, updatedSearchOptions!);
  };

  const closeSearch = () => {
    setResults([]);
    setSearchOptions({
      case_sensitive: false,
      whole_cell: false,
      search_code: false,
      sheet_id: sheets.sheet.id,
    });
    focusGrid();
    dispatchEvent(new CustomEvent('search'));
  };

  useEffect(() => {
    const changeSheet = () =>
      setSearchOptions((prev) => {
        if (prev.sheet_id) {
          return { ...prev, sheet_id: sheets.sheet.id };
        } else {
          return prev;
        }
      });
    window.addEventListener('change-sheet', changeSheet);
    return () => {
      window.removeEventListener('change-sheet', changeSheet);
    };
  }, []);

  useEffect(() => {
    if (!editorInteractionState.showSearch) {
      closeSearch();
    }
  }, [editorInteractionState.showSearch]);

  useEffect(() => {
    if (editorInteractionState.showSearch && editorInteractionState.showCodeEditor) {
      setEditorInteractionState((prev) => ({ ...prev, showSearch: false }));
    }
  }, [editorInteractionState.showSearch, editorInteractionState.showCodeEditor, setEditorInteractionState]);

  return (
    <Popover open={editorInteractionState.showSearch}>
      <PopoverAnchor
        style={{
          position: 'absolute',
          right: '1rem',
          top: '100%',
        }}
      />
      <PopoverContent
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '400px',
        }}
        onKeyDown={(e) => {
          // close search
          if (e.key === 'Escape') {
            setEditorInteractionState((prev) => ({ ...prev, showSearch: false }));
          }
          if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            inputRef.current?.focus();
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (results.length > 1) {
              navigate(e.shiftKey ? -1 : 1);
            } else if (results.length === 1) {
              setEditorInteractionState((prev) => ({ ...prev, showSearch: false }));
            }
          }
        }}
      >
        <Input
          id="search-input"
          type="text"
          ref={inputRef}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {!!results.length && (
          <div style={{ whiteSpace: 'nowrap' }}>
            {current + 1} of {results.length}
          </div>
        )}
        {!!results.length && (
          <>
            <Button size="icon-sm" onClick={() => navigate(-1)}>
              <NavigateBefore />
            </Button>
            <Button size="icon-sm" onClick={() => navigate(1)}>
              <NavigateNext />
            </Button>
          </>
        )}
        {results.length === 0 && !!(inputRef.current as HTMLInputElement)?.value.length && (
          <div style={{ whiteSpace: 'nowrap', color: colors.quadraticSecondary }}>not found</div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <MoreHoriz fontSize="small" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked={!searchOptions.sheet_id} onCheckedChange={() => changeOptions('sheet')}>
              Search all sheets
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={searchOptions.case_sensitive}
              onCheckedChange={() => changeOptions('case_sensitive')}
            >
              Case sensitive search
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={searchOptions.whole_cell}
              onCheckedChange={() => changeOptions('whole_cell')}
            >
              Match entire cell contents
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={searchOptions.search_code}
              onCheckedChange={() => changeOptions('search_code')}
            >
              Search within code
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PopoverContent>
    </Popover>
  );
}
