import { useCallback, useEffect, useState } from 'react';
import { gridInteractionStateAtom } from '../atoms/gridInteractionStateAtom';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { useRecoilState } from 'recoil';
import { PixiApp } from './pixiApp/PixiApp';
import { useKeyboard } from './interaction/keyboard/useKeyboard';
import { ensureVisible } from './interaction/viewportHelper';
import { CellInput } from './interaction/CellInput';
import { SheetController } from '../grid/controller/sheetController';
import { FloatingContextMenu } from '../ui/menus/ContextMenu/FloatingContextMenu';
import { PanMode } from '../grid/sheet/SheetCursor';

interface IProps {
  sheetController: SheetController;
  app: PixiApp;
}

// Keep track of state of mouse/space for panning mode
let mouseIsDown = false;
let spaceIsDown = false;

export default function QuadraticGrid(props: IProps) {
  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setContainer(node);
  }, []);
  useEffect(() => {
    if (props.app && container) props.app.attach(container);
  }, [props.app, container]);

  // Interaction State hook
  const [interactionState, setInteractionState] = useRecoilState(gridInteractionStateAtom);

  const [panMode, setPanMode] = useState<PanMode>(PanMode.Disabled);
  useEffect(() => {
    const updatePanMode = (e: any) => {
      setPanMode(e.detail);
      ensureVisible({
        sheet: props.sheetController.sheet,
        app: props.app,
      });
    };
    window.addEventListener('pan-mode', updatePanMode);
    return () => window.removeEventListener('pan-mode', updatePanMode);
  }, [props.app, props.sheetController.sheet]);

  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  useEffect(() => {
    props.app?.settings.updateEditorInteractionState(editorInteractionState, setEditorInteractionState);
  }, [props.app?.settings, editorInteractionState, setEditorInteractionState]);

  // Right click menu
  const [showContextMenu, setShowContextMenu] = useState(false);

  // Pan mode
  const onMouseUp = () => {
    mouseIsDown = false;
    if (panMode !== PanMode.Disabled) {
      setInteractionState({ ...interactionState, panMode: spaceIsDown ? PanMode.Enabled : PanMode.Disabled });
    }
    window.removeEventListener('mouseup', onMouseUp);
  };
  const onMouseDown = () => {
    mouseIsDown = true;
    if (panMode === PanMode.Enabled) {
      setInteractionState({ ...interactionState, panMode: PanMode.Dragging });
    }
    window.addEventListener('mouseup', onMouseUp);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === ' ') {
      spaceIsDown = true;
      if (panMode === PanMode.Disabled) {
        setInteractionState({
          ...interactionState,
          panMode: PanMode.Enabled,
        });
      }
    }
  };
  const onKeyUp = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === ' ') {
      spaceIsDown = false;
      if (panMode !== PanMode.Disabled && !mouseIsDown) {
        setInteractionState({
          ...interactionState,
          panMode: PanMode.Disabled,
        });
      }
    }
  };

  const { onKeyDown: onKeyDownFromUseKeyboard } = useKeyboard({
    sheetController: props.sheetController,
    editorInteractionState,
    setEditorInteractionState,
    app: props.app,
  });

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        outline: 'none',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
        cursor: panMode === PanMode.Enabled ? 'grab' : panMode === PanMode.Dragging ? 'grabbing' : 'unset',
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        // If it's not already visible, show the context menu
        if (!showContextMenu) {
          setShowContextMenu(true);
        }
      }}
      onMouseDown={() => {
        onMouseDown();
      }}
      onClick={() => {
        // <FloatingContextMenu> prevents events from bubbling up to here, so
        // we always hide the context menu if it's open
        if (showContextMenu) {
          setShowContextMenu(false);
        }
      }}
      onKeyDown={(e) => {
        onKeyDown(e);
        onKeyDownFromUseKeyboard(e);
      }}
      onKeyUp={onKeyUp}
    >
      <CellInput
        editorInteractionState={editorInteractionState}
        container={container}
        app={props.app}
        sheetController={props.sheetController}
      />
      <FloatingContextMenu
        container={container}
        app={props.app}
        sheetController={props.sheetController}
        showContextMenu={showContextMenu}
      />
    </div>
  );
}
