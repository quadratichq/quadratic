import { PasteSpecial } from '@/quadratic-core/quadratic_core';
import { Button } from '@/shadcn/ui/button';
import {
  DecimalDecreaseIcon,
  DecimalIncreaseIcon,
  DollarIcon,
  FunctionIcon,
  PaintBucketIcon,
  PercentIcon,
  TextColorIcon,
} from '@/ui/icons/radix';
import { Divider, Toolbar } from '@mui/material';
import {
  BorderNoneIcon,
  DotsHorizontalIcon,
  FontBoldIcon,
  FontItalicIcon,
  MagicWandIcon,
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
import { useFileContext } from '../../components/FileProvider';
import { TooltipHint } from '../../components/TooltipHint';
import { QColorPicker } from '../../components/qColorPicker';
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
    window.addEventListener('keyup', updateContextMenuCSSTransform);

    return () => {
      viewport.removeListener('moved', updateContextMenuCSSTransform);
      viewport.removeListener('moved-end', updateContextMenuCSSTransform);
      document.removeEventListener('pointerup', updateContextMenuCSSTransform);
      window.removeEventListener('resize', updateContextMenuCSSTransform);
      window.addEventListener('keyup', updateContextMenuCSSTransform);
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
        }}
      >
        <TooltipHint title="Bold" shortcut={KeyboardSymbols.Command + 'B'}>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              const formatPrimaryCell = sheets.sheet.getFormatPrimaryCell();
              setBold(!formatPrimaryCell?.bold);
            }}
          >
            <FontBoldIcon className="h-5 w-5" />
          </Button>
        </TooltipHint>

        <TooltipHint title="Italic" shortcut={KeyboardSymbols.Command + 'I'}>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              const formatPrimaryCell = sheets.sheet.getFormatPrimaryCell();
              setItalic(!formatPrimaryCell?.italic);
            }}
          >
            <FontItalicIcon className="h-5 w-5" />
          </Button>
        </TooltipHint>
        <Menu
          className="color-picker-submenu"
          instanceRef={textColorRef}
          menuButton={
            <div>
              <TooltipHint title="Text color">
                <Button size="icon-sm" variant="ghost">
                  <TextColorIcon className="h-5 w-5" />
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
          <Button size="icon-sm" variant="ghost" onClick={() => setAlignment('left')}>
            <TextAlignLeftIcon className="h-5 w-5" />
          </Button>
        </TooltipHint>
        <TooltipHint title="Align center">
          <Button size="icon-sm" variant="ghost" onClick={() => setAlignment('center')}>
            <TextAlignCenterIcon className="h-5 w-5" />
          </Button>
        </TooltipHint>
        <TooltipHint title="Align right">
          <Button size="icon-sm" variant="ghost" onClick={() => setAlignment('right')}>
            <TextAlignRightIcon className="h-5 w-5" />
          </Button>
        </TooltipHint>

        <MenuDividerVertical />

        <Menu
          className="color-picker-submenu"
          instanceRef={fillColorRef}
          menuButton={
            <div>
              <TooltipHint title="Fill color">
                <Button size="icon-sm" variant="ghost">
                  <PaintBucketIcon className="h-5 w-5" />
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
                <Button size="icon-sm" variant="ghost">
                  <BorderNoneIcon className="h-5 w-5" />
                </Button>
              </TooltipHint>
            </div>
          }
        >
          {borders}
        </Menu>

        <MenuDividerVertical />

        <TooltipHint title="Format automatically">
          <Button size="icon-sm" variant="ghost" onClick={() => removeCellNumericFormat()}>
            <MagicWandIcon fontSize={iconSize} />
          </Button>
        </TooltipHint>

        <TooltipHint title="Format as currency">
          <Button size="icon-sm" variant="ghost" onClick={() => textFormatSetCurrency()}>
            <DollarIcon className="h-5 w-5" />
          </Button>
        </TooltipHint>

        <TooltipHint title="Format as percentage">
          <Button size="icon-sm" variant="ghost" onClick={() => textFormatSetPercentage()}>
            <PercentIcon className="h-5 w-5" />
          </Button>
        </TooltipHint>

        <TooltipHint title="Format as scientific">
          <Button size="icon-sm" variant="ghost" onClick={() => textFormatSetExponential()}>
            <FunctionIcon className="h-5 w-5" />
          </Button>
        </TooltipHint>

        <TooltipHint title="Decrease decimal places">
          <Button size="icon-sm" variant="ghost" onClick={() => textFormatDecreaseDecimalPlaces()}>
            <DecimalDecreaseIcon />
          </Button>
        </TooltipHint>

        <TooltipHint title="Increase decimal places">
          <Button size="icon-sm" variant="ghost" onClick={() => textFormatIncreaseDecimalPlaces()}>
            <DecimalIncreaseIcon />
          </Button>
        </TooltipHint>

        <MenuDividerVertical />
        <TooltipHint title="Clear formatting" shortcut={KeyboardSymbols.Command + '\\'}>
          <Button size="icon-sm" variant="ghost" onClick={clearFormattingAndBorders}>
            <TextNoneIcon className="h-5 w-5" />
          </Button>
        </TooltipHint>
        {fullClipboardSupport() && <MenuDividerVertical />}
        {fullClipboardSupport() && (
          <TooltipHint title="More commands…">
            <Button size="icon-sm" variant="ghost" onClick={() => moreMenuToggle()} ref={moreMenuButtonRef}>
              <DotsHorizontalIcon className="h-5 w-5" />
            </Button>
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
            />
          </MenuItem>
          <MenuItem
            onClick={() => {
              pasteFromClipboard(PasteSpecial.Formats);
              moreMenuToggle();
            }}
          >
            <MenuLineItem primary="Paste formatting only" />
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
