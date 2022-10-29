import { Container, BitmapText } from 'pixi.js';

interface LabelData {
  text: string;
  x: number;
  y: number;
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
      })
    );
    return label;
  }

  // add labels to headings using cached labels
  update() {
    // keep current children to use as the cache
    this.children.forEach((child) => (child.visible = false));

    const available = [...this.children] as BitmapText[];
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
      label.position.set(data.x, data.y);
      label.text = data.text;
    });
  }
}
