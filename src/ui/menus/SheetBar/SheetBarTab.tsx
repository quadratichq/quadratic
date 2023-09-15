import './SheetBarTab.css';

import { Box, Fade, Popper, useTheme } from '@mui/material';
import { MouseEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { sheets } from '../../../grid/controller/Sheets';
import { Sheet } from '../../../grid/sheet/Sheet';
import { focusGrid } from '../../../helpers/focusGrid';

const SHEET_NAME_MAX_LENGTH = 50;

interface Props {
  sheet: Sheet;
  order: string;
  active: boolean;
  onPointerDown: (options: { event: PointerEvent<HTMLDivElement>; sheet: Sheet }) => void;
  onContextMenu: (event: MouseEvent, sheet: Sheet) => void;
  forceRename: boolean;
  clearRename: () => void;
}

export const SheetBarTab = (props: Props): JSX.Element => {
  const { sheet, order, active, onPointerDown, onContextMenu, forceRename, clearRename } = props;
  // const localFiles = useFileContext();
  const [nameExists, setNameExists] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (forceRename) {
      setIsRenaming(true);
    }
  }, [forceRename]);

  const divRef = useRef<HTMLDivElement | null>(null);

  const inputRef = useCallback(
    (node: HTMLInputElement) => {
      if (node) {
        node.value = sheet.name;
      }
    },
    [sheet.name]
  );

  return (
    <Box
      ref={divRef}
      sx={{
        order,
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
        position: 'relative',
        ...(active
          ? {
              backgroundColor: theme.palette.background.default + ' !important', // blue['50'] + ' !important',
              position: 'sticky',
              left: '0',
              right: '0',
              // TODO figure out why MUI isn't applying this...
              zIndex: 10,
              boxShadow: `inset 1px 0 0 ${theme.palette.divider}, inset -1px 0 0 ${theme.palette.divider}`,
            }
          : {}),
      }}
      data-id={sheet.id}
      data-order={sheet.order}
      onPointerDown={(event) => onPointerDown({ event, sheet })}
      onDoubleClick={() => setIsRenaming(true)}
      onContextMenu={(e) => onContextMenu(e, sheet)}
    >
      {isRenaming && (
        <input
          ref={inputRef}
          className="sheet-tab-input"
          autoFocus={true}
          onKeyDown={(event) => {
            const input = event.currentTarget as HTMLInputElement;
            if (event.code === 'Enter') {
              if (input.value !== sheet.name) {
                if (sheets.nameExists(input.value)) {
                  setNameExists(true);
                  input.focus();
                  return;
                } else {
                  setNameExists(false);
                  setIsRenaming(false);
                  sheets.sheet.name = input.value;
                }
              }
              focusGrid();
            } else if (event.code === 'Escape') {
              setIsRenaming(false);
              setNameExists(false);
              focusGrid();
            } else if (
              event.key === 'Delete' ||
              event.key === 'ArrowLeft' ||
              event.key === 'ArrowRight' ||
              event.key === 'ArrowUp' ||
              event.key === 'ArrowDown' ||
              event.key === 'Backspace' ||
              event.metaKey
            ) {
              // Allow these, otherwise we cap
            } else if (input.value.length > SHEET_NAME_MAX_LENGTH) {
              console.log('length', event.currentTarget.value);
              event.preventDefault();
            }
          }}
          onInput={() => setNameExists(false)}
          onBlur={(event) => {
            const input = event.currentTarget as HTMLInputElement;
            if (!input) return false;
            if (!isRenaming) return;
            setIsRenaming((isRenaming) => {
              if (!isRenaming) return false;
              if (input.value !== sheet.name) {
                if (!sheets.nameExists(input.value)) {
                  sheets.sheet.name = input.value;
                } else {
                  setNameExists(true);
                  setTimeout(() => setNameExists(false), 1500);
                }
              }
              return false;
            });
            clearRename();
            focusGrid();
            return false;
          }}
        />
      )}

      {!isRenaming && (
        <Box
          data-title={sheet.name}
          sx={{
            textAlign: 'center',
            pt: theme.spacing(1),
            px: theme.spacing(2),
            cursor: 'pointer',
            transition: 'box-shadow 200ms ease 250ms, background-color 200ms ease',
            whiteSpace: 'nowrap',
            height: '100%',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              bottom: '0',
              left: '0',
              height: '3px',
              width: '100%',
              backgroundColor: sheet.color ? sheet.color : 'transparent',
            },
            ...(active
              ? {
                  color: theme.palette.primary.main,
                  // Little trick to bold the text without making the content of
                  // the tab change in width
                  fontWeight: '600',
                  '&::after': {
                    content: 'attr(data-title)',
                    display: 'block',
                    fontWeight: 'bold',
                    height: '1px',
                    color: 'transparent',
                    overflow: 'hidden',
                    visibility: 'hidden',
                  },
                }
              : {}),
          }}
        >
          {sheet.name}
        </Box>
      )}

      <Popper open={nameExists} anchorEl={divRef.current} transition>
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={350}>
            <Box sx={{ border: 1, p: 0.5, marginBottom: 1, backgroundColor: 'rgba(255, 0, 0, 0.25)' }}>
              Sheet name must be unique
            </Box>
          </Fade>
        )}
      </Popper>
    </Box>
  );
};
