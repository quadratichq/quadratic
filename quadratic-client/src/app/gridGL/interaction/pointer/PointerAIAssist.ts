import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { events } from '@/app/events/events';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import { Point } from 'pixi.js';

export class PointerAIAssist {
  cursor?: string;

  private pos?: Coordinate;
  private text?: string;

  private emitHoverTooltip = (pos?: Coordinate, text?: string) => {
    if (text === this.text && pos?.x === this.pos?.x && pos?.y === this.pos?.y) return;
    events.emit('hoverTooltip', pos, text);
    this.pos = pos;
    this.text = text;
  };

  private checkHoverCodeCell = (world: Point): boolean => {
    if (!pixiApp.cellsSheets.current) throw new Error('Expected cellsSheets.current to be defined in PointerCursor');
    const codeCell = pixiApp.cellsSheets.current.cellsMarkers.intersectsCodeInfo(world);
    if (codeCell && codeCell.state === 'RunError') {
      this.cursor = 'pointer';
      const tooltipText = `Ask AI (${defaultActionSpec[Action.CmdClick].label})`;
      this.emitHoverTooltip({ x: codeCell.x, y: codeCell.y }, tooltipText);
      return true;
    } else {
      this.cursor = 'unset';
      this.emitHoverTooltip();
      return false;
    }
  };

  pointerMove = (world: Point): boolean => {
    return this.checkHoverCodeCell(world);
  };

  pointerDown = (world: Point, event: PointerEvent): boolean => {
    if (matchShortcut(Action.CmdClick, event)) {
      if (!pixiApp.cellsSheets.current) throw new Error('Expected cellsSheets.current to be defined in PointerCursor');
      const codeCell = pixiApp.cellsSheets.current.cellsMarkers.intersectsCodeInfo(world);
      if (codeCell && codeCell.state === 'RunError') {
        events.emit('askAICodeCell', pixiApp.cellsSheets.current.sheetId, { x: codeCell.x, y: codeCell.y });
        return true;
      }
    }
    return false;
  };
}
