import * as PIXI from 'pixi.js';
import { colors } from '../../../../theme/colors';

export type CellsMarkerTypes = 'CodeIcon';

export class CellsMarkers extends PIXI.Container {
  private codeIcons: PIXI.BitmapText[] = [];
  private codeIconsIndex = 0;

  clear() {
    this.codeIcons.forEach(child => child.visible = false);
    this.codeIconsIndex = 0;
  }

  add(x: number, y: number, type: CellsMarkerTypes): void {
    let child: PIXI.BitmapText;
    if (type === 'CodeIcon') {
      if (this.codeIconsIndex < this.codeIcons.length) {
        child = this.codeIcons[this.codeIconsIndex] as PIXI.BitmapText;
        this.codeIconsIndex++;
      } else {
        child = this.addChild(new PIXI.BitmapText('</>', { fontName: 'OpenSans', fontSize: 4 }));
        child.tint = colors.cellColorUserPython;
      }
      child.position.set(x + 1, y - 0.5);
      child.visible = true;
    }
  }
}