import { events } from '@/app/events/events';
import { content } from '@/app/gridGL/pixiApp/Content';
import { openLink } from '@/app/helpers/links';
import type { Link } from '@/app/shared/types/links';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { FederatedPointerEvent, Point } from 'pixi.js';
import { Rectangle } from 'pixi.js';

export class PointerLink {
  cursor?: string;

  private link?: Link;

  private checkHoverLink = (world: Point): Link | undefined => {
    if (!content.cellsSheets.current) {
      throw new Error('Expected cellsSheets.current to be defined in PointerLink');
    }
    const link = content.cellsSheets.current.cellsLabels.intersectsLink(world);
    return link;
  };

  // Handle cmd/ctrl + click to open link directly
  pointerDown = (world: Point, event: FederatedPointerEvent): boolean => {
    if (!(event.metaKey || event.ctrlKey)) return false;

    const link = this.checkHoverLink(world);
    if (!link) return false;

    if (link.url) {
      openLink(link.url);
      return true;
    } else if (link.pos) {
      // For naked URLs, fetch the URL from cell value
      quadraticCore.getDisplayCell(content.cellsSheets.current?.sheetId ?? '', link.pos.x, link.pos.y).then((url) => {
        if (url) {
          openLink(url);
        }
      });
      return true;
    }

    return false;
  };

  private emitHoverLink = (link?: Link) => {
    // Only emit if the link changed
    if (link?.pos?.x !== this.link?.pos?.x || link?.pos?.y !== this.link?.pos?.y || link?.url !== this.link?.url) {
      this.link = link;

      if (link?.pos && link.url) {
        const rect = new Rectangle(
          link.textRectangle.x,
          link.textRectangle.y,
          link.textRectangle.width,
          link.textRectangle.height
        );
        events.emit('hoverLink', {
          x: link.pos.x,
          y: link.pos.y,
          url: link.url,
          rect,
          linkText: link.linkText,
          isNakedUrl: link.isNakedUrl,
          spanStart: link.spanStart,
          spanEnd: link.spanEnd,
        });
      } else if (link?.pos) {
        // For naked URLs without url in link data, fetch the URL from cell value
        quadraticCore.getDisplayCell(content.cellsSheets.current?.sheetId ?? '', link.pos.x, link.pos.y).then((url) => {
          if (url) {
            const rect = new Rectangle(
              link.textRectangle.x,
              link.textRectangle.y,
              link.textRectangle.width,
              link.textRectangle.height
            );
            events.emit('hoverLink', { x: link.pos.x, y: link.pos.y, url, rect, isNakedUrl: true });
          }
        });
      } else {
        events.emit('hoverLink', undefined);
      }
    }
  };

  pointerMove = (world: Point, event: FederatedPointerEvent): boolean => {
    const link = this.checkHoverLink(world);
    if (link) {
      // Only show pointer cursor when cmd/ctrl is pressed (i.e., when clicking will open the link)
      this.cursor = event.metaKey || event.ctrlKey ? 'pointer' : undefined;
      this.emitHoverLink(link);
      return true;
    }
    this.cursor = undefined;
    this.emitHoverLink(undefined);
    return false;
  };
}
