import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import { openLink } from '@/app/helpers/links';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Point } from 'pixi.js';

const HOVER_DELAY = 500;

export class PointerLink {
  cursor?: string;

  private pos?: Coordinate;
  private text?: string;
  private subtext?: string;
  private hoverTimeout?: NodeJS.Timeout;

  private emitHoverTooltip = (pos?: Coordinate, text?: string, subtext?: string) => {
    if (text !== this.text || subtext !== this.subtext || pos?.x !== this.pos?.x || pos?.y !== this.pos?.y) {
      clearTimeout(this.hoverTimeout);
      this.pos = pos;
      this.text = text;
      this.subtext = subtext;
      this.hoverTimeout = undefined;
      events.emit('hoverTooltip', pos, undefined, undefined);
    } else if (!this.hoverTimeout) {
      this.hoverTimeout = setTimeout(() => {
        events.emit('hoverTooltip', pos, text, subtext);
      }, HOVER_DELAY);
    }
  };

  private checkHoverLink = (world: Point): Coordinate | undefined => {
    if (!pixiApp.cellsSheets.current) {
      throw new Error('Expected cellsSheets.current to be defined in PointerLink');
    }
    const cellsLabels = pixiApp.cellsSheets.current.cellsLabels;
    return cellsLabels.intersectsLink(world);
  };

  pointerMove = (world: Point, _event: PointerEvent): boolean => {
    const link = this.checkHoverLink(world);
    if (link) {
      this.cursor = 'pointer';
      const tooltipText = 'Open link ';
      const tooltipSubtext = `(${defaultActionSpec[Action.CmdClick].label})`;
      this.emitHoverTooltip(link, tooltipText, tooltipSubtext);
      return true;
    }
    this.cursor = undefined;
    this.emitHoverTooltip();
    return false;
  };

  pointerDown = (world: Point, event: PointerEvent): boolean => {
    const { multiCursor } = sheets.sheet.cursor;
    if (matchShortcut(Action.CmdClick, event) && !multiCursor) {
      const link = this.checkHoverLink(world);
      if (link) {
        quadraticCore.getDisplayCell(pixiApp.cellsSheets.current?.sheetId ?? '', link.x, link.y).then((url) => {
          if (url) openLink(url);
        });
        return true;
      }
    }
    return false;
  };
}
