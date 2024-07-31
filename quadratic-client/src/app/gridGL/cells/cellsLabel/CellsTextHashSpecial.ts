import type {
  RenderCheckbox,
  RenderDropdown,
  RenderSpecial,
} from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import { Container } from 'pixi.js';
import { drawCheckbox, drawDropdown } from './drawSpecial';

export class CellsTextHashSpecial extends Container {
  clear() {
    this.removeChildren();
  }

  private drawCheckboxes(checkboxes: RenderCheckbox[]) {
    checkboxes.forEach((checkbox) => {
      this.addChild(drawCheckbox(checkbox.x, checkbox.y, checkbox.value));
    });
  }

  private drawDropdowns(dropdowns: RenderDropdown[]) {
    dropdowns.forEach((dropdown) => {
      this.addChild(drawDropdown(dropdown.x, dropdown.y));
    });
  }

  update(special?: RenderSpecial) {
    this.clear();
    if (special) {
      this.drawCheckboxes(special.checkboxes);
      this.drawDropdowns(special.dropdowns);
    }
  }
}
