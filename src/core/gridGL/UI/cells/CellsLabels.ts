import { Container, BitmapText, MaskData, Sprite, Texture } from 'pixi.js';
import { Coordinate } from '../../types/size';

interface LabelData {
  text: string;
  x: number;
  y: number;
  location?: Coordinate;
  isQuadrant?: boolean;
  expectedWidth: number;
}

interface Label extends BitmapText {
  location?: Coordinate;
  overflowRight?: number;
  overflowLeft?: number;
  saveMask?: Sprite;
}

// todo: make this part of the cell's style data structure
const fontSize = 14;

export class CellsLabels extends Container {
  private labelData: LabelData[] = [];

  clear() {
    this.labelData = [];
  }

  add(label: LabelData): void {
    this.labelData.push(label);
  }

  private addLabelText(): BitmapText {
    const label = this.addChild(
      new BitmapText('', {
        fontName: 'OpenSans',
        fontSize,
        tint: 0,
        align: 'left',
      }) as Label
    );
    return label;
  }

  private clearClippingMask(label: Label): void {
    if (label.mask) {
      (label.mask as Sprite).visible = false;
      label.mask = null;
    }
  }

  // checks to see if the label needs to be clipped based on other labels
  private checkForClipping(label: Label, data: LabelData): void {
    if (label.width > data.expectedWidth) {
      // if (data.text === 'This is a long piece of text') debugger
      const start = label.x + data.expectedWidth + 1;
      const end = start + (label.width - data.expectedWidth);
      const labels = this.labelData.filter(search => search.y === data.y && search.x >= start && search.x <= end);
      if (labels.length) {
        let mask: Sprite;
        if (label.mask) {
          mask = label.mask as Sprite;
        } else if (label.saveMask) {
          mask = label.saveMask;
          mask.visible = true;
          label.mask = mask;
        } else {
          mask = new Sprite(Texture.WHITE);
          label.mask = mask;
          label.addChild(mask);
          label.saveMask = mask;
        }
        mask.position.set(data.expectedWidth + 1, 0);
        mask.width = label.width - data.expectedWidth;
        mask.height = label.height;
      } else {
        this.clearClippingMask(label);
      }
    } else {
      this.clearClippingMask(label);
    }
  }

  // add labels to headings using cached labels
  update() {
    // keep current children to use as the cache
    this.children.forEach((child) => (child.visible = false));

    const available = [...this.children] as Label[];
    const leftovers: LabelData[] = [];

    // reuse existing labels that have the same text
    this.labelData.forEach((data) => {
      const index = available.findIndex((label) => label.text === data.text);
      if (index === -1) {
        leftovers.push(data);
      } else {
        const label = available[index];
        label.position.set(data.x, data.y);
        label.visible = true;
        this.checkForClipping(label, data);

        // track overflowed widths
        if (data.isQuadrant) {
          label.location = data.location;
          const width = label.width;
          if (width > data.expectedWidth) {
            label.overflowRight = width - data.expectedWidth;
          }
        }
        available.splice(index, 1);
      }
    });

    // use existing labels but change the text
    leftovers.forEach((data, i) => {
      let label: Label;
      if (i < available.length) {
        label = available[i];
        label.visible = true;
      }

      // otherwise create new labels
      else {
        label = this.addLabelText();
      }
      label.position.set(data.x, data.y);
      label.text = data.text;
      this.checkForClipping(label, data);

      // track overflowed widths
      if (data.expectedWidth) {
        label.location = data.location;
        const width = label.width;
        if (width > data.expectedWidth) {
          label.overflowRight = width - data.expectedWidth;
        }
      }
    });
  }

  get(): Label[] {
    return this.children as Label[];
  }
}
