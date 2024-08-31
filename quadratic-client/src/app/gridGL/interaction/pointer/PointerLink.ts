import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts';
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

  private getLinkUrl = (url: string): string => {
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

  private openLink = (url: string) => {
    window.open(this.getLinkUrl(url), '_blank', 'noopener,noreferrer');
  };

  pointerMove = (world: Point, event: PointerEvent): boolean => {
    const columnRow = this.checkHoverLink(world);
    if (columnRow) {
      this.cursor = 'pointer';
      return true;
    }
    this.cursor = undefined;
    return false;
  };

  pointerDown = (world: Point, event: PointerEvent): boolean => {
    if (!matchShortcut('open_link', event)) return false;
    this.cursor = undefined;
    const cell = this.checkHoverLink(world);
    if (cell) {
      quadraticCore.getDisplayCell(pixiApp.cellsSheets.current?.sheetId ?? '', cell.x, cell.y).then((url) => {
        if (url !== undefined) this.openLink(url);
      });
      return true;
    }
    return false;
  };
}
