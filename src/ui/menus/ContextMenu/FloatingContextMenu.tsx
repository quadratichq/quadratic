import {
  AttachMoneyOutlined,
  BorderAll,
  FormatAlignCenter,
  FormatAlignLeft,
  FormatAlignRight,
  FormatBold,
  FormatClear,
  FormatColorFill,
  FormatColorText,
  FormatItalic,
  MoreHoriz,
  Percent,
} from '@mui/icons-material';
import { Divider, IconButton, Paper, Toolbar } from '@mui/material';
import { ControlledMenu, Menu, MenuItem, useMenuState } from '@szhsin/react-menu';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useRef } from 'react';
import { isEditorOrAbove } from '../../../actions';
import { EditorInteractionState } from '../../../atoms/editorInteractionStateAtom';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { useGlobalSnackbar } from '../../../components/GlobalSnackbarProvider';
import { copySelectionToPNG } from '../../../grid/actions/clipboard/clipboard';
import { SheetController } from '../../../grid/controller/sheetController';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { colors } from '../../../theme/colors';
import { TooltipHint } from '../../components/TooltipHint';
import { QColorPicker } from '../../components/qColorPicker';
import { CopyAsPNG, DecimalDecrease, DecimalIncrease } from '../../icons';
import { MenuLineItem } from '../TopBar/MenuLineItem';
import { useGetBorderMenu } from '../TopBar/SubMenus/FormatMenu/useGetBorderMenu';
import { useClearAllFormatting } from '../TopBar/SubMenus/useClearAllFormatting';
import { useFormatCells } from '../TopBar/SubMenus/useFormatCells';
import { useGetSelection } from '../TopBar/SubMenus/useGetSelection';

interface Props {
  editorInteractionState: EditorInteractionState;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  container?: HTMLDivElement;
  app: PixiApp;
  sheetController: SheetController;
  showContextMenu: boolean;
}

export const FloatingContextMenu = (props: Props) => {
  const {
    editorInteractionState: { permission },
    interactionState,
    app,
    app: { viewport },
    container,
    sheetController,
    showContextMenu,
  } = props;
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [moreMenuProps, moreMenuToggle] = useMenuState();
  const menuDiv = useRef<HTMLDivElement>(null);
  const moreMenuButtonRef = useRef(null);
  const borders = useGetBorderMenu({ sheet: sheetController.sheet, app: app });
  const {
    changeFillColor,
    removeFillColor,
    changeBold,
    changeItalic,
    changeTextColor,
    changeAlignment,
    textFormatDecreaseDecimalPlaces,
    textFormatIncreaseDecimalPlaces,
    textFormatSetCurrency,
    textFormatSetPercentage,
  } = useFormatCells(sheetController, props.app);
  const { format } = useGetSelection(sheetController.sheet);
  const { clearAllFormatting } = useClearAllFormatting(sheetController, props.app);

  // close moreMenu when context menu closes
  useEffect(() => {
    if (menuDiv.current?.style.visibility === 'hidden' && moreMenuProps.state === 'open') moreMenuToggle();
  }, [menuDiv.current?.style.visibility, moreMenuProps, moreMenuToggle]);

  // Function used to move and scale the Input with the Grid
  const updateContextMenuCSSTransform = useCallback(() => {
    if (!app || !viewport || !container) return '';
    if (!menuDiv.current) return '';

    // Calculate position of input based on cell
    const cell_offsets = sheetController.sheet.gridOffsets.getCell(
      Math.min(
        interactionState.cursorPosition.x,
        interactionState.multiCursorPosition.originPosition.x,
        interactionState.multiCursorPosition.terminalPosition.x
      ),
      Math.min(
        interactionState.cursorPosition.y,
        interactionState.multiCursorPosition.originPosition.y,
        interactionState.multiCursorPosition.terminalPosition.y
      )
    );
    let cell_offset_scaled = viewport.toScreen(cell_offsets.x, cell_offsets.y);

    const menuHeight = menuDiv.current?.clientHeight || 0;
    // const menuwidth = menuDiv.current?.clientWidth || 0;

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
    if (interactionState.boxCells) {
      visibility = 'hidden';
    }

    // Hide if it's not 1) a multicursor or, 2) an active right click
    if (!(interactionState.showMultiCursor || showContextMenu)) visibility = 'hidden';

    // Hide if currently selecting
    if (app?.pointer?.pointerDown?.active) visibility = 'hidden';

    // Hide if in presentation mode
    if (app.settings.presentationMode) visibility = 'hidden';

    // Hide if you don't have edit access
    if (!isEditorOrAbove(permission)) visibility = 'hidden';

    // Hide FloatingFormatMenu if multi cursor is off screen
    const terminal_pos = sheetController.sheet.gridOffsets.getCell(
      interactionState.multiCursorPosition.terminalPosition.x,
      interactionState.multiCursorPosition.terminalPosition.y
    );
    let multiselect_offset = viewport.toScreen(
      terminal_pos.x + terminal_pos.width,
      terminal_pos.y + terminal_pos.height
    );
    if (multiselect_offset.x < 0 || multiselect_offset.y < 0) visibility = 'hidden';

    // Apply visibility
    menuDiv.current.style.visibility = visibility;

    /**
     * Menu positioning
     */

    // if ouside of viewport keep it inside
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
  }, [app, viewport, container, sheetController.sheet.gridOffsets, interactionState, showContextMenu, permission]);

  useEffect(() => {
    if (!viewport) return;
    viewport.on('moved', updateContextMenuCSSTransform);
    viewport.on('moved-end', updateContextMenuCSSTransform);
    document.addEventListener('pointerup', updateContextMenuCSSTransform);

    return () => {
      viewport.removeListener('moved', updateContextMenuCSSTransform);
      viewport.removeListener('moved-end', updateContextMenuCSSTransform);
      document.removeEventListener('pointerup', updateContextMenuCSSTransform);
    };
  }, [viewport, updateContextMenuCSSTransform]);

  const copyAsPNG = useCallback(async () => {
    await copySelectionToPNG(app, addGlobalSnackbar);
    moreMenuToggle();
  }, [app, moreMenuToggle, addGlobalSnackbar]);

  // If we don't have a viewport, we can't continue.
  if (!viewport || !container) return null;

  // set input's initial position correctly
  const transform = updateContextMenuCSSTransform();

  const iconSize = 'small';

  return (
    <Paper
      ref={menuDiv}
      style={{
        display: 'block',
        position: 'absolute',
        top: '0',
        left: '0',
        transformOrigin: '0 0',
        transform,
        pointerEvents: 'auto',
        visibility: 'hidden',
      }}
      elevation={4}
      onClick={(e) => {
        mixpanel.track('[FloatingContextMenu].click');
        e.stopPropagation();
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
          <IconButton onClick={() => changeBold(!format.bold)} color="inherit">
            <FormatBold fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Italic" shortcut={KeyboardSymbols.Command + 'I'}>
          <IconButton onClick={() => changeItalic(!format.italic)} color="inherit">
            <FormatItalic fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <Menu
          className="color-picker-submenu"
          menuButton={
            <div>
              <TooltipHint title="Text color">
                <IconButton color="inherit">
                  <FormatColorText fontSize={iconSize} />
                </IconButton>
              </TooltipHint>
            </div>
          }
        >
          <QColorPicker onChangeComplete={changeTextColor} onClear={removeFillColor} />
        </Menu>

        <MenuDivider />

        <TooltipHint title="Align left">
          <IconButton size="small" onClick={() => changeAlignment('left')}>
            <FormatAlignLeft fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <TooltipHint title="Align center">
          <IconButton size="small" onClick={() => changeAlignment('center')}>
            <FormatAlignCenter fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <TooltipHint title="Align right">
          <IconButton size="small" onClick={() => changeAlignment('right')}>
            <FormatAlignRight fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <MenuDivider />

        <Menu
          className="color-picker-submenu"
          menuButton={
            <div>
              <TooltipHint title="Fill color">
                <IconButton color="inherit">
                  <FormatColorFill fontSize={iconSize} />
                </IconButton>
              </TooltipHint>
            </div>
          }
        >
          <QColorPicker onChangeComplete={changeFillColor} onClear={removeFillColor} />
        </Menu>
        <Menu
          menuButton={
            <div>
              <TooltipHint title="Borders">
                <IconButton color="inherit">
                  <BorderAll fontSize={iconSize} />
                </IconButton>
              </TooltipHint>
            </div>
          }
        >
          {borders}
        </Menu>

        <MenuDivider />

        <TooltipHint title="Format as currency">
          <IconButton onClick={() => textFormatSetCurrency()} color="inherit">
            <AttachMoneyOutlined fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Format as percent">
          <IconButton onClick={() => textFormatSetPercentage()} color="inherit">
            <Percent fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Decrease decimal places">
          <IconButton onClick={() => textFormatDecreaseDecimalPlaces()} color="inherit">
            <DecimalDecrease fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Increase decimal places">
          <IconButton onClick={() => textFormatIncreaseDecimalPlaces()} color="inherit">
            <DecimalIncrease fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <MenuDivider />
        <TooltipHint title="Clear formatting" shortcut={KeyboardSymbols.Command + '\\'}>
          <IconButton onClick={() => clearAllFormatting()} color="inherit">
            <FormatClear fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <MenuDivider />
        <TooltipHint title="More commands…">
          <IconButton onClick={() => moreMenuToggle()} color="inherit" ref={moreMenuButtonRef}>
            <MoreHoriz fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <ControlledMenu
          state={moreMenuProps.state}
          menuStyle={{ padding: '2px 0', color: 'inherit' }}
          anchorRef={moreMenuButtonRef}
        >
          <MenuItem onClick={copyAsPNG}>
            <MenuLineItem
              primary="Copy selection as PNG"
              secondary={KeyboardSymbols.Command + KeyboardSymbols.Shift + 'C'}
              Icon={CopyAsPNG}
            ></MenuLineItem>
          </MenuItem>
        </ControlledMenu>
      </Toolbar>
    </Paper>
  );
};

function MenuDivider() {
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
