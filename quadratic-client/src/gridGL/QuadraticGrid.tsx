import { events } from '@/events/events';
import { Sheet } from '@/grid/sheet/Sheet';
import { ImportProgress } from '@/ui/components/ImportProgress';
import { MouseEvent, useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { sheets } from '../grid/controller/Sheets';
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
    events.on('panMode', updatePanMode);
    return () => {
      events.off('panMode', updatePanMode);
    };
  }, []);

  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  useEffect(() => {
    pixiAppSettings.updateEditorInteractionState(editorInteractionState, setEditorInteractionState);
  }, [editorInteractionState, setEditorInteractionState]);

  // Handle URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // change sheet based on URL
    const sheetName = params.get('sheet');
    let sheet: Sheet | undefined;
    if (sheetName) {
      sheet = sheets.getSheetByName(sheetName, true);
      if (sheet) {
        sheets.current = sheet.id;
      }
    }

    // change cursor position based on URL
    const x = params.has('x') ? parseInt(params.get('x')!) : undefined;
    const y = params.has('y') ? parseInt(params.get('y')!) : undefined;
    if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
      sheet = sheet || sheets.getFirst();
      sheet.cursor.changePosition({ cursorPosition: { x, y } });
    }

    // change CodeEditor based on URL
    const codeX = params.has('codeX') ? parseInt(params.get('codeX')!) : undefined;
    const codeY = params.has('codeY') ? parseInt(params.get('codeY')!) : undefined;
    let codeSheetName = params.get('codeSheet');
    if (codeX !== undefined && codeY !== undefined && !isNaN(codeX) && !isNaN(codeY)) {
      // sheet may be params.codeSheet or params.sheet or the first sheet
      let codeSheet = codeSheetName ? sheets.getSheetByName(codeSheetName, true) : undefined;
      codeSheet = codeSheet || sheet || sheets.getFirst();
      const sheetId = codeSheet.id;
      setEditorInteractionState((prev) => ({
        ...prev,
        showCodeEditor: true,
        selectedCell: {
          x: codeX,
          y: codeY,
        },
        selectedCellSheet: sheetId,
      }));
    }
  }, [setEditorInteractionState]);

  // Right click menu
  const [showContextMenu, setShowContextMenu] = useState(false);

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
        if (!showContextMenu) {
          setShowContextMenu(true);
        }
      }}
      onMouseDown={onMouseDown}
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
      <HTMLGridContainer parent={container} />
      <FloatingContextMenu container={container} showContextMenu={showContextMenu} />
      <ImportProgress />
    </div>
  );
}
