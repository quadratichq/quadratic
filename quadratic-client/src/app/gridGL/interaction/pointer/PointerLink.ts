import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { events } from '@/app/events/events';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import { openLink } from '@/app/helpers/links';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Point } from 'pixi.js';

export class PointerLink {
  cursor?: string;

  private pos?: Coordinate;
  private text?: string;

  private emitHoverTooltip = (pos?: Coordinate, text?: string) => {
    if (text === this.text && pos?.x === this.pos?.x && pos?.y === this.pos?.y) return;
    events.emit('hoverTooltip', pos, text);
    this.pos = pos;
    this.text = text;
  };

  private checkHoverLink = (world: Point): Coordinate | undefined => {
    if (!pixiApp.cellsSheets.current) {
      throw new Error('Expected cellsSheets.current to be defined in PointerLink');
    }
    const cellsLabels = pixiApp.cellsSheets.current.cellsLabels;
    return cellsLabels.intersectsLink(world);
  };

  pointerMove = (world: Point, _event: PointerEvent): boolean => {
    const pos = this.checkHoverLink(world);
    if (pos) {
      this.cursor = 'pointer';
      const tooltipText = `Open link (${defaultActionSpec[Action.CmdClick].label})`;
      this.emitHoverTooltip(pos, tooltipText);
      return true;
    }
    this.cursor = undefined;
    this.emitHoverTooltip();
    return false;
  };

  pointerDown = (world: Point, event: PointerEvent): boolean => {
    if (matchShortcut(Action.CmdClick, event)) {
      const cell = this.checkHoverLink(world);
      if (cell) {
        quadraticCore.getDisplayCell(pixiApp.cellsSheets.current?.sheetId ?? '', cell.x, cell.y).then((url) => {
          if (url) openLink(url);
        });
        return true;
      }
    }
    return false;
  };
}
