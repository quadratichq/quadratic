import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { Container, Point, Rectangle, Sprite, Texture } from 'pixi.js';
import { colors } from '../../theme/colors';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';
import { generatedTextures } from '../generateTextures';

const INDICATOR_SIZE = 4;
export const TRIANGLE_SCALE = 0.1;

export type CellsMarkerTypes = 'CodeIcon' | 'FormulaIcon' | 'AIIcon' | 'ErrorIcon';

interface Marker {
  bounds: Rectangle;
  codeCell: JsRenderCodeCell;
}

export class CellsMarkers extends Container {
  private markers: Marker[] = [];

  clear() {
    this.removeChildren();
    this.markers = [];
  }

  add(box: Rectangle, codeCell: JsRenderCodeCell, selected: boolean) {
    const isError = codeCell.state === 'RunError' || codeCell.state === 'SpillError';
    if (isError) {
      const sprite = this.addChild(new Sprite(generatedTextures.triangle));
      sprite.scale.set(TRIANGLE_SCALE);
      sprite.position.set(box.x, box.y);
      sprite.tint = colors.cellColorError;
    }

    if (isError || selected || pixiAppSettings.showCellTypeOutlines) {
      const child = this.addChild(new Sprite());
      child.height = INDICATOR_SIZE;
      child.width = INDICATOR_SIZE;
      child.position.set(box.x + 1.25, box.y + 1.25);
      if (codeCell.language === 'Python') {
        child.texture = Texture.from('/images/python-icon.png');
        child.tint = isError ? 0xffffff : colors.cellColorUserPython;
      } else if (codeCell.language === 'Formula') {
        child.texture = Texture.from('/images/formula-fx-icon.png');
        child.tint = isError ? 0xffffff : colors.cellColorUserFormula;
      } else if (codeCell.language === 'Javascript') {
        child.texture = Texture.from('/images/javascript-icon.png');
        child.tint = isError ? colors.cellColorError : colors.cellColorUserJavascript;
        if (isError) {
          child.x -= 1;
          child.y -= 1;
        }
      }
    }
    this.markers.push({
      bounds: new Rectangle(box.x, box.y, box.width, box.height),
      codeCell,
    });
  }

  intersectsCodeInfo(point: Point): JsRenderCodeCell | undefined {
    const marker = this.markers.find((marker) => marker.bounds.contains(point.x, point.y));
    if (marker?.codeCell) {
      return marker.codeCell;
    }
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsMarker] ${this.children.length} objects | ${this.children.filter((child) => child.visible).length} visible`
    );
  }
}
