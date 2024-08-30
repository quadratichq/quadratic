import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Link } from '@/app/gridGL/types/link';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
import { Point } from 'pixi.js';

export class PointerLink {
  cursor: string | undefined;

  private checkHoverLink = (world: Point): Link | undefined => {
    if (!pixiApp.cellsSheets.current) throw new Error('Expected cellsSheets.current to be defined in PointerLink');
    const cellsLabels = pixiApp.cellsSheets.current.cellsLabels;
    const link = cellsLabels.intersectsLink(world);
    return link;
  };

  private getLinkUrl = (link: Link): string => {
    const url = link.link;
    if (url.match(/^https?:\/\//i)) {
      // URL already starts with http:// or https://
      return url;
    } else if (url.startsWith('/')) {
      // URL starts with /, it is a relative path
      return url;
    } else {
      // URL doesn't have a protocol, prepend https://
      return `https://${url}`;
    }
  };

  private openLink = (link: Link) => {
    const url = this.getLinkUrl(link);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  pointerMove = (world: Point, event: PointerEvent): boolean => {
    const link = this.checkHoverLink(world);
    if (link) {
      this.cursor = 'pointer';
      return true;
    }
    this.cursor = undefined;
    return false;
  };

  pointerDown = (world: Point, event: PointerEvent): boolean => {
    if (!matchShortcut('open_link', event)) return false;
    this.cursor = undefined;
    const link = this.checkHoverLink(world);
    if (link) {
      this.openLink(link);
      return true;
    }
    return false;
  };
}
