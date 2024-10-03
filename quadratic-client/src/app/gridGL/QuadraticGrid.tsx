import { Action } from '@/app/actions/actions';
import { events } from '@/app/events/events';
import { HTMLGridContainer } from '@/app/gridGL/HTMLGrid/HTMLGridContainer';
import { useKeyboard } from '@/app/gridGL/interaction/keyboard/useKeyboard';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { ImportProgress } from '@/app/ui/components/ImportProgress';
import { Search } from '@/app/ui/components/Search';
import { MouseEvent, useCallback, useEffect, useState } from 'react';

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
    if (matchShortcut(Action.GridPanMode, e)) {
      spaceIsDown = true;
      if (panMode === PanMode.Disabled) {
        pixiAppSettings.changePanMode(PanMode.Enabled);
      }
      return true;
    }
    return false;
  };
  const onKeyUp = (e: React.KeyboardEvent<HTMLElement>) => {
    if (matchShortcut(Action.GridPanMode, e)) {
      spaceIsDown = false;
      if (panMode !== PanMode.Disabled && !mouseIsDown) {
        pixiAppSettings.changePanMode(PanMode.Disabled);
      }
      return true;
    }
    return false;
  };

  const { onKeyDown: onKeyDownFromUseKeyboard, onKeyUp: onKeyUpFromUseKeyboard } = useKeyboard();

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
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={onMouseDown}
      onKeyDown={(e) => {
        onKeyDown(e) || onKeyDownFromUseKeyboard(e);
      }}
      onKeyUp={(e) => {
        onKeyUp(e) || onKeyUpFromUseKeyboard(e);
      }}
    >
      <HTMLGridContainer parent={container} />
      <ImportProgress />
      <Search />
    </div>
  );
}
