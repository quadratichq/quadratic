import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { PointerAutoComplete } from '@/app/gridGL/interaction/pointer/PointerAutoComplete';
import { PointerCellMoving } from '@/app/gridGL/interaction/pointer/PointerCellMoving';
import { PointerCursor } from '@/app/gridGL/interaction/pointer/pointerCursor';
import { PointerDown } from '@/app/gridGL/interaction/pointer/PointerDown';
import { PointerHeading } from '@/app/gridGL/interaction/pointer/PointerHeading';
import { PointerHtmlCells } from '@/app/gridGL/interaction/pointer/PointerHtmlCells';
import { PointerImages } from '@/app/gridGL/interaction/pointer/PointerImages';
import { PointerLink } from '@/app/gridGL/interaction/pointer/PointerLink';
import { PointerTable } from '@/app/gridGL/interaction/pointer/PointerTable';
import { PointerTableResize } from '@/app/gridGL/interaction/pointer/PointerTableResize';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import type { Viewport } from 'pixi-viewport';
import type { FederatedPointerEvent } from 'pixi.js';

export class Pointer {
  pointerHeading: PointerHeading;
  private pointerImages: PointerImages;
  pointerAutoComplete: PointerAutoComplete;
  pointerTableResize: PointerTableResize;
  private pointerHtmlCells: PointerHtmlCells;
  private pointerCursor: PointerCursor;
  pointerDown: PointerDown;
  pointerCellMoving: PointerCellMoving;
  private pointerTable: PointerTable;
  private pointerLink: PointerLink;

  constructor(viewport: Viewport) {
    this.pointerHeading = new PointerHeading();
    this.pointerAutoComplete = new PointerAutoComplete();
    this.pointerTableResize = new PointerTableResize();
    this.pointerImages = new PointerImages();
    this.pointerDown = new PointerDown();
    this.pointerCursor = new PointerCursor();
    this.pointerHtmlCells = new PointerHtmlCells();
    this.pointerCellMoving = new PointerCellMoving();
    this.pointerTable = new PointerTable();
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
    window.addEventListener('mouseup', this.pointerUpOutsideViewport);
  }

  private visibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      multiplayer.sendMouseMove();
    }
  };

  private pointerLeave = () => {
    multiplayer.sendMouseMove();
  };

  private pointerUpOutsideViewport = (e: MouseEvent) => {
    if (e.target instanceof HTMLElement && !e.target.closest('.pointer-up-ignore')) {
      inlineEditorHandler.close({ skipFocusGrid: true });
      return;
    }
  };

  destroy() {
    const viewport = pixiApp.viewport;
    viewport.off('pointerdown', this.handlePointerDown);
    viewport.off('pointermove', this.pointerMove);
    viewport.off('pointerup', this.pointerUp);
    viewport.off('pointerupoutside', this.pointerUp);
    pixiApp.canvas.removeEventListener('pointerleave', this.pointerLeave);
    window.removeEventListener('blur', this.pointerLeave);
    window.removeEventListener('visibilitychange', this.visibilityChange);
    window.removeEventListener('mouseup', this.pointerUpOutsideViewport);
    this.pointerDown.destroy();
    this.pointerHtmlCells.destroy();
  }

  // check if more than one touch point (let the viewport handle the event)
  private isMoreThanOneTouch(e: FederatedPointerEvent): boolean {
    return ((e.nativeEvent as any)?.touches?.length ?? 0) > 1;
  }

  // todo: this should be removed when the code editor's layout is changed
  private isOverCodeEditor(e: FederatedPointerEvent): boolean {
    const codeEditor = document.getElementById('QuadraticCodeEditorID');
    const overCodeEditor = !!codeEditor?.matches(':hover');
    if (!overCodeEditor) {
      multiplayer.sendMouseMove();
    }
    return overCodeEditor;
  }

  private handlePointerDown = (e: FederatedPointerEvent) => {
    if (this.isMoreThanOneTouch(e)) return;
    const world = pixiApp.viewport.toWorld(e.global);

    // the pointerImage.resizing check is needed so pointerHtmlCells
    // do not interfere with pointerImages when its resizing.
    this.pointerHeading.pointerDown(world, e) ||
      (!this.pointerImages.resizing && this.pointerHtmlCells.pointerDown(e)) ||
      this.pointerImages.pointerDown(world) ||
      this.pointerCellMoving.pointerDown(e) ||
      this.pointerHtmlCells.pointerDown(e) ||
      this.pointerTable.pointerDown(world, e) ||
      this.pointerLink.pointerDown(world, e) ||
      this.pointerAutoComplete.pointerDown(world) ||
      this.pointerTableResize.pointerDown(world) ||
      this.pointerDown.pointerDown(world, e);

    this.updateCursor();
  };

  pointerMove = (e: FederatedPointerEvent) => {
    // ignore pointerMove if the target is a child of an element with class pointer-move-ignore
    const target = e.originalEvent?.target;
    if (target) {
      const isWithinPointerMoveIgnore = target instanceof HTMLElement && !!target.closest('.pointer-move-ignore');
      if (isWithinPointerMoveIgnore) return;
    }

    if (this.isMoreThanOneTouch(e) || this.isOverCodeEditor(e)) return;

    const world = pixiApp.viewport.toWorld(e.global);

    // the pointerImage.resizing check is needed so pointerHtmlCells
    // do not interfere with pointerImages when its resizing.
    (!this.pointerImages.resizing && this.pointerHtmlCells.pointerMove(world, e)) ||
      this.pointerImages.pointerMove(world) ||
      this.pointerCellMoving.pointerMove(world, e) ||
      this.pointerHtmlCells.pointerMove(world, e) ||
      // we need the pointerDown.active and pointerHeading.active check to
      // ensure that when dragging the mouse for selection, we don't call
      // select_table
      (!this.pointerDown.active && !this.pointerHeading.active && this.pointerTable.pointerMove(world)) ||
      this.pointerHeading.pointerMove(world, e) ||
      this.pointerAutoComplete.pointerMove(world) ||
      this.pointerTableResize.pointerMove(world) ||
      this.pointerDown.pointerMove(world, e) ||
      this.pointerCursor.pointerMove(world) ||
      this.pointerLink.pointerMove(world, e);

    this.updateCursor();
  };

  // change the cursor based on pointer priority
  private updateCursor() {
    const cursor =
      this.pointerCellMoving.cursor ??
      this.pointerHtmlCells.cursor ??
      this.pointerImages.cursor ??
      this.pointerHeading.cursor ??
      this.pointerAutoComplete.cursor ??
      this.pointerTableResize.cursor ??
      this.pointerLink.cursor ??
      this.pointerTable.cursor;

    pixiApp.canvas.style.cursor = cursor ?? 'unset';
  }

  private pointerUp = (e: FederatedPointerEvent) => {
    if (this.isMoreThanOneTouch(e)) return;

    this.pointerHtmlCells.pointerUp(e) ||
      this.pointerImages.pointerUp() ||
      this.pointerCellMoving.pointerUp() ||
      this.pointerTable.pointerUp() ||
      this.pointerHeading.pointerUp() ||
      this.pointerAutoComplete.pointerUp() ||
      this.pointerTableResize.pointerUp() ||
      this.pointerDown.pointerUp(e);

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
      this.pointerAutoComplete.handleEscape() ||
      this.pointerTableResize.handleEscape()
    );
  }

  getCursor(): string {
    return this.pointerHeading.cursor || this.pointerAutoComplete.cursor || this.pointerTableResize.cursor || 'default';
  }
}
