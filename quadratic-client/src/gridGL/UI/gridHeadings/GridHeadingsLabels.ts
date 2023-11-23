import { BitmapText, Container } from 'pixi.js';
import { colors } from '../../../theme/colors';
import { pixiApp } from '../../pixiApp/PixiApp';
import { GRID_HEADER_FONT_SIZE } from './GridHeadings';

interface LabelData {
  text: string;
  x: number;
  y: number;
}

export class GridHeadingsLabels extends Container {
  private labelData: LabelData[] = [];

  clear() {
    this.labelData = [];
    this.children.forEach((child) => (child.visible = false));
  }

  add(label: LabelData): void {
    this.labelData.push(label);
  }

  private addLabelText(): BitmapText {
    const label = this.addChild(
      new BitmapText('', {
        fontName: 'OpenSans',
        fontSize: GRID_HEADER_FONT_SIZE,
        tint: colors.gridHeadingLabel,
      })
    );
    label.anchor.set(0.5);
    return label;
  }

  // add labels to headings using cached labels
  update() {
    // keep current children to use as the cache
    this.children.forEach((child) => (child.visible = false));

    const inverseScale = 1 / pixiApp.viewport.scale.x;
    const available = [...this.children] as BitmapText[];
    const leftovers: LabelData[] = [];

    // reuse existing labels that have the same text
    this.labelData.forEach((data) => {
      const index = available.findIndex((label) => label.text === data.text);
      if (index === -1) {
        leftovers.push(data);
      } else {
        const label = available[index];
        label.scale.set(inverseScale);
        label.position.set(data.x, data.y);
        label.visible = true;
        available.splice(index, 1);
      }
    });

    // use existing labels but change the text
    leftovers.forEach((data, i) => {
      let label: BitmapText;
      if (i < available.length) {
        label = available[i];
        label.visible = true;
      }

      // otherwise create new labels
      else {
        label = this.addLabelText();
      }
      label.scale.set(inverseScale);
      label.position.set(data.x, data.y);
      label.text = data.text;
    });
  }
}
