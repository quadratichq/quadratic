import { useCallback, useEffect, useRef, useState } from 'react';
import { useLoading } from '../contexts/LoadingContext';
import { GridInteractionState, gridInteractionStateAtom } from '../atoms/gridInteractionStateAtom';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { useRecoilState } from 'recoil';
import { PixiApp } from './pixiApp/PixiApp';
import { useKeyboard } from './interaction/keyboard/useKeyboard';
import { ensureVisible } from './interaction/viewportHelper';
import { CellInput } from './interaction/CellInput';
import { SheetController } from '../grid/controller/sheetController';
import { FloatingContextMenu } from '../ui/menus/ContextMenu/FloatingContextMenu';
import { PanMode } from '../atoms/gridInteractionStateAtom';

interface IProps {
  sheetController: SheetController;
  app: PixiApp;
}

export default function QuadraticGrid(props: IProps) {
  const { loading } = useLoading();

  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setContainer(node);
  }, []);
  useEffect(() => {
    if (props.app && container) props.app.attach(container);
  }, [props.app, container]);

  useEffect(() => {
    if (props.app) {
      props.app.quadrants.build();
    }
  }, [props.sheetController.sheet, props.app]);

  // Interaction State hook
  const [interactionState, setInteractionState] = useRecoilState(gridInteractionStateAtom);
  let prevPanModeRef = useRef(interactionState.panMode);
  useEffect(() => {
    props.app?.settings.updateInteractionState(interactionState, setInteractionState);

    // If we're not dealing with a change in pan mode, ensure the cursor stays
    // visible on screen (if we did have a change in pan mode, the user is
    // panning and we don't want to change the visibility of the screen when
    // they’re done)
    if (prevPanModeRef.current === interactionState.panMode) {
      ensureVisible({
        sheet: props.sheetController.sheet,
        app: props.app,
        interactionState,
      });
    }
    // Store the previous state for our check above
    prevPanModeRef.current = interactionState.panMode;
  }, [props.app, props.app?.settings, interactionState, setInteractionState, props.sheetController.sheet]);

  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  useEffect(() => {
    props.app?.settings.updateEditorInteractionState(editorInteractionState, setEditorInteractionState);
  }, [props.app?.settings, editorInteractionState, setEditorInteractionState]);

  // Right click menu
  const [showContextMenu, setShowContextMenu] = useState(false);

  // Pan mode
  const { onMouseDown, onMouseUp, onKeyDown, onKeyUp } = usePanMode({
    panMode: interactionState.panMode,
    interactionState,
    setInteractionState,
  });

  const { onKeyDown: onKeyDownFromUseKeyboard } = useKeyboard({
    sheetController: props.sheetController,
    interactionState,
    setInteractionState,
    editorInteractionState,
    setEditorInteractionState,
    app: props.app,
  });

  if (loading) return null;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        outline: 'none',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
        cursor:
          interactionState.panMode === PanMode.Enabled
            ? 'grab'
            : interactionState.panMode === PanMode.Dragging
            ? 'grabbing'
            : 'unset',
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        // If it's not already visibile, show the context menu
        if (!showContextMenu) {
          setShowContextMenu(true);
        }
      }}
      onClick={(e) => {
        // <FloatingFormatMenu> prevents events from bubbling up to here, so
        // we always hide the context menu if it's open
        if (showContextMenu) {
          setShowContextMenu(false);
        }
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onKeyDown={(e) => {
        onKeyDown(e);
        onKeyDownFromUseKeyboard(e);
      }}
      onKeyUp={onKeyUp}
    >
      <CellInput
        interactionState={interactionState}
        editorInteractionState={editorInteractionState}
        setInteractionState={setInteractionState}
        container={container}
        app={props.app}
        sheetController={props.sheetController}
      />
      <FloatingContextMenu
        interactionState={interactionState}
        setInteractionState={setInteractionState}
        container={container}
        app={props.app}
        sheetController={props.sheetController}
        showContextMenu={showContextMenu}
      ></FloatingContextMenu>
    </div>
  );
}

function usePanMode({
  panMode,
  interactionState,
  setInteractionState,
}: {
  panMode: PanMode;
  interactionState: GridInteractionState;
  setInteractionState: React.Dispatch<React.SetStateAction<GridInteractionState>>;
}) {
  const [mouseIsDown, setMouseIsDown] = useState(false);
  const [spaceIsDown, setSpaceIsDown] = useState(false);

  const onMouseDown = () => {
    setMouseIsDown(true);
    if (panMode === PanMode.Enabled) {
      setInteractionState({ ...interactionState, panMode: PanMode.Dragging });
    }
  };

  const onMouseUp = () => {
    setMouseIsDown(false);
    if (panMode !== PanMode.Disabled) {
      setInteractionState({ ...interactionState, panMode: spaceIsDown ? PanMode.Enabled : PanMode.Disabled });
    }
  };

  const onKeyDown = (e: any) => {
    if (e.code === 'Space') {
      setSpaceIsDown(true);
      if (panMode === PanMode.Disabled) {
        setInteractionState({
          ...interactionState,
          panMode: PanMode.Enabled,
        });
      }
    }
  };

  const onKeyUp = (e: any) => {
    if (e.code === 'Space') {
      setSpaceIsDown(false);
      if (interactionState.panMode !== PanMode.Disabled && !mouseIsDown) {
        setInteractionState({
          ...interactionState,
          panMode: PanMode.Disabled,
        });
      }
    }
  };

  return {
    onMouseDown,
    onMouseUp,
    onKeyDown,
    onKeyUp,
  };
}
