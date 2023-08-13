import { Container, Sprite, Texture } from 'pixi.js';
import { CodeCellLanguage } from '../../quadratic-core/types';
import { colors } from '../../theme/colors';

export type CellsMarkerTypes = 'CodeIcon' | 'FormulaIcon' | 'AIIcon' | 'ErrorIcon';

export class CellsMarkers extends Container {
  clear() {
    this.removeChildren();
  }

  add(x: number, y: number, type: CodeCellLanguage, error?: boolean): void {
    const child = this.addChild(new Sprite());
    child.height = 4;
    child.width = 4;

    if (type === 'Python') {
      child.position.set(x + 1.25, y + 1.25);
      child.texture = Texture.from('images/python-icon.png');
      child.tint = colors.cellColorUserPython;
      child.width = child.height = 4;
    } else if (type === 'Formula') {
      child.position.set(x + 1.25, y + 1.25);
      child.texture = Texture.from('images/formula-fx-icon.png');
      child.tint = colors.cellColorUserFormula;
      child.width = child.height = 4;
    }

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
