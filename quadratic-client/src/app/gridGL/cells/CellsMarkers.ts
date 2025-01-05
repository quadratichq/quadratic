import type { ErrorMarker } from '@/app/gridGL/cells/CellsSheet';
import { generatedTextures } from '@/app/gridGL/generateTextures';
import type { CodeCellLanguage, JsRenderCodeCell } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import type { Point } from 'pixi.js';
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';

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
    symbol.texture = Texture.from('icon-python');
    symbol.tint = isError ? 0xffffff : colors.cellColorUserPython;
    return symbol;
  } else if (language === 'Formula') {
    symbol.texture = Texture.from('icon-formula');
    symbol.tint = isError ? 0xffffff : colors.cellColorUserFormula;
    return symbol;
  } else if (language === 'Javascript') {
    symbol.texture = Texture.from('icon-javascript');
    symbol.tint = isError ? colors.cellColorError : 0xffffff;
    return symbol;
  } else if (typeof language === 'object') {
    switch (language.Connection?.kind) {
      case 'MSSQL':
        symbol.texture = Texture.from('icon-mssql');
        symbol.tint = isError ? colors.cellColorError : 0xffffff;
        return symbol;

      case 'POSTGRES':
        symbol.tint = isError ? colors.cellColorError : 0xffffff;
        symbol.texture = Texture.from('icon-postgres');
        return symbol;

      case 'MYSQL':
        symbol.tint = isError ? colors.cellColorError : 0xffffff;
        symbol.texture = Texture.from('icon-mysql');
        return symbol;

      case 'SNOWFLAKE':
        symbol.tint = isError ? colors.cellColorError : 0xffffff;
        symbol.texture = Texture.from('icon-snowflake');
        return symbol;

      default:
        console.log(`Unknown connection kind: ${language.Connection?.kind} in getLanguageSymbol`);
    }
  }
};

export class CellsMarkers extends Container {
  private markers: Marker[] = [];

  clear() {
    this.removeChildren();
    this.markers = [];
  }

  add(box: Rectangle, codeCell: JsRenderCodeCell, selected: boolean) {
    const isError = codeCell.state === 'RunError' || codeCell.state === 'SpillError';
    let triangle: Sprite | undefined;
    if (isError) {
      triangle = this.addChild(new Sprite(generatedTextures.triangle));
      triangle.scale.set(TRIANGLE_SCALE);
      triangle.anchor.set(1, 0);
      triangle.position.set(box.x + box.width - 0.5, box.y + 0.5);
      triangle.tint = colors.cellColorError;
    }

    if (isError) {
      //   const symbol = getLanguageSymbol(codeCell.language, isError);
      //   if (symbol) {
      //     this.addChild(symbol);
      //     symbol.height = INDICATOR_SIZE;
      //     symbol.width = INDICATOR_SIZE;
      //     symbol.position.set(box.x + 1.25, box.y + 1.25);
      //     if (isError) {
      //       symbol.x -= 1;
      //       symbol.y -= 1;
      //     }
      this.markers.push({
        bounds: new Rectangle(box.x, box.y, box.width, box.height),
        codeCell,
        triangle,
      });
    }
    // }
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
