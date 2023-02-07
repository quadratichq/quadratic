import { Container, BitmapText, Sprite } from 'pixi.js';
import { colors } from '../../../../theme/colors';

export type CellsMarkerTypes = 'CodeIcon' | 'FormulaIcon' | 'ErrorIcon';

export class CellsMarkers extends Container {
  private visibleIndex = 0;

  clear() {
    this.children.forEach((child) => (child.visible = false));
    this.visibleIndex = 0;
  }

  add(x: number, y: number, type: CellsMarkerTypes): void {
    let child: BitmapText | Sprite;
    if (type === 'CodeIcon') {
      if (this.visibleIndex < this.children.length) {
        child = this.children[this.visibleIndex] as BitmapText;
        this.visibleIndex++;
      } else {
        child = this.addChild(new BitmapText('</>', { fontName: 'OpenSans', fontSize: 4 }));
        child.tint = colors.cellColorUserPython;
        this.addChild(child);
      }
      child.position.set(x + 1, y - 0.5);
      child.visible = true;
    } else if (type === 'FormulaIcon') {
      if (this.visibleIndex < this.children.length) {
        child = this.children[this.visibleIndex] as Sprite;
        this.visibleIndex++;
      } else {
        child = this.addChild(Sprite.from('images/formula-fx-icon.png'));
        child.tint = colors.highlightYellow;
        child.height = 4;
        child.width = 4;
        this.addChild(child);
      }
      child.position.set(x + 1.25, y + 1);
      child.visible = true;
    }
  }

  debugShowCachedCounts(): void {
    console.log(
      `[CellsMarker] ${this.children.length} objects | ${this.children.filter((child) => child.visible).length} visible`
    );
  }
}
