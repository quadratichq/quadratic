import { useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { FloatingContextMenu } from '../ui/menus/ContextMenu/FloatingContextMenu';
import { CellInput } from './interaction/CellInput';
import { useKeyboard } from './interaction/keyboard/useKeyboard';
import { pixiApp } from './pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from './pixiApp/PixiAppSettings';

// Keep track of state of mouse/space for panning mode
let mouseIsDown = false;
let spaceIsDown = false;

export default function QuadraticGrid() {
  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setContainer(node);
  }, []);
  useEffect(() => {
    if (container) pixiApp.attach(container);
  }, [container]);

  const [panMode, setPanMode] = useState<PanMode>(PanMode.Disabled);
  useEffect(() => {
    const updatePanMode = (e: any) => {
      setPanMode(e.detail);
    };
    window.addEventListener('pan-mode', updatePanMode);
    return () => window.removeEventListener('pan-mode', updatePanMode);
  }, []);

  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  useEffect(() => {
    pixiAppSettings.updateEditorInteractionState(editorInteractionState, setEditorInteractionState);
  }, [editorInteractionState, setEditorInteractionState]);

  const [showInput, setShowInput] = useState(false);
  useEffect(() => {
    const changeInput = (e: any) => setShowInput(e.detail.showInput);
    window.addEventListener('change-input', changeInput);
    return () => window.removeEventListener('change-input', changeInput);
  }, []);

  // Right click menu
  const [showContextMenu, setShowContextMenu] = useState(false);

  // Pan mode
  const onMouseUp = () => {
    mouseIsDown = false;
    if (panMode !== PanMode.Disabled) {
      pixiAppSettings.changePanMode(spaceIsDown ? PanMode.Enabled : PanMode.Disabled);
    }
    window.removeEventListener('mouseup', onMouseUp);
  };
  const onMouseDown = () => {
    mouseIsDown = true;
    if (panMode === PanMode.Enabled) {
      pixiAppSettings.changePanMode(PanMode.Dragging);
    }
    window.addEventListener('mouseup', onMouseUp);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === ' ') {
      spaceIsDown = true;
      if (panMode === PanMode.Disabled) {
        pixiAppSettings.changePanMode(PanMode.Enabled);
      }
    }
  };
  const onKeyUp = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === ' ') {
      spaceIsDown = false;
      if (panMode !== PanMode.Disabled && !mouseIsDown) {
        pixiAppSettings.changePanMode(PanMode.Disabled);
      }
    }
  };

  const { onKeyDown: onKeyDownFromUseKeyboard } = useKeyboard({
    editorInteractionState,
    setEditorInteractionState,
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
      {showInput && <CellInput container={container} />}
      <FloatingContextMenu container={container} showContextMenu={showContextMenu} />
    </div>
  );
}
