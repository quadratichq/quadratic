import { useCallback, useEffect, useRef } from 'react';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { PixiApp } from '../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../core/transaction/sheetController';
import { Divider, IconButton, Paper, Toolbar } from '@mui/material';
import {
  BorderAll,
  ContentCopy,
  ContentCut,
  ContentPaste,
  FormatBold,
  FormatClear,
  FormatColorFill,
  FormatColorText,
  FormatItalic,
} from '@mui/icons-material';
import { Menu } from '@szhsin/react-menu';
import { useGetBorderMenu } from '../TopBar/SubMenus/FormatMenu/useGetBorderMenu';
import { useFormatCells } from '../TopBar/SubMenus/useFormatCells';
import { useBorders } from '../TopBar/SubMenus/useBorders';
import { QColorPicker } from '../../components/qColorPicker';
import { KeyboardSymbols } from '../../../helpers/keyboardSymbols';
import { useGetSelection } from '../TopBar/SubMenus/useGetSelection';
import { copyToClipboard, cutToClipboard, pasteFromClipboard } from '../../../core/actions/clipboard';
import { TooltipHint } from '../../components/TooltipHint';

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
  const viewport = app?.viewport;

  const menuDiv = useRef<HTMLDivElement>(null);
  const borders = useGetBorderMenu({ sheet: sheetController.sheet, app: app });
  const {
    changeFillColor,
    removeFillColor,
    clearFormatting,
    changeBold,
    changeItalic,
    changeTextColor,
    removeTextColor,
  } = useFormatCells(sheetController, props.app);
  const { format } = useGetSelection(sheetController.sheet);
  const { clearBorders } = useBorders(sheetController.sheet, props.app);

  const handleClearFormatting = useCallback(() => {
    clearFormatting();
    clearBorders();
  }, [clearFormatting, clearBorders]);

  // Function used to move and scale the Input with the Grid
  const updateInputCSSTransform = useCallback(() => {
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
    viewport.on('moved', updateInputCSSTransform);
    viewport.on('moved-end', updateInputCSSTransform);
    document.addEventListener('pointerup', updateInputCSSTransform);

    return () => {
      viewport.removeListener('moved', updateInputCSSTransform);
      viewport.removeListener('moved-end', updateInputCSSTransform);
      document.removeEventListener('pointerup', updateInputCSSTransform);
    };
  }, [viewport, updateInputCSSTransform]);

  // If we don't have a viewport, we can't continue.
  if (!viewport || !container) return null;

  // set input's initial position correctly
  const transform = updateInputCSSTransform();

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
          padding: '0 6px',
          minHeight: '0px',
        }}
      >
        <TooltipHint title="Cut" shortcut={KeyboardSymbols.Command + 'X'}>
          <IconButton
            onClick={() => {
              cutToClipboard(
                props.sheetController,
                {
                  x: props.interactionState.multiCursorPosition.originPosition.x,
                  y: props.interactionState.multiCursorPosition.originPosition.y,
                },
                {
                  x: props.interactionState.multiCursorPosition.terminalPosition.x,
                  y: props.interactionState.multiCursorPosition.terminalPosition.y,
                }
              );
            }}
          >
            <ContentCut fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <TooltipHint title="Copy" shortcut={KeyboardSymbols.Command + 'C'}>
          <IconButton
            onClick={() => {
              copyToClipboard(
                props.sheetController,
                props.interactionState.multiCursorPosition.originPosition,
                props.interactionState.multiCursorPosition.terminalPosition
              );
            }}
          >
            <ContentCopy fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <TooltipHint title="Paste" shortcut={KeyboardSymbols.Command + 'P'}>
          <IconButton
            onClick={() => {
              pasteFromClipboard(props.sheetController, props.interactionState.cursorPosition);
            }}
          >
            <ContentPaste fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <MenuDivider />

        <TooltipHint title="Bold" shortcut={KeyboardSymbols.Command + 'B'}>
          <IconButton onClick={() => changeBold(!format.bold)}>
            <FormatBold fontSize={iconSize} />
          </IconButton>
        </TooltipHint>

        <TooltipHint title="Italic" shortcut={KeyboardSymbols.Command + 'I'}>
          <IconButton onClick={() => changeItalic(!format.italic)}>
            <FormatItalic fontSize={iconSize} />
          </IconButton>
        </TooltipHint>
        <Menu
          menuButton={
            <div>
              <TooltipHint title="Text color">
                <IconButton>{<FormatColorText fontSize={iconSize}></FormatColorText>}</IconButton>
              </TooltipHint>
            </div>
          }
        >
          <QColorPicker onChangeComplete={changeTextColor} />
        </Menu>

        <MenuDivider />

        <Menu
          className="color-picker-submenu"
          menuButton={
            <div>
              <TooltipHint title="Fill color">
                <IconButton>
                  <FormatColorFill fontSize={iconSize}></FormatColorFill>
                </IconButton>
              </TooltipHint>
            </div>
          }
        >
          <QColorPicker onChangeComplete={changeFillColor} onClear={removeFillColor} />
        </Menu>
        <Menu
          className="color-picker-submenu"
          menuButton={
            <div>
              <TooltipHint title="Text color">
                <IconButton>{<FormatColorText fontSize={iconSize}></FormatColorText>}</IconButton>
              </TooltipHint>
            </div>
          }
        >
          <QColorPicker onChangeComplete={changeTextColor} onClear={removeTextColor} />
        </Menu>
        <Menu
          menuButton={
            <div>
              <TooltipHint title="Borders">
                <IconButton>
                  <BorderAll fontSize={iconSize} />
                </IconButton>
              </TooltipHint>
            </div>
          }
        >
          {borders}
        </Menu>
        <MenuDivider />
        <TooltipHint title="Clear formatting" shortcut={KeyboardSymbols.Command + '\\'}>
          <IconButton onClick={handleClearFormatting}>
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
        // add padding left and right
        paddingLeft: '4px',
        marginRight: '4px',
      }}
    />
  );
}
