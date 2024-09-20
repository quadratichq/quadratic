import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Link } from '@/app/gridGL/types/links';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import { openLink } from '@/app/helpers/links';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Point } from 'pixi.js';

const HOVER_DELAY = 500;

export class PointerLink {
  cursor?: string;

  private link?: Link;
  private text?: string;
  private subtext?: string;
  private hoverTimeout?: NodeJS.Timeout;

  private emitHoverTooltip = (link?: Link, text?: string, subtext?: string) => {
    if (
      text !== this.text ||
      subtext !== this.subtext ||
      link?.pos?.x !== this.link?.pos?.x ||
      link?.pos?.y !== this.link?.pos?.y
    ) {
      clearTimeout(this.hoverTimeout);
      this.link = link;
      this.text = text;
      this.subtext = subtext;
      this.hoverTimeout = undefined;
      events.emit('hoverTooltip', link?.textRectangle, undefined, undefined);
    } else if (!this.hoverTimeout) {
      this.hoverTimeout = setTimeout(() => {
        events.emit('hoverTooltip', link?.textRectangle, text, subtext);
      }, HOVER_DELAY);
    }
  };

  private checkHoverLink = (world: Point): Link | undefined => {
    if (!pixiApp.cellsSheets.current) {
      throw new Error('Expected cellsSheets.current to be defined in PointerLink');
    }
    const link = pixiApp.cellsSheets.current.cellsLabels.intersectsLink(world);
    return link;
  };

  pointerMove = (world: Point, event: PointerEvent): boolean => {
    const link = this.checkHoverLink(world);
    if (link) {
      this.cursor = matchShortcut(Action.CmdClick, event) ? 'pointer' : undefined;
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
      if (link?.pos) {
        quadraticCore.getDisplayCell(pixiApp.cellsSheets.current?.sheetId ?? '', link.pos.x, link.pos.y).then((url) => {
          if (url) openLink(url);
        });
        return true;
      }
    }
    return false;
  };
}
