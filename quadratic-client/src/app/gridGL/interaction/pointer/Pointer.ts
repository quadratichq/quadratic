import { PointerCellMoving } from '@/app/gridGL/interaction/pointer/PointerCellMoving';
import { PointerLink } from '@/app/gridGL/interaction/pointer/PointerLink';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { Viewport } from 'pixi-viewport';
import { InteractionEvent } from 'pixi.js';
import { pixiApp } from '../../pixiApp/PixiApp';
import { PointerAutoComplete } from './PointerAutoComplete';
import { PointerCursor } from './pointerCursor';
import { PointerDown } from './PointerDown';
import { PointerHeading } from './PointerHeading';
import { PointerHtmlCells } from './PointerHtmlCells';
import { PointerImages } from './PointerImages';

export class Pointer {
  pointerHeading: PointerHeading;
  private pointerImages: PointerImages;
  pointerAutoComplete: PointerAutoComplete;
  private pointerHtmlCells: PointerHtmlCells;
  private pointerCursor: PointerCursor;
  pointerDown: PointerDown;
  pointerCellMoving: PointerCellMoving;
  private pointerLink: PointerLink;

  constructor(viewport: Viewport) {
    this.pointerHeading = new PointerHeading();
    this.pointerAutoComplete = new PointerAutoComplete();
    this.pointerImages = new PointerImages();
    this.pointerDown = new PointerDown();
    this.pointerCursor = new PointerCursor();
    this.pointerHtmlCells = new PointerHtmlCells();
    this.pointerCellMoving = new PointerCellMoving();
    this.pointerLink = new PointerLink();

    viewport.on('pointerdown', this.handlePointerDown);
    viewport.on('pointermove', this.pointerMove);
    viewport.on('pointerup', this.pointerUp);
    viewport.on('pointerupoutside', this.pointerUp);

    // canvas may not be defined during hmr
    if (pixiApp.canvas) {
      pixiApp.canvas.addEventListener('pointerleave', this.pointerLeave);
    }
    window.addEventListener('blur', this.pointerLeave);
    window.addEventListener('visibilitychange', this.visibilityChange);
  }

  private visibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      multiplayer.sendMouseMove();
    }
  };

  private pointerLeave = () => {
    multiplayer.sendMouseMove();
  };

  destroy() {
    const viewport = pixiApp.viewport;
    viewport.off('pointerdown', this.handlePointerDown);
    viewport.off('pointermove', this.pointerMove);
    viewport.off('pointerup', this.pointerUp);
    viewport.off('pointerupoutside', this.pointerUp);
    pixiApp.canvas.removeEventListener('pointerleave', this.pointerLeave);
    window.removeEventListener('blur', this.pointerLeave);
    this.pointerDown.destroy();
    this.pointerHtmlCells.destroy();
  }

  // check if more than one touch point (let the viewport handle the event)
  private isMoreThanOneTouch(e: InteractionEvent): boolean {
    return (
      e.data.pointerType === 'touch' &&
      (e.data.originalEvent as TouchEvent).touches &&
      (e.data.originalEvent as TouchEvent).touches.length > 1
    );
  }

  // todo: this should be removed when the code editor's layout is changed
  private isOverCodeEditor(e: InteractionEvent): boolean {
    const codeEditor = document.getElementById('QuadraticCodeEditorID');
    const overCodeEditor = !!codeEditor?.matches(':hover');
    if (!overCodeEditor) {
      multiplayer.sendMouseMove();
    }
    return overCodeEditor;
  }

  private handlePointerDown = (e: InteractionEvent): void => {
    if (this.isMoreThanOneTouch(e)) return;
    const world = pixiApp.viewport.toWorld(e.data.global);
    const event = e.data.originalEvent as PointerEvent;

    // the pointerImage.resizing check is needed so pointerHtmlCells
    // do not interfere with pointerImages when its resizing.
    (!this.pointerImages.resizing && this.pointerHtmlCells.pointerDown(e)) ||
      this.pointerImages.pointerDown(world) ||
      this.pointerCellMoving.pointerDown(event) ||
      this.pointerHtmlCells.pointerDown(e) ||
      this.pointerLink.pointerDown(world, event) ||
      this.pointerHeading.pointerDown(world, event) ||
      this.pointerAutoComplete.pointerDown(world) ||
      this.pointerDown.pointerDown(world, event);

    this.updateCursor();
  };

  private pointerMove = (e: InteractionEvent): void => {
    if (this.isMoreThanOneTouch(e) || this.isOverCodeEditor(e)) return;
    const world = pixiApp.viewport.toWorld(e.data.global);
    const event = e.data.originalEvent as PointerEvent;

    // the pointerImage.resizing check is needed so pointerHtmlCells
    // do not interfere with pointerImages when its resizing.
    (!this.pointerImages.resizing && this.pointerHtmlCells.pointerMove(e)) ||
      this.pointerImages.pointerMove(world) ||
      this.pointerCellMoving.pointerMove(event, world) ||
      this.pointerHtmlCells.pointerMove(e) ||
      this.pointerLink.pointerMove(world, event) ||
      this.pointerHeading.pointerMove(world) ||
      this.pointerAutoComplete.pointerMove(world) ||
      this.pointerDown.pointerMove(world, event) ||
      this.pointerCursor.pointerMove(world);

    this.updateCursor();
  };

  // change the cursor based on pointer priority
  private updateCursor() {
    const cursor =
      this.pointerCellMoving.cursor ??
      this.pointerHtmlCells.cursor ??
      this.pointerImages.cursor ??
      this.pointerLink.cursor ??
      this.pointerHeading.cursor ??
      this.pointerAutoComplete.cursor;
    pixiApp.canvas.style.cursor = cursor ?? 'unset';
  }

  private pointerUp = (e: InteractionEvent): void => {
    if (this.isMoreThanOneTouch(e)) return;
    this.pointerHtmlCells.pointerUp(e) ||
      this.pointerImages.pointerUp() ||
      this.pointerCellMoving.pointerUp() ||
      this.pointerHeading.pointerUp() ||
      this.pointerAutoComplete.pointerUp() ||
      this.pointerDown.pointerUp();

    this.updateCursor();
  };

  handleEscape(): boolean {
    // close search if canvas gets the keyboard event
    if (pixiAppSettings.editorInteractionState.showSearch) {
      pixiAppSettings.setEditorInteractionState?.({
        ...pixiAppSettings.editorInteractionState,
        showSearch: false,
      });
      return true;
    }
    return (
      this.pointerCellMoving.handleEscape() ||
      this.pointerHtmlCells.handleEscape() ||
      this.pointerImages.handleEscape() ||
      this.pointerHeading.handleEscape() ||
      this.pointerAutoComplete.handleEscape()
    );
  }

  getCursor(): string {
    return this.pointerHeading.cursor || this.pointerAutoComplete.cursor || 'default';
  }
}
