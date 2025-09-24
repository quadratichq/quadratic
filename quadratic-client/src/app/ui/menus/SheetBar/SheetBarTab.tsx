import { hasPermissionToEditFile } from '@/app/actions';
import {
  editorInteractionStateFollowAtom,
  editorInteractionStatePermissionsAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import { focusGrid } from '@/app/helpers/focusGrid';
import { validateSheetName } from '@/app/quadratic-core/quadratic_core';
import { SheetBarTabDropdownMenu } from '@/app/ui/menus/SheetBar/SheetBarTabDropdownMenu';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { cn } from '@/shared/shadcn/utils';
import { Fade, Paper, Popper, Stack, Typography, useTheme } from '@mui/material';
import type { JSX, PointerEvent } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { useRecoilValue } from 'recoil';

const SHEET_NAME_MAX_LENGTH = 50;

// This is a hack to prevent the tab from blurring immediately when entering
// renaming from right click or menu. This is a hack probably because of too
// much rendering of components.
const HACK_TO_NOT_BLUR_ON_RENAME = 250;

interface SheetBarTabProps {
  sheet: Sheet;
  id: string;
  color?: string;
  order: string;
  calculatedOrder: string;
  active: boolean;
  name: string;
  onPointerDown: (options: { event: PointerEvent<HTMLDivElement>; sheet: Sheet }) => void;
  forceRename: boolean;
  clearRename: () => void;
}

export const SheetBarTab = memo((props: SheetBarTabProps): JSX.Element => {
  const { sheet, name, id, calculatedOrder, order, active, onPointerDown, forceRename, clearRename } = props;

  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isRenaming, setIsRenaming] = useState(false);
  const theme = useTheme();
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const hasPermission = hasPermissionToEditFile(permissions) && !isMobile;

  useEffect(() => {
    if (forceRename) {
      setIsRenaming(true);
    }
  }, [forceRename]);

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    setDiv(node);
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'group relative hover:bg-accent',
        active &&
          'sticky left-0 right-0 z-[1] -mt-[1px] !bg-background shadow-[inset_1px_0_0_hsl(var(--border)),inset_-1px_0_0_hsl(var(--border))]'
      )}
      style={{
        order: calculatedOrder,
      }}
      data-id={id}
      data-order={order}
      data-test-sheet-name={name}
      data-actual-order={calculatedOrder}
      onPointerDown={(event) => {
        if (isRenaming) return;
        onPointerDown({ event, sheet });
      }}
      onDoubleClick={() => {
        if (hasPermission) {
          setIsRenaming(true);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setIsOpenDropdown(true);
      }}
    >
      <TabWrapper sheet={sheet} active={active}>
        <TabName
          name={sheet.name}
          active={active}
          clearRename={clearRename}
          isRenaming={isRenaming}
          setErrorMessage={setErrorMessage}
          setIsRenaming={setIsRenaming}
          sheet={sheet}
        />
        {id !== sheets.current && <TabMultiplayer sheetId={id} />}
        <div className={cn('flex', !active && 'invisible opacity-0 group-hover:visible group-hover:opacity-100')}>
          {hasPermission && (
            <SheetBarTabDropdownMenu
              isOpen={isOpenDropdown}
              setIsOpen={setIsOpenDropdown}
              handleClose={() => setIsOpenDropdown(false)}
              handleRename={() => setIsRenaming(true)}
            />
          )}
        </div>
        <Popper open={!!errorMessage} anchorEl={div} transition>
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
                <Typography variant="caption">{errorMessage}</Typography>
              </Paper>
            </Fade>
          )}
        </Popper>
      </TabWrapper>
    </div>
  );
});

const TabWrapper = memo(({ children, sheet, active }: any) => {
  const theme = useTheme();
  const follow = useRecoilValue(editorInteractionStateFollowAtom);
  return (
    <Stack
      className={cn(active && 'text-primary')}
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
        '&:hover .MuiIconButton-root': {
          opacity: 1,
          visibility: 'visible',
        },
      }}
    >
      {children}
    </Stack>
  );
});

const TabName = memo(
  ({
    active,
    clearRename,
    isRenaming,
    setErrorMessage,
    setIsRenaming,
    sheet,
    name,
  }: {
    active: SheetBarTabProps['active'];
    clearRename: SheetBarTabProps['clearRename'];
    isRenaming: boolean;
    setIsRenaming: React.Dispatch<React.SetStateAction<boolean>>;
    setErrorMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
    sheet: SheetBarTabProps['sheet'];
    name: SheetBarTabProps['name'];
  }) => {
    const contentEditableRef = useRef<HTMLDivElement | null>(null);
    const isRenamingTimeRef = useRef(0);

    const validateName = useCallback(
      (value: string) => {
        try {
          validateSheetName(value, sheet.id, sheets.jsA1Context);
          return true;
        } catch (error) {
          setErrorMessage(error as string);
          setTimeout(() => setErrorMessage(undefined), 1500);
          return false;
        }
      },
      [setErrorMessage, sheet.id]
    );

    // When a rename begins, focus contenteditable and select its contents
    useEffect(() => {
      if (isRenaming) {
        contentEditableRef?.current?.focus();
        selectElementContents(contentEditableRef.current);
        isRenamingTimeRef.current = Date.now();
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
          const value = (div.textContent || '').trim();
          if (event.code === 'Enter') {
            if (value !== name) {
              if (!validateName(value)) {
                event.preventDefault();
                div.focus();
                return;
              } else {
                setErrorMessage(undefined);
                setIsRenaming(false);
                sheet.setName(value, false);
              }
            }
            focusGrid();
          } else if (event.code === 'Escape') {
            setIsRenaming(false);
            setErrorMessage(undefined);
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
        onInput={() => setErrorMessage(undefined)}
        onBlur={(event) => {
          if (!contentEditableRef.current) return;
          if (Date.now() - isRenamingTimeRef.current < HACK_TO_NOT_BLUR_ON_RENAME) {
            contentEditableRef.current?.focus();
            return;
          }
          const div = contentEditableRef.current;
          const value = div.innerText.trim();
          if (!div) return false;
          if (!isRenaming) return;
          setIsRenaming((isRenaming) => {
            if (!isRenaming) return false;
            if (!!value && value !== name && validateName(value)) {
              sheet.setName(value, false);
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
        dangerouslySetInnerHTML={{ __html: name }}
      />
    ) : (
      <div
        data-title={name}
        className={cn(
          active && 'font-bold',
          // Little trick to bold the text without making the content of
          // the tab change in width
          'after:visibility-hidden after:block after:h-[1px] after:overflow-hidden after:font-bold after:text-transparent after:content-[attr(data-title)]'
        )}
      >
        {name}
      </div>
    );
  }
);

function selectElementContents(el: HTMLDivElement | null) {
  if (!el) return;

  var range = document.createRange();
  range.selectNodeContents(el);
  var sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

const TabMultiplayer = memo(({ sheetId }: { sheetId: string }) => {
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
});
