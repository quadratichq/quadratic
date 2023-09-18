import { ArrowDropDown } from '@mui/icons-material';
import { Box, Fade, IconButton, Paper, Popper, Stack, Typography, useTheme } from '@mui/material';
import { MouseEvent, PointerEvent, useEffect, useRef, useState } from 'react';
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
  const [nameExists, setNameExists] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentEditableRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();

  useEffect(() => {
    if (forceRename) {
      setIsRenaming(true);
    }
  }, [forceRename]);

  // When a rename begins, focus contentedtiable and select its contents
  useEffect(() => {
    if (isRenaming) {
      contentEditableRef?.current?.focus();
      selectElementContents(contentEditableRef.current);
    }
  }, [isRenaming, contentEditableRef]);

  return (
    <Box
      ref={containerRef}
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
      <TabWrapper sheet={sheet} active={active}>
        {isRenaming ? (
          <div
            contentEditable
            style={{
              minWidth: '1rem',
              fontWeight: 'bold',
              outline: 0,
              // padding: theme.spacing(0.5)
            }}
            ref={contentEditableRef}
            onKeyDown={(event) => {
              const div = event.currentTarget as HTMLDivElement;
              const value = div.textContent || '';
              if (event.code === 'Enter') {
                if (value !== sheet.name) {
                  if (sheets.nameExists(value)) {
                    event.preventDefault();
                    setNameExists(true);
                    div.focus();
                    return;
                  } else {
                    setNameExists(false);
                    setIsRenaming(false);
                    sheets.sheet.name = value;
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
                // Allow these, otherwise we cap the length of the value
              } else if (value.length > SHEET_NAME_MAX_LENGTH) {
                event.preventDefault();
              }
            }}
            onInput={() => setNameExists(false)}
            onBlur={(event) => {
              const div = event.currentTarget as HTMLInputElement;
              const value = div.innerText;
              if (!div) return false;
              if (!isRenaming) return;
              setIsRenaming((isRenaming) => {
                if (!isRenaming) return false;
                if (value !== sheet.name) {
                  if (!sheets.nameExists(value)) {
                    sheets.sheet.name = value;
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
            onPaste={(event) => {
              event.preventDefault();
              // Contrain the clipboard paste to allowed input
              event.currentTarget.innerText = event.clipboardData
                .getData('text/plain')
                .trim()
                .replace(/(\r\n|\n|\r)/gm, '')
                .slice(0, SHEET_NAME_MAX_LENGTH);
            }}
            dangerouslySetInnerHTML={{ __html: sheet.name }}
          />
        ) : (
          <Box
            data-title={sheet.name}
            sx={{
              // padding: theme.spacing(0.5),
              // Little trick to bold the text without making the content of
              // the tab change in width
              '&::after': {
                content: 'attr(data-title)',
                display: 'block',
                fontWeight: '700',
                height: '1px',
                color: 'transparent',
                overflow: 'hidden',
                visibility: 'hidden',
              },
              ...(active ? { fontWeight: '700' } : {}),
            }}
          >
            {sheet.name}
          </Box>
        )}

        <IconButton
          size="small"
          sx={{
            p: '0',
            ...(active
              ? {
                  opacity: 1,
                  visibility: 'visible',
                }
              : { opacity: 0, visibility: 'none' }),
          }}
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, sheet);
          }}
        >
          <ArrowDropDown fontSize="inherit" />
        </IconButton>

        <Popper open={nameExists} anchorEl={containerRef.current} transition>
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={350}>
              <Paper
                elevation={4}
                sx={{
                  px: theme.spacing(1),
                  marginBottom: 1,
                  color: theme.palette.background.paper,
                  borderColor: `1px solid ${theme.palette.error.dark}`,
                  backgroundColor: theme.palette.error.main,
                }}
              >
                <Typography variant="caption">Sheet name must be unique</Typography>
              </Paper>
            </Fade>
          )}
        </Popper>
      </TabWrapper>
    </Box>
  );
};

function TabWrapper({ children, sheet, active }: any) {
  const theme = useTheme();
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={theme.spacing(0.25)}
      sx={{
        pt: '2px', // offset for the 1px box-shadow inset
        pr: theme.spacing(0.5),
        pl: theme.spacing(1.5),
        cursor: 'pointer',
        transition: 'box-shadow 200ms ease 250ms, background-color 200ms ease',
        whiteSpace: 'nowrap',
        height: '100%',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          bottom: '0',
          left: '1px',
          height: '3px',
          width: 'calc(100% - 2px)',
          backgroundColor: sheet.color ? sheet.color : 'transparent',
        },
        ...(active
          ? {
              color: theme.palette.primary.main,
            }
          : {}),
        '&:hover .MuiIconButton-root': {
          opacity: 1,
          visibility: 'visible',
        },
      }}
    >
      {children}
    </Stack>
  );
}

function selectElementContents(el: HTMLDivElement | null) {
  if (!el) return;

  var range = document.createRange();
  range.selectNodeContents(el);
  var sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
