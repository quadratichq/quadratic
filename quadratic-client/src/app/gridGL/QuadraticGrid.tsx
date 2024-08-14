import { inlineEditorAtom } from '@/app/atoms/inlineEditorAtom';
import { events } from '@/app/events/events';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { ImportProgress } from '@/app/ui/components/ImportProgress';
import { Search } from '@/app/ui/components/Search';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { MouseEvent, useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { FloatingContextMenu } from '../ui/menus/ContextMenu/FloatingContextMenu';
import { HTMLGridContainer } from './HTMLGrid/HTMLGridContainer';
import { useKeyboard } from './interaction/keyboard/useKeyboard';
import { pixiApp } from './pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from './pixiApp/PixiAppSettings';

// Keep track of state of mouse/space for panning mode
let mouseIsDown = false;
let spaceIsDown = false;

export default function QuadraticGrid() {
  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setContainer(node);
      pixiApp.attach(node);
    }
  }, []);

  const [panMode, setPanMode] = useState<PanMode>(PanMode.Disabled);
  useEffect(() => {
    const updatePanMode = (panMode: PanMode) => {
      setPanMode(panMode);
    };
    events.on('panMode', updatePanMode);
    return () => {
      events.off('panMode', updatePanMode);
    };
  }, []);

  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const [inlineEditorState, setInlineEditorState] = useRecoilState(inlineEditorAtom);
  useEffect(() => {
    pixiAppSettings.updateEditorInteractionState(editorInteractionState, setEditorInteractionState);
    pixiAppSettings.updateInlineEditorState(inlineEditorState, setInlineEditorState);
  }, [editorInteractionState, inlineEditorState, setEditorInteractionState, setInlineEditorState]);

  const { addGlobalSnackbar } = useGlobalSnackbar();
  useEffect(() => {
    pixiAppSettings.addGlobalSnackbar = addGlobalSnackbar;
  }, [addGlobalSnackbar]);

  // Pan mode
  const onMouseUp = () => {
    mouseIsDown = false;
    if (panMode !== PanMode.Disabled) {
      pixiAppSettings.changePanMode(spaceIsDown ? PanMode.Enabled : PanMode.Disabled);
    } else {
      pixiAppSettings.changePanMode(PanMode.Disabled);
    }
    window.removeEventListener('mouseup', onMouseUp);
  };
  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    mouseIsDown = true;
    if (panMode === PanMode.Enabled) {
      pixiAppSettings.changePanMode(PanMode.Dragging);
    } else if (e.button === 1) {
      pixiAppSettings.changePanMode(PanMode.Dragging);
    }
    window.addEventListener('mouseup', onMouseUp);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (matchShortcut('grid_pan_mode', e)) {
      spaceIsDown = true;
      if (panMode === PanMode.Disabled) {
        pixiAppSettings.changePanMode(PanMode.Enabled);
      }
    }
  };
  const onKeyUp = (e: React.KeyboardEvent<HTMLElement>) => {
    if (matchShortcut('grid_pan_mode', e)) {
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
        position: 'relative',
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
        if (!editorInteractionState.showContextMenu) {
          setEditorInteractionState((state) => ({ ...state, showContextMenu: true }));
        }
      }}
      onMouseDown={onMouseDown}
      onClick={() => {
        // <FloatingContextMenu> prevents events from bubbling up to here, so
        // we always hide the context menu if it's open
        if (editorInteractionState.showContextMenu) {
          setEditorInteractionState((state) => ({ ...state, showContextMenu: false }));
        }
      }}
      onKeyDown={(e) => {
        onKeyDown(e);
        onKeyDownFromUseKeyboard(e);
      }}
      onKeyUp={onKeyUp}
    >
      <HTMLGridContainer parent={container} />
      <FloatingContextMenu container={container} />
      <ImportProgress />
      <Search />
    </div>
  );
}
