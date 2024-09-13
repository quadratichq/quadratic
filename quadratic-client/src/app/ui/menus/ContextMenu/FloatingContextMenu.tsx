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
import { CellAlign, CellVerticalAlign, CellWrap } from '@/app/quadratic-core-types';
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
  ExpandMoreIcon,
  FontBoldIcon,
  FontItalicIcon,
  FunctionIcon,
  MagicWandIcon,
  PaintBucketIcon,
  PercentIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TextClipIcon,
  TextColorIcon,
  TextNoneIcon,
  TextOverflowIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
  TextVerticalAlignBottomIcon,
  TextVerticalAlignMiddleIcon,
  TextVerticalAlignTopIcon,
  WrapTextIcon,
} from '@/app/ui/icons';
import { MenuLineItem } from '@/app/ui/menus/TopBar/MenuLineItem';
import { useGetBorderMenu } from '@/app/ui/menus/TopBar/SubMenus/FormatMenu/useGetBorderMenu';
import {
  clearFillColor,
  clearFormattingAndBorders,
  removeCellNumericFormat,
  setAlign,
  setBold,
  setFillColor,
  setItalic,
  setStrikeThrough,
  setTextColor,
  setUnderline,
  setVerticalAlign,
  setWrap,
  textFormatDecreaseDecimalPlaces,
  textFormatIncreaseDecimalPlaces,
  textFormatSetCurrency,
  textFormatSetExponential,
  textFormatSetPercentage,
} from '@/app/ui/menus/TopBar/SubMenus/formatCells';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { Divider, IconButton, Toolbar } from '@mui/material';
import { ControlledMenu, Menu, MenuDivider, MenuInstance, MenuItem, useMenuState } from '@szhsin/react-menu';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import './floatingMenuStyles.scss';

// todo: this file needs to be broken up and rewritten

interface Props {
  container?: HTMLDivElement;
}

const HORIZONTAL_PADDING = 15;
const VERTICAL_PADDING = 20;

export const FloatingContextMenu = (props: Props) => {
  const { container } = props;
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const showContextMenu = editorInteractionState.showContextMenu;
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

  // formatting state at cursor position
  const [cursorBold, setCursorBold] = useState(false);
  const [cursorItalic, setCursorItalic] = useState(false);
  const [cursorTextColor, setCursorTextColor] = useState('');
  const [cursorAlign, setCursorAlign] = useState<CellAlign>('left');
  const [cursorVerticalAlign, setCursorVerticalAlign] = useState<CellVerticalAlign>('top');
  const [cursorWrap, setCursorWrap] = useState<CellWrap>('overflow');
  const [cursorFillColor, setCursorFillColor] = useState('');
  const [cursorUnderline, setCursorUnderline] = useState(false);
  const [cursorStrikethrough, setCursorStrikethrough] = useState(false);

  // fetch render cell from core and update formatting state at cursor position
  const updateContextMenuState = useCallback(async () => {
    if (!showContextMenu) return;
    const sheetId = sheets.current;
    const location = sheets.sheet.cursor.cursorPosition;
    const formatSummary = await quadraticCore.getCellFormatSummary(sheetId, location.x, location.y, true);
    setCursorBold(!!formatSummary.bold);
    setCursorItalic(!!formatSummary.italic);
    setCursorTextColor(formatSummary.textColor ?? '');
    setCursorAlign(formatSummary.align ?? 'left');
    setCursorVerticalAlign(formatSummary.verticalAlign ?? 'top');
    setCursorWrap(formatSummary.wrap ?? 'overflow');
    const fillColor = formatSummary.fillColor ?? '';
    setCursorFillColor(fillColor === 'blank' ? '' : fillColor);
    setCursorUnderline(!!formatSummary.underline);
    setCursorStrikethrough(!!formatSummary.strikeThrough);
  }, [showContextMenu]);

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
    events.on('cursorPosition', updateContextMenuState);
    events.on('sheetFills', updateContextMenuState);

    return () => {
      viewport.removeListener('moved', updateContextMenuCSSTransform);
      viewport.removeListener('moved-end', updateContextMenuCSSTransform);
      document.removeEventListener('pointerup', updateContextMenuCSSTransform);
      window.removeEventListener('resize', updateContextMenuCSSTransform);
      window.removeEventListener('keyup', updateContextMenuCSSTransform);
      events.off('cellMoving', trigger);
      events.off('cursorPosition', updateContextMenuState);
      events.off('sheetFills', updateContextMenuState);
    };
  }, [updateContextMenuCSSTransform, updateContextMenuState]);

  // set input's initial position correctly
  const transform = updateContextMenuCSSTransform();

  const iconSize = 'small';
  const iconBtnSx = { borderRadius: '2px' };

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
          padding: '4px',
          minHeight: '0px',
          color: colors.darkGray,
        }}
      >
        <TooltipHint title="Bold" shortcut={KeyboardSymbols.Command + 'B'}>
          <IconButton
            size="small"
            onClick={async () => {
              await setBold();
              updateContextMenuState();
            }}
            sx={iconBtnSx}
          >
            <FontBoldIcon fontSize={iconSize} style={{ color: cursorBold ? 'black' : 'inherit' }} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Italic" shortcut={KeyboardSymbols.Command + 'I'}>
          <IconButton
            size="small"
            onClick={async () => {
              await setItalic();
              updateContextMenuState();
            }}
            sx={iconBtnSx}
          >
            <FontItalicIcon fontSize={iconSize} style={{ color: cursorItalic ? 'black' : 'inherit' }} />
          </IconButton>
        </TooltipHint>

        <Menu
          className="color-picker-submenu"
          instanceRef={textColorRef}
          menuButton={
            <div>
              <TooltipHint title="Text color">
                <IconButton size="small" sx={iconBtnSx}>
                  <TextColorIcon fontSize={iconSize} style={{ color: cursorTextColor ? cursorTextColor : 'inherit' }} />
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
              updateContextMenuState();
            }}
            onClear={() => {
              textColorRef.current?.closeMenu();
              setTextColor(undefined);
              focusGrid();
              updateContextMenuState();
            }}
          />
        </Menu>

        <MenuDividerVertical />

        <TooltipHint title="Underline" shortcut={KeyboardSymbols.Command + 'U'}>
          <IconButton
            size="small"
            onClick={async () => {
              await setUnderline();
              updateContextMenuState();
            }}
            sx={iconBtnSx}
          >
            <TextUnderlineIcon fontSize={iconSize} style={{ color: cursorUnderline ? 'black' : 'inherit' }} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Strikethrough" shortcut={KeyboardSymbols.Command + '5'}>
          <IconButton
            size="small"
            onClick={async () => {
              await setStrikeThrough();
              updateContextMenuState();
            }}
            sx={iconBtnSx}
          >
            <TextStrikethroughIcon fontSize={iconSize} style={{ color: cursorStrikethrough ? 'black' : 'inherit' }} />
          </IconButton>
        </TooltipHint>

        <MenuDividerVertical />

        <Menu
          className="text-submenu"
          menuButton={
            <div>
              <TooltipHint title="Horizontal align">
                <IconButton size="small" sx={iconBtnSx}>
                  {AlignIcon(cursorAlign)}
                  <ExpandMoreIcon fontSize={'inherit'} style={{ fontSize: '12px' }} />
                </IconButton>
              </TooltipHint>
            </div>
          }
        >
          <div style={{ padding: '0px 4px' }}>
            <TooltipHint title="Align left">
              <IconButton
                size="small"
                onClick={() => {
                  setAlign('left');
                  updateContextMenuState();
                }}
                sx={iconBtnSx}
              >
                <TextAlignLeftIcon fontSize={iconSize} />
              </IconButton>
            </TooltipHint>
            <TooltipHint title="Align center">
              <IconButton
                size="small"
                onClick={() => {
                  setAlign('center');
                  updateContextMenuState();
                }}
                sx={iconBtnSx}
              >
                <TextAlignCenterIcon fontSize={iconSize} />
              </IconButton>
            </TooltipHint>
            <TooltipHint title="Align right">
              <IconButton
                size="small"
                onClick={() => {
                  setAlign('right');
                  updateContextMenuState();
                }}
                sx={iconBtnSx}
              >
                <TextAlignRightIcon fontSize={iconSize} />
              </IconButton>
            </TooltipHint>
          </div>
        </Menu>

        <Menu
          className="text-submenu"
          menuButton={
            <div>
              <TooltipHint title="Vertical align">
                <IconButton size="small" sx={iconBtnSx}>
                  {VerticalAlignIcon(cursorVerticalAlign)}
                  <ExpandMoreIcon fontSize={'inherit'} style={{ fontSize: '12px' }} />
                </IconButton>
              </TooltipHint>
            </div>
          }
        >
          <div style={{ padding: '0px 4px' }}>
            <TooltipHint title="Top align">
              <IconButton
                size="small"
                onClick={() => {
                  setVerticalAlign('top');
                  updateContextMenuState();
                }}
                sx={iconBtnSx}
              >
                <TextVerticalAlignTopIcon fontSize={iconSize} />
              </IconButton>
            </TooltipHint>
            <TooltipHint title="Middle align">
              <IconButton
                size="small"
                onClick={() => {
                  setVerticalAlign('middle');
                  updateContextMenuState();
                }}
                sx={iconBtnSx}
              >
                <TextVerticalAlignMiddleIcon fontSize={iconSize} />
              </IconButton>
            </TooltipHint>
            <TooltipHint title="Bottom align">
              <IconButton
                size="small"
                onClick={() => {
                  setVerticalAlign('bottom');
                  updateContextMenuState();
                }}
                sx={iconBtnSx}
              >
                <TextVerticalAlignBottomIcon fontSize={iconSize} />
              </IconButton>
            </TooltipHint>
          </div>
        </Menu>

        <Menu
          className="text-submenu"
          menuButton={
            <div>
              <TooltipHint title="Text wrap">
                <IconButton size="small" sx={iconBtnSx}>
                  {WrapIcon(cursorWrap)}
                  <ExpandMoreIcon fontSize={'inherit'} style={{ fontSize: '12px' }} />
                </IconButton>
              </TooltipHint>
            </div>
          }
        >
          <div style={{ padding: '0px 4px' }}>
            <TooltipHint title="Overflow">
              <IconButton
                size="small"
                onClick={() => {
                  setWrap('overflow');
                  updateContextMenuState();
                }}
                sx={iconBtnSx}
              >
                <TextOverflowIcon style={{ width: '20px', height: '20px' }} />
              </IconButton>
            </TooltipHint>
            <TooltipHint title="Wrap">
              <IconButton
                size="small"
                onClick={() => {
                  setWrap('wrap');
                  updateContextMenuState();
                }}
                sx={iconBtnSx}
              >
                <WrapTextIcon fontSize={iconSize} />
              </IconButton>
            </TooltipHint>
            <TooltipHint title="Clip">
              <IconButton
                size="small"
                onClick={() => {
                  setWrap('clip');
                  updateContextMenuState();
                }}
                sx={iconBtnSx}
              >
                <TextClipIcon style={{ width: '20px', height: '20px' }} />
              </IconButton>
            </TooltipHint>
          </div>
        </Menu>

        <MenuDividerVertical />

        <Menu
          className="color-picker-submenu"
          instanceRef={fillColorRef}
          menuButton={
            <div>
              <TooltipHint title="Fill color">
                <IconButton size="small" sx={iconBtnSx}>
                  <PaintBucketIcon
                    fontSize={iconSize}
                    style={{ color: cursorFillColor ? cursorFillColor : 'inherit' }}
                  />
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
              <IconButton size="small" disabled={true} sx={iconBtnSx}>
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
                    <IconButton size="small" sx={iconBtnSx}>
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
          <IconButton size="small" onClick={() => removeCellNumericFormat()} sx={iconBtnSx}>
            <MagicWandIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Format as currency">
          <IconButton size="small" onClick={() => textFormatSetCurrency()} sx={iconBtnSx}>
            <DollarIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Format as percentage">
          <IconButton size="small" onClick={() => textFormatSetPercentage()} sx={iconBtnSx}>
            <PercentIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Format as scientific">
          <IconButton size="small" onClick={() => textFormatSetExponential()} sx={iconBtnSx}>
            <FunctionIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Decrease decimal places">
          <IconButton size="small" onClick={() => textFormatDecreaseDecimalPlaces()} sx={iconBtnSx}>
            <DecimalDecreaseIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Increase decimal places">
          <IconButton size="small" onClick={() => textFormatIncreaseDecimalPlaces()} sx={iconBtnSx}>
            <DecimalIncreaseIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <MenuDividerVertical />
        <TooltipHint title="Clear formatting" shortcut={KeyboardSymbols.Command + '\\'}>
          <IconButton size="small" onClick={clearFormattingAndBorders} sx={iconBtnSx}>
            <TextNoneIcon fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        {fullClipboardSupport() && <MenuDividerVertical />}
        {fullClipboardSupport() && (
          <TooltipHint title="More commands…">
            <IconButton size="small" onClick={() => moreMenuToggle()} ref={moreMenuButtonRef} sx={iconBtnSx}>
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
              setEditorInteractionState((editorInteractionState) => ({
                ...editorInteractionState,
                showValidation: true,
                showContextMenu: false,
              }));
              moreMenuToggle();
            }}
          >
            <MenuLineItem primary="Data validation" />
          </MenuItem>
          <MenuDivider />
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
            />
          </MenuItem>
          <MenuDivider />
          <MenuItem
            onClick={() => {
              setEditorInteractionState((state) => ({ ...state, annotationState: 'date-format' }));
              moreMenuToggle();
            }}
          >
            <MenuLineItem primary="Date and time format" />
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

const AlignIcon = (align: CellAlign) => {
  switch (align) {
    case 'center':
      return <TextAlignCenterIcon fontSize={'inherit'} />;
    case 'right':
      return <TextAlignRightIcon fontSize={'inherit'} />;
    default:
      return <TextAlignLeftIcon fontSize={'inherit'} />;
  }
};

const VerticalAlignIcon = (verticalAlign: CellVerticalAlign) => {
  switch (verticalAlign) {
    case 'middle':
      return <TextVerticalAlignMiddleIcon fontSize={'inherit'} />;
    case 'bottom':
      return <TextVerticalAlignBottomIcon fontSize={'inherit'} />;
    default:
      return <TextVerticalAlignTopIcon fontSize={'inherit'} />;
  }
};

const WrapIcon = (wrap: CellWrap) => {
  switch (wrap) {
    case 'wrap':
      return <WrapTextIcon fontSize={'inherit'} />;
    case 'clip':
      return <TextClipIcon fontSize={'inherit'} />;
    default:
      return <TextOverflowIcon fontSize={'inherit'} />;
  }
};
