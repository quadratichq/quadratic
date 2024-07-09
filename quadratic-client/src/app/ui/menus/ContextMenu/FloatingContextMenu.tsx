import { downloadSelectionAsCsvAction, hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { copySelectionToPNG, fullClipboardSupport, pasteFromClipboard } from '@/app/grid/actions/clipboard/clipboard';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { focusGrid } from '@/app/helpers/focusGrid';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { colors } from '@/app/theme/colors';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import {
  BorderAllIcon,
  DecimalDecreaseIcon,
  DecimalIncreaseIcon,
  DollarIcon,
  DotsHorizontalIcon,
  FontBoldIcon,
  FontItalicIcon,
  FunctionIcon,
  MagicWandIcon,
  PaintBucketIcon,
  PercentIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextColorIcon,
  TextNoneIcon,
} from '@/app/ui/icons';
import { MenuLineItem } from '@/app/ui/menus/TopBar/MenuLineItem';
import { useGetBorderMenu } from '@/app/ui/menus/TopBar/SubMenus/FormatMenu/useGetBorderMenu';
import {
  clearFillColor,
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
} from '@/app/ui/menus/TopBar/SubMenus/formatCells';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { Divider, IconButton, Toolbar } from '@mui/material';
import { ControlledMenu, Menu, MenuDivider, MenuInstance, MenuItem, useMenuState } from '@szhsin/react-menu';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

// todo: this file needs to be broken up and rewritten

interface Props {
  container?: HTMLDivElement;
  showContextMenu: boolean;
}

const HORIZONTAL_PADDING = 15;
const VERTICAL_PADDING = 20;

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
        e.stopPropagation();
        e.preventDefault();
        moreMenuToggle();
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
    const cursorRectangle = pixiApp.cursor.cursorRectangle;
    if (!cursorRectangle) return;
    const cursorTopLeft = viewport.toScreen(cursorRectangle.x, cursorRectangle.y);
    const cursorBottomRight = viewport.toScreen(
      cursorRectangle.x + cursorRectangle.width,
      cursorRectangle.y + cursorRectangle.height
    );

    const menuHeight = menuDiv.current?.clientHeight || 0;

    let x = cursorTopLeft.x + container.offsetLeft - HORIZONTAL_PADDING;
    let y = cursorTopLeft.y + container.offsetTop - menuHeight - VERTICAL_PADDING;

    /**
     * Control menu visibility
     */
    let visibility: boolean | 'vanish' = true;

    // Hide if zoomed out too much
    if (viewport.scale.x < 0.1) {
      visibility = false;
    }
    // hide if boxCells is active
    if (cursor.boxCells) {
      visibility = false;
    }

    // hide if inline Formula editor is keyboard selecting cells
    if (inlineEditorHandler.cursorIsMoving) visibility = 'vanish';

    // Hide if it's not 1) a multicursor or, 2) an active right click
    if (!(cursor.multiCursor || cursor.columnRow || showContextMenu)) visibility = 'vanish';

    // Hide if currently selecting
    if (pixiApp.pointer?.pointerDown?.active) visibility = 'vanish';

    if (pixiApp.pointer.pointerCellMoving.state === 'move') visibility = 'vanish';

    // Hide if in presentation mode
    if (pixiAppSettings.presentationMode) visibility = 'vanish';

    // Hide if you don't have edit access
    if (!hasPermissionToEditFile(editorInteractionState.permissions)) visibility = 'vanish';

    // Hide FloatingFormatMenu if multi cursor is off screen

    const selection = pixiApp.cursor.cursorRectangle;
    if (!selection) return;
    const viewportBounds = pixiApp.viewport.getVisibleBounds();
    if (!intersects.rectangleRectangle(selection, viewportBounds)) {
      visibility = false;
    }

    // Hide More menu if changing from visible to hidden
    if (
      (moreMenuProps.state === 'open' || moreMenuProps.state === 'opening') &&
      (visibility === false || visibility === 'vanish')
    ) {
      moreMenuToggle(false);
    }

    if (cursor.columnRow?.all) {
      visibility = true;
    }

    // Apply visibility
    // menuDiv.current.style.visibility = visibility;
    if (visibility === true) {
      menuDiv.current.style.opacity = '1';
      menuDiv.current.style.pointerEvents = 'auto';
      menuDiv.current.style.visibility = 'visible';
    } else if (visibility === false) {
      menuDiv.current.style.opacity = '0';
      menuDiv.current.style.pointerEvents = 'none';
      menuDiv.current.style.visibility = 'visible';
    } else if (visibility === 'vanish') {
      menuDiv.current.style.opacity = '0';
      menuDiv.current.style.pointerEvents = 'none';
      menuDiv.current.style.visibility = 'hidden';
    }

    /**
     * Menu positioning
     */

    const columnHeader = pixiApp.headings.headingSize.width;
    const rowHeader = pixiApp.headings.headingSize.height;

    // if outside of viewport keep it inside

    // left
    if (x < container.offsetLeft + HORIZONTAL_PADDING + columnHeader) {
      x = container.offsetLeft + HORIZONTAL_PADDING + columnHeader;
    }

    // right
    else if (x + menuDiv.current.offsetWidth + HORIZONTAL_PADDING > container.offsetLeft + container.offsetWidth) {
      x = Math.max(
        container.offsetLeft + container.offsetWidth - menuDiv.current.offsetWidth - HORIZONTAL_PADDING,
        container.offsetLeft + HORIZONTAL_PADDING
      );
    }

    // top
    if (y < container.offsetTop + HORIZONTAL_PADDING + rowHeader) {
      y = container.offsetTop + HORIZONTAL_PADDING + rowHeader;
    }

    // move cursor to bottom of selection if necessary
    if (y + menuDiv.current.offsetHeight >= cursorTopLeft.y && y <= cursorBottomRight.y) {
      y = cursorBottomRight.y + VERTICAL_PADDING;

      // if selection is too big, then default to the top calculation for y
      if (y + menuDiv.current.offsetHeight >= container.offsetTop + container.offsetHeight) {
        y = container.offsetTop + HORIZONTAL_PADDING + rowHeader;
      }
    }

    if (cursor.columnRow?.all || cursor.multiCursor) {
      const screen = viewport.toScreen(viewportBounds.x + viewportBounds.width / 2, viewportBounds.y);
      x = screen.x - menuDiv.current.offsetWidth / 2;
      y = screen.y + VERTICAL_PADDING + rowHeader;
    }

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
  }, [container, showContextMenu, editorInteractionState.permissions, moreMenuProps.state, moreMenuToggle]);

  // trigger is used to hide the menu when cellMoving
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setTrigger] = useState(0);
  useEffect(() => {
    const { viewport } = pixiApp;
    const trigger = () => setTrigger((prev) => prev + 1);

    if (!viewport) return;
    viewport.on('moved', updateContextMenuCSSTransform);
    viewport.on('moved-end', updateContextMenuCSSTransform);
    document.addEventListener('pointerup', updateContextMenuCSSTransform);
    window.addEventListener('resize', updateContextMenuCSSTransform);
    window.addEventListener('keyup', updateContextMenuCSSTransform);
    events.on('cellMoving', trigger);

    return () => {
      viewport.removeListener('moved', updateContextMenuCSSTransform);
      viewport.removeListener('moved-end', updateContextMenuCSSTransform);
      document.removeEventListener('pointerup', updateContextMenuCSSTransform);
      window.removeEventListener('resize', updateContextMenuCSSTransform);
      window.addEventListener('keyup', updateContextMenuCSSTransform);
      events.off('cellMoving', trigger);
    };
  }, [updateContextMenuCSSTransform]);

  // set input's initial position correctly
  const transform = updateContextMenuCSSTransform();

  const iconSize = 'small';

  return (
    <div
      ref={menuDiv}
      className={` bg-background`}
      style={{
        display: 'block',
        position: 'absolute',
        top: '0',
        left: '0',
        transformOrigin: '0 0',
        transform,
        pointerEvents: 'auto',
        opacity: 0,
        transition: 'opacity 0.2s ease-in-out',
        borderRadius: '2px',
        boxShadow:
          'rgba(0, 0, 0, 0.2) 0px 3px 3px -2px, rgba(0, 0, 0, 0.14) 0px 3px 4px 0px, rgba(0, 0, 0, 0.12) 0px 1px 8px 0px',
      }}
      onClick={(e) => {
        e.stopPropagation();
        mixpanel.track('[FloatingContextMenu].click');
      }}
    >
      <Toolbar
        style={{
          padding: '2px 4px',
          minHeight: '0px',
          color: colors.darkGray,
        }}
      >
        <TooltipHint title="Bold" shortcut={KeyboardSymbols.Command + 'B'}>
          <IconButton size="small" onClick={async () => setBold()}>
            <FontBoldIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Italic" shortcut={KeyboardSymbols.Command + 'I'}>
          <IconButton size="small" onClick={() => setItalic()}>
            <FontItalicIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <Menu
          className="color-picker-submenu"
          instanceRef={textColorRef}
          menuButton={
            <div>
              <TooltipHint title="Text color">
                <IconButton size="small">
                  <TextColorIcon fontSize={iconSize} />
                </IconButton>
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
          <IconButton size="small" onClick={() => setAlignment('left')}>
            <TextAlignLeftIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <TooltipHint title="Align center">
          <IconButton size="small" onClick={() => setAlignment('center')}>
            <TextAlignCenterIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <TooltipHint title="Align right">
          <IconButton size="small" onClick={() => setAlignment('right')}>
            <TextAlignRightIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <MenuDividerVertical />

        <Menu
          className="color-picker-submenu"
          instanceRef={fillColorRef}
          menuButton={
            <div>
              <TooltipHint title="Fill color">
                <IconButton size="small">
                  <PaintBucketIcon fontSize={iconSize} />
                </IconButton>
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
              clearFillColor();
              focusGrid();
            }}
          />
        </Menu>
        {!borders ? (
          <TooltipHint title="Borders">
            <span>
              <IconButton size="small" disabled={true}>
                <BorderAllIcon fontSize={iconSize} />
              </IconButton>
            </span>
          </TooltipHint>
        ) : (
          <Menu
            menuButton={
              <div>
                <TooltipHint title="Borders">
                  <span>
                    <IconButton size="small">
                      <BorderAllIcon fontSize={iconSize} />
                    </IconButton>
                  </span>
                </TooltipHint>
              </div>
            }
          >
            {borders}
          </Menu>
        )}
        <MenuDividerVertical />

        <TooltipHint title="Format automatically">
          <IconButton size="small" onClick={() => removeCellNumericFormat()}>
            <MagicWandIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Format as currency">
          <IconButton size="small" onClick={() => textFormatSetCurrency()}>
            <DollarIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Format as percentage">
          <IconButton size="small" onClick={() => textFormatSetPercentage()}>
            <PercentIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Format as scientific">
          <IconButton size="small" onClick={() => textFormatSetExponential()}>
            <FunctionIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Decrease decimal places">
          <IconButton size="small" onClick={() => textFormatDecreaseDecimalPlaces()}>
            <DecimalDecreaseIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Increase decimal places">
          <IconButton size="small" onClick={() => textFormatIncreaseDecimalPlaces()}>
            <DecimalIncreaseIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <MenuDividerVertical />
        <TooltipHint title="Clear formatting" shortcut={KeyboardSymbols.Command + '\\'}>
          <IconButton size="small" onClick={clearFormattingAndBorders}>
            <TextNoneIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        {fullClipboardSupport() && <MenuDividerVertical />}
        {fullClipboardSupport() && (
          <TooltipHint title="More commands…">
            <IconButton size="small" onClick={() => moreMenuToggle()} ref={moreMenuButtonRef}>
              <DotsHorizontalIcon fontSize={iconSize} />
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
              pasteFromClipboard('Values');
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
              pasteFromClipboard('Formats');
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
