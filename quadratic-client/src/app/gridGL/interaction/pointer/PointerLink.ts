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
  cursor: string | undefined;

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
      const tooltipText = `${defaultActionSpec[Action.CmdClick].label} to open link`;
      events.emit('hoverTooltip', pos, tooltipText);
      return true;
    }
    this.cursor = undefined;
    events.emit('hoverTooltip', undefined);
    return false;
  };

  pointerDown = (world: Point, event: PointerEvent): boolean => {
    if (matchShortcut(Action.CmdClick, event)) {
      const cell = this.checkHoverLink(world);
      if (cell) {
        quadraticCore.getDisplayCell(pixiApp.cellsSheets.current?.sheetId ?? '', cell.x, cell.y).then((url) => {
          if (url !== undefined) openLink(url);
        });
        return true;
      }
    }
    return false;
  };
}
