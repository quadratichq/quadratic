import * as PIXI from 'pixi.js';
import { colors } from '../../../../theme/colors';
import { PixiApp } from '../../pixiApp/PixiApp';

export type CellMarkerTypes = 'CodeIcon';

export class CellMarkers extends PIXI.Container {
  private codeIcons: PIXI.BitmapText[] = [];
  private codeIconsIndex = 0;

  clear() {
    this.codeIcons.forEach(child => child.visible = true);
    this.codeIconsIndex = 0;
  }

  add(x: number, y: number, type: CellMarkerTypes): void {
    let child: PIXI.BitmapText;
    if (type === 'CodeIcon') {
      if (this.codeIconsIndex < this.codeIcons.length) {
        child = this.codeIcons[this.codeIconsIndex++] as PIXI.BitmapText;
      } else {
        child = this.addChild(new PIXI.BitmapText('</>', { fontName: 'OpenSans', fontSize: 4 }));
        child.tint = colors.cellColorUserPython;
      }
      child.position.set(x + 1, y - 0.5);
      child.visible = true;
    }
  }
}