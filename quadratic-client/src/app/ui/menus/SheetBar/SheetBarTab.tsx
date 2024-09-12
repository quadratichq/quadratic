import { events } from '@/app/events/events';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { Box, Fade, Paper, Popper, Stack, Typography, useTheme } from '@mui/material';
import { MouseEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue } from 'recoil';
import { hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
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
  const theme = useTheme();
  const { permissions } = useRecoilValue(editorInteractionStateAtom);
  const hasPermission = hasPermissionToEditFile(permissions) && !isMobile;

  useEffect(() => {
    if (forceRename) {
      setIsRenaming(true);
    }
  }, [forceRename]);
  if (containerRef.current) {
    containerRef.current.style.order = order;
  }
  return (
    <div
      className={cn(
        'group relative hover:bg-accent',
        active &&
          'sticky left-0 right-0 z-[1] -mt-[1px] !bg-background shadow-[inset_1px_0_0_hsl(var(--border)),inset_-1px_0_0_hsl(var(--border))]'
      )}
      ref={containerRef}
      style={{
        order,
      }}
      data-id={sheet.id}
      data-order={sheet.order}
      data-actual-order={order}
      onPointerDown={(event) => {
        if (isRenaming) return;
        onPointerDown({ event, sheet });
      }}
      onDoubleClick={() => {
        if (hasPermission) {
          setIsRenaming(true);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, sheet)}
    >
      <TabWrapper sheet={sheet} active={active}>
        <TabName
          active={active}
          clearRename={clearRename}
          isRenaming={isRenaming}
          setNameExists={setNameExists}
          setIsRenaming={setIsRenaming}
          sheet={sheet}
        />
        {sheet.id !== sheets.sheet.id && <TabMultiplayer sheetId={sheet.id} />}
        <div className={cn('flex', !active && 'invisible opacity-0 group-hover:visible group-hover:opacity-100')}>
          <TabButton active={active} hasPermission={hasPermission} onContextMenu={onContextMenu} sheet={sheet} />
        </div>
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
    </div>
  );
};

function TabWrapper({ children, sheet, active }: any) {
  const theme = useTheme();
  const { follow } = useRecoilValue(editorInteractionStateAtom);
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={theme.spacing(0.25)}
      sx={{
        pt: '2px', // offset for the 1px box-shadow inset
        pr: theme.spacing(0.5),
        pl: theme.spacing(1.5),
        px: theme.spacing(1.5),
        cursor: 'pointer',
        transition: 'box-shadow 200ms ease 250ms, background-color 200ms ease',
        whiteSpace: 'nowrap',
        height: `calc(100% - ${follow ? '3px' : '0px'})`,
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

function TabName({
  active,
  clearRename,
  isRenaming,
  setNameExists,
  setIsRenaming,
  sheet,
}: {
  active: Props['active'];
  clearRename: Props['clearRename'];
  isRenaming: boolean;
  setIsRenaming: React.Dispatch<React.SetStateAction<boolean>>;
  setNameExists: React.Dispatch<React.SetStateAction<boolean>>;
  sheet: Props['sheet'];
}) {
  const contentEditableRef = useRef<HTMLDivElement | null>(null);

  // When a rename begins, focus contentedtiable and select its contents
  useEffect(() => {
    if (isRenaming) {
      contentEditableRef?.current?.focus();
      selectElementContents(contentEditableRef.current);
    }
  }, [isRenaming, contentEditableRef]);

  return isRenaming ? (
    <div
      contentEditable
      style={{
        minWidth: '1rem',
        fontWeight: 'bold',
        outline: 0,
        cursor: 'text',
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
              sheet.setName(value);
              quadraticCore.setSheetName(sheet.id, value, sheets.getCursorPosition());
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
          event.metaKey ||
          window.getSelection()?.toString()
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
          if (value.trim() === '') return false; // Don't allow empty names
          if (value !== sheet.name) {
            if (!sheets.nameExists(value)) {
              sheet.setName(value);
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
        // Constrain the clipboard paste to allowed input only
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
  );
}

function TabButton({
  active,
  hasPermission,
  onContextMenu,
  sheet,
}: {
  active: Props['active'];
  hasPermission: boolean;
  onContextMenu: Props['onContextMenu'];
  sheet: Props['sheet'];
}) {
  return hasPermission ? (
    <Button
      variant="ghost"
      className={'-mr-1 h-4 w-4'}
      size="icon-sm"
      onClick={(e) => {
        e.stopPropagation();
        onContextMenu(e, sheet);
      }}
    >
      <ArrowDropDownIcon />
    </Button>
  ) : null;
}

function selectElementContents(el: HTMLDivElement | null) {
  if (!el) return;

  var range = document.createRange();
  range.selectNodeContents(el);
  var sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function TabMultiplayer({ sheetId }: { sheetId: string }) {
  const [users, setUsers] = useState<string[]>([]);

  useEffect(() => {
    const updateUsers = () => {
      setUsers(
        multiplayer.getUsers().flatMap((user) => {
          if (user.sheet_id === sheetId) {
            return [user.colorString];
          }
          return [];
        })
      );
    };
    updateUsers();

    events.on('multiplayerChangeSheet', updateUsers);
    events.on('multiplayerUpdate', updateUsers);
    return () => {
      events.off('multiplayerChangeSheet', updateUsers);
      events.off('multiplayerUpdate', updateUsers);
    };
  }, [sheetId]);

  return (
    <div style={{ position: 'absolute', display: 'flex', width: '100%', top: 0, gap: '1px' }}>
      {users.map((color, index) => (
        <div key={index} style={{ width: '5px', height: '5px', backgroundColor: color }} />
      ))}
    </div>
  );
}
