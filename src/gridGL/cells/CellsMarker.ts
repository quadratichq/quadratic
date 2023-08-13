import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { CodeCellLanguage } from '../../quadratic-core/types';
import { colors } from '../../theme/colors';
import { intersects } from '../helpers/intersects';

export type CellsMarkerTypes = 'CodeIcon' | 'FormulaIcon' | 'AIIcon' | 'ErrorIcon';

interface Marker {
  sprite: Sprite;
  rectangle: Rectangle;
}

export class CellsMarkers extends Container {
  private markers: Marker[] = [];

  clear() {
    this.removeChildren();
    this.markers = [];
  }

  cheapCull(bounds: Rectangle): void {
    this.markers.forEach((marker) => (marker.sprite.visible = intersects.rectangleRectangle(bounds, marker.rectangle)));
  }

  add(x: number, y: number, type: CodeCellLanguage, error?: boolean): void {
    const child = this.addChild(new Sprite());
    child.height = 4;
    child.width = 4;
    child.position.set(x + 1.25, y + 1.25);
    if (type === 'Python') {
      child.texture = Texture.from('images/python-icon.png');
      child.tint = colors.cellColorUserPython;
    } else if (type === 'Formula') {
      child.texture = Texture.from('images/formula-fx-icon.png');
      child.tint = colors.cellColorUserFormula;
    }

    this.markers.push({
      sprite: child,
      rectangle: new Rectangle(child.x, child.y, 4, 4),
    });

    // todo
    // else if (type === 'AIIcon') {
    //   child.position.set(x + 1.25, y + 1.25);
    //   child.texture = Texture.from('images/ai-icon.png');
    //   child.tint = colors.cellColorUserAI;
    //   child.width = child.height = 4;
    // } else if (type === 'ErrorIcon') {
    //   child.position.set(x, y);
    //   child.texture = Texture.from('images/error-icon.png');
    //   child.tint = colors.cellColorError;
    //   child.width = child.height = 12;
    // }

    // if (error) child.tint = 0xffffff;
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsMarker] ${this.children.length} objects | ${this.children.filter((child) => child.visible).length} visible`
    );
  }
}
