import { hasPermissionToEditFile } from '@/app/actions';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { drawCheckbox, drawDropdown, drawEmoji, type SpecialSprite } from '@/app/gridGL/cells/cellsLabel/drawSpecial';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type {
  RenderCheckbox,
  RenderDropdown,
  RenderEmoji,
  RenderSpecial,
} from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellsTextHashSpecial';
import type { Point } from 'pixi.js';
import { Container } from 'pixi.js';

export class CellsTextHashSpecial extends Container<SpecialSprite> {
  clear() {
    this.removeChildren();
  }

  private drawEmojis(emojis: RenderEmoji[]) {
    for (const emoji of emojis) {
      const emojiSprite = drawEmoji(emoji);
      if (emojiSprite) {
        this.addChild(emojiSprite);
      } else {
        console.error(`Failed to draw emoji: ${emoji.emoji}`);
      }
    }
  }

  private drawCheckboxes(checkboxes: RenderCheckbox[]) {
    checkboxes.forEach((checkbox) => {
      this.addChild(drawCheckbox(checkbox));
    });
  }

  private drawDropdowns(dropdowns: RenderDropdown[]) {
    dropdowns.forEach((dropdown) => {
      this.addChild(drawDropdown(dropdown));
    });
  }

  update(special?: RenderSpecial) {
    this.clear();
    if (special) {
      this.drawCheckboxes(special.checkboxes);
      this.drawDropdowns(special.dropdowns);
      this.drawEmojis(special.emojis);
    }
  }

  // handle clicking on UI elements
  // if world is true, it skips the check and automatically triggers (reuse by pressing Space on cell)
  clickedToCell(column: number, row: number, world: Point | true) {
    const { permissions } = pixiAppSettings.editorInteractionState;
    if (!hasPermissionToEditFile(permissions)) {
      return;
    }

    this.children.forEach((child) => {
      const special = child as SpecialSprite;
      if (special.column === column && special.row === row) {
        if (special.type === 'checkbox' && (world === true || intersects.rectanglePoint(special.rectangle, world))) {
          quadraticCore.setCellValue(sheets.current, column, row, special.checkbox ? 'false' : 'true', false);
        } else if (
          special.type === 'dropdown' &&
          (world === true || intersects.rectanglePoint(special.rectangle, world))
        ) {
          events.emit('triggerCell', special.column, special.row, false);
        }
      }
    });
  }
}
