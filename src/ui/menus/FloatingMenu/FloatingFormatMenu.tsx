import { useCallback, useEffect, useRef } from 'react';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { PixiApp } from '../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../core/transaction/sheetController';
import { Divider, IconButton, MenuItem, Paper, Toolbar } from '@mui/material';
import { BorderAll, FormatBold, FormatClear, FormatColorFill, FormatItalic } from '@mui/icons-material';
import { Menu } from '@szhsin/react-menu';
import { useGetBorderMenu } from '../TopBar/SubMenus/FormatMenu/useGetBorderMenu';
import { useFormatCells } from '../TopBar/SubMenus/useFormatCells';
import { useBorders } from '../TopBar/SubMenus/useBorders';
import { QColorPicker } from '../../components/qColorPicker';
import { useGetSelection } from '../TopBar/SubMenus/useGetSelection';

interface Props {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  container?: HTMLDivElement;
  app: PixiApp;
  sheetController: SheetController;
}

export const FloatingFormatMenu = (props: Props) => {
  const { interactionState, app, container, sheetController } = props;
  const viewport = app?.viewport;

  const menuDiv = useRef<HTMLDivElement>(null);
  const borders = useGetBorderMenu({ sheet: sheetController.sheet, app: app });
  const { changeFillColor, removeFillColor, clearFormatting, changeBold, changeItalic } = useFormatCells(sheetController, props.app);
  const { format } = useGetSelection(sheetController.sheet);
  const { clearBorders } = useBorders(sheetController.sheet, props.app);

  const handleClearFormatting = useCallback(() => {
    clearFormatting();
    clearBorders();
  }, [clearFormatting, clearBorders]);

  // Function used to move and scale the Input with the Grid
  const updateInputCSSTransform = useCallback(() => {
    if (!app || !viewport || !container) return '';

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

    // Hide if zoomed out too much
    if (viewport.scale.x < 0.1) {
      if (menuDiv.current) menuDiv.current.style.visibility = 'hidden';
    } else {
      if (menuDiv.current) menuDiv.current.style.visibility = 'visible';
    }

    // Hide if not showing multi cursor
    // console.log('pointer down ', app?.input?.pointerDown?.active);
    if (!interactionState.showMultiCursor) if (menuDiv.current) menuDiv.current.style.visibility = 'hidden';

    // Hide if currently selecting
    if (app?.input?.pointerDown?.active) if (menuDiv.current) menuDiv.current.style.visibility = 'hidden';

    // Hide FloatingFormatMenu if multi cursor is off screen
    const terminal_pos = sheetController.sheet.gridOffsets.getCell(
      interactionState.multiCursorPosition.terminalPosition.x,
      interactionState.multiCursorPosition.terminalPosition.y
    );
    let multiselect_offset = viewport.toScreen(
      terminal_pos.x + terminal_pos.width,
      terminal_pos.y + terminal_pos.height
    );
    if (multiselect_offset.x < 0 || multiselect_offset.y < 0)
      if (menuDiv.current) menuDiv.current.style.visibility = 'hidden';

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
    if (menuDiv.current) menuDiv.current.style.transform = transform;

    return transform;
  }, [
    app,
    viewport,
    container,
    interactionState.cursorPosition,
    interactionState.showMultiCursor,
    interactionState.multiCursorPosition,
    sheetController.sheet.gridOffsets,
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
        // zIndex: 9,
        // backgroundColor: 'white',
        // border: `1px solid ${colors.mediumGray}`,
        // borderRadius: '5px',
        // drop shadow
        // boxShadow: `0px 0px 10px 0px ${colors.mediumGray}`,
      }}
      elevation={4}
    >
      <Toolbar
        style={{
          padding: '0px',
          paddingLeft: '5px',
          paddingRight: '5px',
          minHeight: '0px',
        }}
      >
        <Menu menuButton={<IconButton>{<FormatColorFill fontSize={iconSize}></FormatColorFill>}</IconButton>}>
          <QColorPicker onChangeComplete={changeFillColor} />
          <MenuItem onClick={removeFillColor}>Clear</MenuItem>
        </Menu>
        <Menu
          menuButton={
            <IconButton>
              <BorderAll fontSize={iconSize} />
            </IconButton>
          }
        >
          {borders}
        </Menu>
        <IconButton onClick={handleClearFormatting}>
          <FormatClear fontSize={iconSize} />
        </IconButton>

        <Divider
          orientation="vertical"
          flexItem
          style={{
            // add padding left and right
            paddingLeft: '10px',
            marginRight: '10px',
          }}
        />
        <IconButton onClick={() => changeBold(!format.bold)}>
          <FormatBold fontSize={iconSize} />
        </IconButton>
        <IconButton onClick={() => changeItalic(!format.italic)}>
          <FormatItalic fontSize={iconSize} />
        </IconButton>
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
