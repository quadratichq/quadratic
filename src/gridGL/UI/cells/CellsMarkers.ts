import { Container, Sprite, Texture } from 'pixi.js';
import { colors } from '../../../theme/colors';

export type CellsMarkerTypes = 'CodeIcon' | 'FormulaIcon' | 'ErrorIcon';

export class CellsMarkers extends Container {
  private visibleIndex = 0;

  clear() {
    this.children.forEach((child) => (child.visible = false));
    this.visibleIndex = 0;
  }

  add(x: number, y: number, type: CellsMarkerTypes, white?: boolean): void {
    let child: Sprite;
    if (this.visibleIndex < this.children.length) {
      child = this.children[this.visibleIndex] as Sprite;
      child.visible = true;
      this.visibleIndex++;
    } else {
      child = this.addChild(new Sprite());
      child.height = 4;
      child.width = 4;
    }

    if (type === 'CodeIcon') {
      child.position.set(x + 1.25, y + 1.25);
      child.texture = Texture.from('images/python-icon.png');
      child.tint = colors.cellColorUserPython;
      child.width = child.height = 4;
    } else if (type === 'FormulaIcon') {
      child.position.set(x + 1.25, y + 1.25);
      child.texture = Texture.from('images/formula-fx-icon.png');
      child.tint = colors.cellColorUserFormula;
      child.width = child.height = 4;
    } else if (type === 'ErrorIcon') {
      child.position.set(x, y);
      child.texture = Texture.from('images/error-icon.png');
      child.tint = colors.cellColorError;
      child.width = child.height = 12;
    }

    if (white) child.tint = 0xffffff;
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsMarker] ${this.children.length} objects | ${this.children.filter((child) => child.visible).length} visible`
    );
  }
}
