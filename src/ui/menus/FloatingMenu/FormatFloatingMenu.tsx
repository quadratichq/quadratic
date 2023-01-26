import { useCallback, useEffect, useRef } from 'react';
import { GridInteractionState } from '../../../atoms/gridInteractionStateAtom';
import { PixiApp } from '../../../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../../../core/transaction/sheetController';
import { Divider, IconButton, Toolbar } from '@mui/material';
import { BorderAll, FormatBold, FormatClear, FormatColorFill, FormatItalic } from '@mui/icons-material';
import { colors } from '../../../theme/colors';
import { MenuState } from '@szhsin/react-menu';

interface FormatFloatingMenuProps {
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
  container?: HTMLDivElement;
  app?: PixiApp;
  sheetController: SheetController;
  contextMenuState: MenuState | undefined;
}

export const FormatFloatingMenu = (props: FormatFloatingMenuProps) => {
  const { interactionState, app, container, sheetController, contextMenuState } = props;
  const viewport = app?.viewport;

  const menuDiv = useRef<HTMLDivElement>(null);

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

    // if ouside of viewport keep it inside
    if (x < container.offsetLeft + 35) {
      x = container.offsetLeft + 35;
    }
    if (y < container.offsetTop + 35) {
      y = container.offsetTop + 35;
    }

    // Generate transform CSS
    const transform = 'translate(' + [x, y].join('px,') + 'px) ';

    // // Update input css matrix
    if (menuDiv.current) menuDiv.current.style.transform = transform;

    if (viewport.scale.x < 0.1) {
      if (menuDiv.current) menuDiv.current.style.visibility = 'hidden';
    } else {
      if (menuDiv.current) menuDiv.current.style.visibility = 'visible';
    }

    if (!interactionState.showMultiCursor) if (menuDiv.current) menuDiv.current.style.visibility = 'hidden';

    if (contextMenuState === 'open') if (menuDiv.current) menuDiv.current.style.visibility = 'visible';

    return transform;
  }, [
    app,
    viewport,
    container,
    interactionState.cursorPosition,
    interactionState.showMultiCursor,
    interactionState.multiCursorPosition,
    sheetController.sheet.gridOffsets,
    contextMenuState,
  ]);

  useEffect(() => {
    if (!viewport) return;
    viewport.on('moved', updateInputCSSTransform);
    viewport.on('moved-end', updateInputCSSTransform);

    return () => {
      viewport.removeListener('moved', updateInputCSSTransform);
      viewport.removeListener('moved-end', updateInputCSSTransform);
    };
  }, [viewport, updateInputCSSTransform]);

  // If we don't have a viewport, we can't continue.
  if (!viewport || !container) return null;

  // set input's initial position correctly
  const transform = updateInputCSSTransform();

  const iconSize = 'small';

  return (
    <div
      ref={menuDiv}
      style={{
        display: 'block',
        position: 'absolute',
        top: '0',
        left: '0',
        transformOrigin: '0 0',
        transform,
        pointerEvents: 'none',
        zIndex: 9,
        backgroundColor: 'white',
        border: `1px solid ${colors.mediumGray}`,
        borderRadius: '5px',
        // drop shadow
        boxShadow: `0px 0px 10px 0px ${colors.mediumGray}`,
      }}
    >
      <Toolbar
        style={{
          padding: '0px',
          paddingLeft: '5px',
          paddingRight: '5px',
          minHeight: '0px',
        }}
      >
        <IconButton>
          <FormatColorFill fontSize={iconSize}></FormatColorFill>
        </IconButton>
        <IconButton>
          <BorderAll fontSize={iconSize} />
        </IconButton>
        <IconButton>
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
        <IconButton disabled={true}>
          <FormatBold fontSize={iconSize} />
        </IconButton>
        <IconButton disabled={true}>
          <FormatItalic fontSize={iconSize} />
        </IconButton>
      </Toolbar>
    </div>
  );
};
