import { ErrorMarker } from '@/app/gridGL/cells/CellsSheet';
import { generatedTextures } from '@/app/gridGL/generateTextures';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { Container, Point, Rectangle, Sprite, Texture } from 'pixi.js';

const INDICATOR_SIZE = 4;
export const TRIANGLE_SCALE = 0.1;

export type CellsMarkerTypes = 'CodeIcon' | 'FormulaIcon' | 'AIIcon' | 'ErrorIcon';

interface Marker {
  bounds: Rectangle;
  codeCell: JsRenderCodeCell;
  triangle?: Sprite;
  symbol?: Sprite;
}

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
      triangle.position.set(box.x, box.y);
      triangle.tint = colors.cellColorError;
    }

    let symbol: Sprite | undefined;
    if (isError || selected || pixiAppSettings.showCellTypeOutlines) {
      symbol = this.addChild(new Sprite());
      symbol.height = INDICATOR_SIZE;
      symbol.width = INDICATOR_SIZE;
      symbol.position.set(box.x + 1.25, box.y + 1.25);
      if (codeCell.language === 'Python') {
        symbol.texture = Texture.from('/images/python-icon.png');
        symbol.tint = isError ? 0xffffff : colors.cellColorUserPython;
      } else if (codeCell.language === 'Formula') {
        symbol.texture = Texture.from('/images/formula-fx-icon.png');
        symbol.tint = isError ? 0xffffff : colors.cellColorUserFormula;
      } else if (codeCell.language === 'Javascript') {
        symbol.texture = Texture.from('/images/javascript-icon.png');
        symbol.tint = isError ? colors.cellColorError : colors.cellColorUserJavascript;
        if (isError) {
          symbol.x -= 1;
          symbol.y -= 1;
        }
      } else if (codeCell.language === 'AIResearcher') {
        symbol.texture = Texture.from('/images/ai-icon.png');
        symbol.tint = isError ? colors.cellColorError : colors.cellColorUserAIResearcher;
      }
    }
    this.markers.push({
      bounds: new Rectangle(box.x, box.y, box.width, box.height),
      codeCell,
      triangle,
      symbol,
    });
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
