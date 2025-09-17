import { events } from '@/app/events/events';
import type { ErrorMarker } from '@/app/gridGL/cells/CellsSheet';
import { generatedTextures } from '@/app/gridGL/generateTextures';
import type { CodeCellLanguage, JsRenderCodeCell } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import type { Point } from 'pixi.js';
import { Assets, Container, Rectangle, Sprite } from 'pixi.js';

// const INDICATOR_SIZE = 4;
export const TRIANGLE_SCALE = 0.1;

export type CellsMarkerTypes = 'CodeIcon' | 'FormulaIcon' | 'AIIcon' | 'ErrorIcon';

interface Marker {
  bounds: Rectangle;
  codeCell: JsRenderCodeCell;
  triangle?: Sprite;
  symbol?: Sprite;
}

export const getLanguageSymbol = (language: CodeCellLanguage, isError: boolean): Sprite | undefined => {
  const symbol = new Sprite();
  if (language === 'Python') {
    symbol.texture = Assets.get('icon-python');
    symbol.tint = 0xffffff;
    return symbol;
  } else if (language === 'Formula') {
    symbol.texture = Assets.get('icon-formula');
    symbol.tint = 0xffffff;
    return symbol;
  } else if (language === 'Javascript') {
    symbol.texture = Assets.get('icon-javascript');
    symbol.tint = 0xffffff;
    return symbol;
  } else if (typeof language === 'object') {
    symbol.texture = Assets.get('icon-connection');
    symbol.tint = 0xffffff;
    return symbol;
  }
};

export class CellsMarkers extends Container {
  private markers: Marker[] = [];

  clear() {
    this.removeChildren();
    this.markers = [];
  }

  add(box: Rectangle, codeCell: JsRenderCodeCell) {
    this.remove(codeCell.x, codeCell.y);
    const isError = codeCell.state === 'RunError' || codeCell.state === 'SpillError';
    let triangle: Sprite | undefined;
    // const symbol = getLanguageSymbol(codeCell.language, isError);
    if (isError) {
      triangle = this.addChild(new Sprite(generatedTextures.triangle));
      triangle.scale.set(TRIANGLE_SCALE);
      triangle.anchor.set(1, 0);
      triangle.position.set(box.x + box.width, box.y);
      triangle.tint = colors.cellColorError;

      // if (symbol) {
      //   this.addChild(symbol);
      //   symbol.height = INDICATOR_SIZE;
      //   symbol.width = INDICATOR_SIZE;
      //   symbol.position.set(box.x + box.width - 5, box.y + 1);
      // }
    }

    if (isError) {
      this.markers.push({
        bounds: new Rectangle(box.x, box.y, box.width, box.height),
        codeCell,
        triangle,
      });
    }
  }

  remove(x: number, y: number) {
    const marker = this.markers.find((marker) => marker.codeCell.x === x && marker.codeCell.y === y);
    if (marker) {
      if (marker.triangle) {
        this.removeChild(marker.triangle);
      }
      if (marker?.symbol) {
        this.removeChild(marker.symbol);
      }
      this.markers = this.markers.filter((m) => m !== marker);
    }
    events.emit('setDirty', { cursor: true });
  }

  intersectsCodeInfo(point: Point): JsRenderCodeCell | undefined {
    const marker = this.markers.find((marker) => marker.bounds.contains(point.x, point.y));
    if (marker?.codeCell) {
      return marker.codeCell;
    }
  }

  getErrorMarker(x: number, y: number): ErrorMarker | undefined {
    const marker = this.markers.find((marker) => marker.codeCell.x === x && marker.codeCell.y === y);
    if (marker) {
      if (marker.codeCell.state === 'RunError') {
        return {
          triangle: marker.triangle,
          symbol: marker.symbol,
        };
      } else if (marker.codeCell.state === 'SpillError') {
        return {
          triangle: marker.triangle,
          symbol: marker.symbol,
        };
      }
    }
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsMarker] ${this.children.length} objects | ${this.children.filter((child) => child.visible).length} visible`
    );
  }
}
