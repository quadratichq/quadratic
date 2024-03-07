import { PasteSpecial } from '@/quadratic-core/quadratic_core';
import { Button } from '@/shadcn/ui/button';
import {
  AttachMoneyOutlined,
  ContentPasteGoOutlined,
  ContentPasteSearchOutlined,
  Functions,
  MoreHoriz,
  Percent,
} from '@mui/icons-material';
import { Divider, IconButton, Toolbar } from '@mui/material';
import {
  BorderAllIcon,
  ComponentBooleanIcon,
  FontBoldIcon,
  FontItalicIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextNoneIcon,
} from '@radix-ui/react-icons';
import { ControlledMenu, Menu, MenuDivider, MenuInstance, MenuItem, useMenuState } from '@szhsin/react-menu';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { downloadSelectionAsCsvAction, hasPermissionToEditFile } from '../../../actions';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '../../../components/GlobalSnackbarProvider';
import {
  copySelectionToPNG,
  fullClipboardSupport,
  pasteFromClipboard,
} from '../../../grid/actions/clipboard/clipboard';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '../../../gridGL/pixiApp/PixiAppSettings';
import { focusGrid } from '../../../helpers/focusGrid';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { colors } from '../../../theme/colors';
import { useFileContext } from '../../components/FileProvider';
import { TooltipHint } from '../../components/TooltipHint';
import { QColorPicker } from '../../components/qColorPicker';
import { DecimalDecrease, DecimalIncrease, Icon123 } from '../../icons';
import { MenuLineItem } from '../TopBar/MenuLineItem';
import { useGetBorderMenu } from '../TopBar/SubMenus/FormatMenu/useGetBorderMenu';
import {
  clearFormattingAndBorders,
  removeCellNumericFormat,
  setAlignment,
  setBold,
  setFillColor,
  setItalic,
  setTextColor,
  textFormatDecreaseDecimalPlaces,
  textFormatIncreaseDecimalPlaces,
  textFormatSetCurrency,
  textFormatSetExponential,
  textFormatSetPercentage,
} from '../TopBar/SubMenus/formatCells';

interface Props {
  container?: HTMLDivElement;
  showContextMenu: boolean;
}

export const FloatingContextMenu = (props: Props) => {
  const { container, showContextMenu } = props;
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const [moreMenuProps, moreMenuToggle] = useMenuState();
  const menuDiv = useRef<HTMLDivElement>(null);
  const moreMenuButtonRef = useRef(null);
  const borders = useGetBorderMenu();
  const { name: fileName } = useFileContext();

  const textColorRef = useRef<MenuInstance>(null);
  const fillColorRef = useRef<MenuInstance>(null);

  // close the more menu on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (moreMenuProps.state === 'open' && e.key === 'Escape') {
        moreMenuToggle();
        e.stopPropagation();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreMenuProps.state, moreMenuToggle]);

  // Function used to move and scale the Input with the Grid
  const updateContextMenuCSSTransform = useCallback(() => {
    if (!container || !menuDiv.current) return '';

    const { viewport } = pixiApp;

    const sheet = sheets.sheet;
    const cursor = sheet.cursor;

    // Calculate position of input based on cell
    const cell_offsets = sheet.getCellOffsets(
      cursor.multiCursor
        ? Math.min(cursor.cursorPosition.x, cursor.multiCursor.originPosition.x, cursor.multiCursor.terminalPosition.x)
        : cursor.cursorPosition.x,
      cursor.multiCursor
        ? Math.min(cursor.cursorPosition.y, cursor.multiCursor.originPosition.y, cursor.multiCursor.terminalPosition.y)
        : cursor.cursorPosition.y
    );
    let cell_offset_scaled = viewport.toScreen(cell_offsets.x, cell_offsets.y);

    const menuHeight = menuDiv.current?.clientHeight || 0;

    let x = cell_offset_scaled.x + container.offsetLeft - 20;
    let y = cell_offset_scaled.y + container.offsetTop - menuHeight - 20;

    /**
     * Control menu visibility
     */
    let visibility = 'visible';

    // Hide if zoomed out too much
    if (viewport.scale.x < 0.1) {
      visibility = 'hidden';
    }
    // hide if boxCells is active
    if (cursor.boxCells) {
      visibility = 'hidden';
    }

    // Hide if it's not 1) a multicursor or, 2) an active right click
    if (!(cursor.multiCursor || showContextMenu)) visibility = 'hidden';

    // Hide if currently selecting
    if (pixiApp.pointer?.pointerDown?.active) visibility = 'hidden';

    // Hide if in presentation mode
    if (pixiAppSettings.presentationMode) visibility = 'hidden';

    // Hide if you don't have edit access
    if (!hasPermissionToEditFile(editorInteractionState.permissions)) visibility = 'hidden';

    // Hide FloatingFormatMenu if multi cursor is off screen
    const terminal_pos = sheet.getCellOffsets(
      cursor.multiCursor ? cursor.multiCursor.terminalPosition.x : cursor.cursorPosition.x,
      cursor.multiCursor ? cursor.multiCursor.terminalPosition.y : cursor.cursorPosition.y
    );
    let multiselect_offset = viewport.toScreen(
      terminal_pos.x + terminal_pos.width,
      terminal_pos.y + terminal_pos.height
    );
    if (multiselect_offset.x < 0 || multiselect_offset.y < 0) visibility = 'hidden';

    // Hide More menu if changing from visible to hidden
    if (menuDiv.current.style.visibility === 'visible' && visibility === 'hidden') moreMenuToggle(false);

    // Apply visibility
    menuDiv.current.style.visibility = visibility;

    /**
     * Menu positioning
     */

    // if outside of viewport keep it inside
    if (x < container.offsetLeft + 35) {
      x = container.offsetLeft + 35;
    } // left
    if (y < container.offsetTop + 35) {
      y = container.offsetTop + 35;
    } // top

    // Generate transform CSS
    const transform = 'translate(' + [x, y].join('px,') + 'px) ';
    // Update input css matrix
    menuDiv.current.style.transform = transform;

    // Disable pointer events while the viewport is moving
    if (viewport.moving) {
      menuDiv.current.style.pointerEvents = 'none';
      // make sure when we are setting pointer event to none
      // that we check again soon to see if the viewport is done moving
      setTimeout(updateContextMenuCSSTransform, 100);
    } else menuDiv.current.style.pointerEvents = 'auto';
    return transform;
  }, [container, showContextMenu, editorInteractionState.permissions, moreMenuToggle]);

  useEffect(() => {
    const { viewport } = pixiApp;

    if (!viewport) return;
    viewport.on('moved', updateContextMenuCSSTransform);
    viewport.on('moved-end', updateContextMenuCSSTransform);
    document.addEventListener('pointerup', updateContextMenuCSSTransform);
    window.addEventListener('resize', updateContextMenuCSSTransform);

    return () => {
      viewport.removeListener('moved', updateContextMenuCSSTransform);
      viewport.removeListener('moved-end', updateContextMenuCSSTransform);
      document.removeEventListener('pointerup', updateContextMenuCSSTransform);
      window.removeEventListener('resize', updateContextMenuCSSTransform);
    };
  }, [updateContextMenuCSSTransform]);

  // set input's initial position correctly
  const transform = updateContextMenuCSSTransform();

  const iconSize = 'small';

  return (
    <div
      ref={menuDiv}
      className={`bg-background shadow-lg`}
      style={{
        display: 'block',
        position: 'absolute',
        top: '0',
        left: '0',
        transformOrigin: '0 0',
        transform,
        pointerEvents: 'auto',
        visibility: 'hidden',
        borderRadius: '2px',
      }}
      onClick={(e) => {
        mixpanel.track('[FloatingContextMenu].click');
        e.stopPropagation();
      }}
    >
      <Toolbar
        style={{
          padding: '4px 4px',
          minHeight: '0px',
          color: colors.darkGray,
        }}
      >
        <TooltipHint title="Bold" shortcut={KeyboardSymbols.Command + 'B'}>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              const formatPrimaryCell = sheets.sheet.getFormatPrimaryCell();
              setBold(!formatPrimaryCell?.bold);
            }}
          >
            <FontBoldIcon className="h-4 w-4" />
          </Button>
        </TooltipHint>

        <TooltipHint title="Italic" shortcut={KeyboardSymbols.Command + 'I'}>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              const formatPrimaryCell = sheets.sheet.getFormatPrimaryCell();
              setItalic(!formatPrimaryCell?.italic);
            }}
          >
            <FontItalicIcon className="h-4 w-4" />
          </Button>
        </TooltipHint>
        <Menu
          className="color-picker-submenu"
          instanceRef={textColorRef}
          menuButton={
            <div>
              <TooltipHint title="Text color">
                <Button size="icon" variant="ghost">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M7.84088 2.07664C7.76832 1.88034 7.58118 1.75 7.3719 1.75C7.16261 1.75 6.97547 1.88034 6.90291 2.07664L3.82754 10.3962C3.73179 10.6552 3.86415 10.9428 4.12316 11.0386C4.38217 11.1343 4.66976 11.002 4.76551 10.7429L5.77352 8.01603H8.97027L9.97828 10.7429C10.074 11.002 10.3616 11.1343 10.6206 11.0386C10.8796 10.9428 11.012 10.6552 10.9163 10.3962L7.84088 2.07664ZM8.65606 7.16603L7.3719 3.69207L6.08773 7.16603H8.65606Z"
                      fill="currentColor"
                    />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M3.00134 13.5C3.00134 13.2239 3.2252 13 3.50134 13H11.4987C11.7749 13 11.9987 13.2239 11.9987 13.5C11.9987 13.7761 11.7749 14 11.4987 14H3.50134C3.2252 14 3.00134 13.7761 3.00134 13.5Z"
                      fill="currentColor"
                    />
                  </svg>
                </Button>
              </TooltipHint>
            </div>
          }
        >
          <QColorPicker
            onChangeComplete={(color) => {
              textColorRef.current?.closeMenu();
              setTextColor(color);
              focusGrid();
            }}
            onClear={() => {
              textColorRef.current?.closeMenu();
              setTextColor(undefined);
              focusGrid();
            }}
          />
        </Menu>

        <MenuDividerVertical />

        <TooltipHint title="Align left">
          <Button size="icon" variant="ghost" onClick={() => setAlignment('left')}>
            <TextAlignLeftIcon className="h-4 w-4" />
          </Button>
        </TooltipHint>
        <TooltipHint title="Align center">
          <Button size="icon" variant="ghost" onClick={() => setAlignment('center')}>
            <TextAlignCenterIcon className="h-4 w-4" />
          </Button>
        </TooltipHint>
        <TooltipHint title="Align right">
          <Button size="icon" variant="ghost" onClick={() => setAlignment('right')}>
            <TextAlignRightIcon className="h-4 w-4" />
          </Button>
        </TooltipHint>

        <MenuDividerVertical />

        <Menu
          className="color-picker-submenu"
          instanceRef={fillColorRef}
          menuButton={
            <div>
              <TooltipHint title="Fill color">
                <Button size="icon" variant="ghost">
                  <ComponentBooleanIcon className="h-4 w-4" />
                </Button>
              </TooltipHint>
            </div>
          }
        >
          <QColorPicker
            onChangeComplete={(color) => {
              fillColorRef.current?.closeMenu();
              setFillColor(color);
              focusGrid();
            }}
            onClear={() => {
              fillColorRef.current?.closeMenu();
              setFillColor(undefined);
              focusGrid();
            }}
          />
        </Menu>
        <Menu
          menuButton={
            <div>
              <TooltipHint title="Borders">
                <Button size="icon" variant="ghost">
                  <BorderAllIcon className="h-4 w-4" />
                </Button>
              </TooltipHint>
            </div>
          }
        >
          {borders}
        </Menu>

        <MenuDividerVertical />

        <TooltipHint title="Format as automatic">
          <IconButton size="small" onClick={() => removeCellNumericFormat()} color="inherit">
            <Icon123 fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Format as currency">
          <IconButton size="small" onClick={() => textFormatSetCurrency()} color="inherit">
            <AttachMoneyOutlined fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Format as percentage">
          <IconButton size="small" onClick={() => textFormatSetPercentage()} color="inherit">
            <Percent fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Format as scientific">
          <IconButton size="small" onClick={() => textFormatSetExponential()} color="inherit">
            <Functions fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Decrease decimal places">
          <IconButton size="small" onClick={() => textFormatDecreaseDecimalPlaces()} color="inherit">
            <DecimalDecrease fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Increase decimal places">
          <IconButton size="small" onClick={() => textFormatIncreaseDecimalPlaces()} color="inherit">
            <DecimalIncrease fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <MenuDividerVertical />
        <TooltipHint title="Clear formatting" shortcut={KeyboardSymbols.Command + '\\'}>
          <Button size="icon" variant="ghost" onClick={clearFormattingAndBorders}>
            <TextNoneIcon className="h-4 w-4" />
          </Button>
        </TooltipHint>
        {fullClipboardSupport() && <MenuDividerVertical />}
        {fullClipboardSupport() && (
          <TooltipHint title="More commands…">
            <IconButton size="small" onClick={() => moreMenuToggle()} color="inherit" ref={moreMenuButtonRef}>
              <MoreHoriz fontSize={iconSize} />
            </IconButton>
          </TooltipHint>
        )}
        <ControlledMenu
          state={moreMenuProps.state}
          menuStyle={{ padding: '2px 0', color: 'inherit' }}
          anchorRef={moreMenuButtonRef}
        >
          <MenuItem
            onClick={() => {
              pasteFromClipboard(PasteSpecial.Values);
              moreMenuToggle();
            }}
          >
            <MenuLineItem
              primary="Paste values only"
              secondary={KeyboardSymbols.Command + KeyboardSymbols.Shift + 'V'}
              Icon={ContentPasteGoOutlined}
            />
          </MenuItem>
          <MenuItem
            onClick={() => {
              pasteFromClipboard(PasteSpecial.Formats);
              moreMenuToggle();
            }}
          >
            <MenuLineItem primary="Paste formatting only" Icon={ContentPasteSearchOutlined} />
          </MenuItem>
          <MenuDivider />
          <MenuItem
            onClick={async () => {
              await copySelectionToPNG(addGlobalSnackbar);
              moreMenuToggle();
            }}
          >
            <MenuLineItem
              primary="Copy selection as PNG"
              secondary={KeyboardSymbols.Command + KeyboardSymbols.Shift + 'C'}
            ></MenuLineItem>
          </MenuItem>
          <MenuItem
            onClick={() => {
              downloadSelectionAsCsvAction.run({ fileName });
              moreMenuToggle();
            }}
          >
            <MenuLineItem
              primary={downloadSelectionAsCsvAction.label}
              secondary={KeyboardSymbols.Command + KeyboardSymbols.Shift + 'E'}
            ></MenuLineItem>
          </MenuItem>
        </ControlledMenu>
      </Toolbar>
    </div>
  );
};

function MenuDividerVertical() {
  return (
    <Divider
      orientation="vertical"
      flexItem
      style={{
        margin: '4px',
      }}
    />
  );
}
