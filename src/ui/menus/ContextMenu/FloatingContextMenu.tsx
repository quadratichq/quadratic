import { useCallback, useEffect, useRef } from 'react';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../grid/controller/sheetController';
import { Divider, IconButton, Paper, Toolbar } from '@mui/material';
import {
  AttachMoneyOutlined,
  BorderAll,
  FormatBold,
  FormatClear,
  FormatColorFill,
  FormatColorText,
  FormatItalic,
  Percent,
  MoreVert,
  ContentCopy,
} from '@mui/icons-material';
import { ControlledMenu, Menu, MenuItem, useMenuState } from '@szhsin/react-menu';
import { useGetBorderMenu } from '../TopBar/SubMenus/FormatMenu/useGetBorderMenu';
import { useFormatCells } from '../TopBar/SubMenus/useFormatCells';
import { QColorPicker } from '../../components/qColorPicker';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { useGetSelection } from '../TopBar/SubMenus/useGetSelection';
import { TooltipHint } from '../../components/TooltipHint';
import { DecimalDecrease, DecimalIncrease } from '../../icons';
import { useClearAllFormatting } from '../TopBar/SubMenus/useClearAllFormatting';
import { copySelectionToPNG } from '../../../grid/actions/clipboard/clipboard';
import { MenuLineItem } from '../TopBar/MenuLineItem';

interface Props {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  container?: HTMLDivElement;
  app: PixiApp;
  sheetController: SheetController;
  showContextMenu: boolean;
}

export const FloatingContextMenu = (props: Props) => {
  const { interactionState, app, container, sheetController, showContextMenu } = props;
  const viewport = app.viewport;

  const moreMenu = useMenuState();
  const menuDiv = useRef<HTMLDivElement>(null);
  const borders = useGetBorderMenu({ sheet: sheetController.sheet, app: app });
  const {
    changeFillColor,
    removeFillColor,
    changeBold,
    changeItalic,
    changeTextColor,
    textFormatDecreaseDecimalPlaces,
    textFormatIncreaseDecimalPlaces,
    textFormatSetCurrency,
    textFormatSetPercentage,
  } = useFormatCells(sheetController, props.app);
  const { format } = useGetSelection(sheetController.sheet);
  const { clearAllFormatting } = useClearAllFormatting(sheetController, props.app);

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

    // Hide if it's not 1) a multicursor or, 2) an active right click
    if (!(interactionState.showMultiCursor || showContextMenu)) visibility = 'hidden';

    // Hide if currently selecting
    if (app?.input?.pointerDown?.active) visibility = 'hidden';

    // Hide if in presentation mode
    if (app.settings.presentationMode) visibility = 'hidden';

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
  }, [
    app,
    viewport,
    container,
    interactionState.cursorPosition,
    interactionState.showMultiCursor,
    interactionState.multiCursorPosition,
    sheetController.sheet.gridOffsets,
    showContextMenu,
  ]);

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

  const saveAsPNG = useCallback(async () => {
    await copySelectionToPNG(app);
    moreMenu.toggleMenu();
  }, [app, moreMenu]);

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
        e.stopPropagation();
      }}
    >
      <Toolbar
        style={{
          padding: '2px 4px',
          minHeight: '0px',
        }}
      >
        <TooltipHint title="Bold" shortcut={KeyboardSymbols.Command + 'B'}>
          <IconButton size="small" onClick={() => changeBold(!format.bold)}>
            <FormatBold fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Italic" shortcut={KeyboardSymbols.Command + 'I'}>
          <IconButton size="small" onClick={() => changeItalic(!format.italic)}>
            <FormatItalic fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <Menu
          className="color-picker-submenu"
          menuButton={
            <div>
              <TooltipHint title="Text color">
                <IconButton size="small">{<FormatColorText fontSize={iconSize}></FormatColorText>}</IconButton>
              </TooltipHint>
            </div>
          }
        >
          <QColorPicker onChangeComplete={changeTextColor} onClear={removeFillColor} />
        </Menu>

        <MenuDivider />

        <Menu
          className="color-picker-submenu"
          menuButton={
            <div>
              <TooltipHint title="Fill color">
                <IconButton size="small">
                  <FormatColorFill fontSize={iconSize}></FormatColorFill>
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
                <IconButton size="small">
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
          <IconButton size="small" onClick={() => textFormatSetCurrency()}>
            <AttachMoneyOutlined fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Format as percent">
          <IconButton size="small" onClick={() => textFormatSetPercentage()}>
            <Percent fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Decrease decimal places">
          <IconButton size="small" onClick={() => textFormatDecreaseDecimalPlaces()}>
            <DecimalDecrease fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Increase decimal places">
          <IconButton size="small" onClick={() => textFormatIncreaseDecimalPlaces()}>
            <DecimalIncrease fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <MenuDivider />
        <TooltipHint title="Clear formatting" shortcut={KeyboardSymbols.Command + '\\'}>
          <IconButton size="small" onClick={() => clearAllFormatting()}>
            <FormatClear fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        {/*
        <Divider
          orientation="vertical"
          flexItem
          style={{
            // add padding left and right
            paddingLeft: '10px',
            marginRight: '10px',
          }}
        />
        <IconButton disabled={true}>
          <FormatAlignLeft fontSize={iconSize} />
        </IconButton>
        <IconButton disabled={true}>
          <FormatAlignCenter fontSize={iconSize} />
        </IconButton>
        <IconButton disabled={true}>
          <FormatAlignRight fontSize={iconSize} />
        </IconButton>

        <Divider
          orientation="vertical"
          flexItem
          style={{
            // add padding left and right
            paddingLeft: '10px',
            // marginRight: '10px',
          }}
        />
        <Button style={{ color: colors.mediumGray }} disabled>
          <span style={{ fontSize: '1rem' }}>123</span>
        </Button> */}
        <MenuDivider />
        <TooltipHint title="More Commands">
          <IconButton size="small" onClick={() => moreMenu.toggleMenu()}>
            <MoreVert />
          </IconButton>
        </TooltipHint>
        <ControlledMenu state={moreMenu.state}>
          <MenuItem onClick={saveAsPNG}>
            <MenuLineItem
              primary="Copy selection as PNG"
              secondary={KeyboardSymbols.Command + KeyboardSymbols.Shift + 'C'}
              Icon={ContentCopy}
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
