import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { sheetHashHeight, sheetHashWidth } from '@/app/gridGL/cells/CellsTypes';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { convertColorStringToTint, getCSSVariableTint } from '@/app/helpers/convertColor';
import type {
  JsCoordinate,
  JsHashesDirty,
  JsHashRenderFills,
  JsRenderCodeCell,
  JsRenderFill,
  JsSheetFill,
} from '@/app/quadratic-core-types';
import { fromUint8Array } from '@/app/shared/utils/Uint8Array';
import { colors } from '@/app/theme/colors';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Container, Graphics, ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';

interface SpriteBounds extends Sprite {
  viewBounds: Rectangle;
}

// TODO: (jimniels) this doesn't match the table header and also doesn't match
// the theme. The problem here is that a table cell might have a background
// of orange, which is why this is a solid color with lightened opacity.
// We should figure out how to make this better match the theme and light/dark mode
const ALTERNATING_BG_OPACITY = 0.035;
const ALTERNATING_BG_COLOR = getCSSVariableTint('text');

// Number of hashes to load outside the viewport in each direction
const VIEWPORT_PADDING = 2;

export class CellsFills extends Container {
  private cellsSheet: CellsSheet;
  // Map of hash key (e.g., "0,0") to fills in that hash
  private fillsByHash: Map<string, JsRenderFill[]> = new Map();

  // Track which hashes we've requested fills for
  private loadedHashes: Set<string> = new Set();

  // Track the last viewport hash bounds to detect changes
  private lastViewportHashBounds?: { minX: number; maxX: number; minY: number; maxY: number };

  private sheetFills?: JsSheetFill[];
  private metaFillsLoaded = false;
  private alternatingColorsGraphics: Graphics;

  private cellsContainer: ParticleContainer;
  private meta: Graphics;
  private alternatingColors: Map<string, JsRenderCodeCell> = new Map();
  private debugGraphics: Graphics;

  private dirty = false;
  private dirtyTables = false;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.meta = this.addChild(new Graphics());
    this.cellsContainer = this.addChild(
      new ParticleContainer(undefined, { vertices: true, tint: true }, undefined, true)
    );
    this.alternatingColorsGraphics = this.addChild(new Graphics());
    this.debugGraphics = this.addChild(new Graphics());

    events.on('hashRenderFills', this.handleHashRenderFills);
    events.on('hashesDirtyFills', this.handleHashesDirtyFills);
    events.on('sheetMetaFills', this.handleSheetMetaFills);
    events.on('sheetConditionalFormats', this.handleSheetConditionalFormats);
    events.on('sheetOffsetsUpdated', this.drawSheetCells);
    events.on('cursorPosition', this.setDirty);
    events.on('resizeHeadingColumn', this.drawCells);
    events.on('resizeHeadingColumn', this.drawSheetCells);
    events.on('resizeHeadingColumn', this.drawSheetMeta);
    events.on('resizeHeadingRow', this.drawCells);
    events.on('resizeHeadingRow', this.drawSheetCells);
    events.on('resizeHeadingRow', this.drawSheetMeta);
  }

  destroy() {
    events.off('hashRenderFills', this.handleHashRenderFills);
    events.off('hashesDirtyFills', this.handleHashesDirtyFills);
    events.off('sheetMetaFills', this.handleSheetMetaFills);
    events.off('sheetConditionalFormats', this.handleSheetConditionalFormats);
    events.off('sheetOffsetsUpdated', this.drawSheetCells);
    events.off('cursorPosition', this.setDirty);
    events.off('resizeHeadingColumn', this.drawCells);
    events.off('resizeHeadingColumn', this.drawSheetCells);
    events.off('resizeHeadingColumn', this.drawSheetMeta);
    events.off('resizeHeadingRow', this.drawCells);
    events.off('resizeHeadingRow', this.drawSheetCells);
    events.off('resizeHeadingRow', this.drawSheetMeta);
    super.destroy();
  }

  private handleHashRenderFills = (hashRenderFillsData: Uint8Array) => {
    const hashRenderFillsArray = fromUint8Array<JsHashRenderFills[]>(hashRenderFillsData);
    let needsRedraw = false;

    for (const { sheet_id, hash, fills } of hashRenderFillsArray) {
      if (sheet_id.id === this.cellsSheet.sheetId) {
        const key = `${hash.x},${hash.y}`;
        const alreadyHad = this.fillsByHash.has(key);
        if (fills.length === 0) {
          this.fillsByHash.delete(key);
          if (debugFlag('debugShowCellHashesInfo')) {
            console.log(
              `[CellsFills] received empty fills for hash (${hash.x},${hash.y})${alreadyHad ? ' (DUPLICATE)' : ''}`
            );
          }
        } else {
          this.fillsByHash.set(key, fills);
          if (debugFlag('debugShowCellHashesInfo')) {
            console.log(
              `[CellsFills] received ${fills.length} fills for hash (${hash.x},${hash.y})${alreadyHad ? ' (DUPLICATE)' : ''}`
            );
          }
        }
        needsRedraw = true;
      }
    }

    if (needsRedraw) {
      this.drawCells();
    }
  };

  // Handle dirty fill hashes that are outside the viewport
  // These will be requested when they enter the viewport
  private handleHashesDirtyFills = (dirtyHashesData: Uint8Array) => {
    const dirtyHashesArray = fromUint8Array<JsHashesDirty[]>(dirtyHashesData);

    for (const { sheet_id, hashes } of dirtyHashesArray) {
      if (sheet_id.id === this.cellsSheet.sheetId) {
        for (const hash of hashes) {
          const key = `${hash.x},${hash.y}`;
          // Clear the loaded flag so we'll request it when it enters viewport
          this.loadedHashes.delete(key);
          // Clear stale data to prevent rendering outdated fills
          this.fillsByHash.delete(key);
        }
      }
    }
  };

  private handleSheetMetaFills = (sheetId: string, fills: JsSheetFill[]) => {
    if (sheetId === this.cellsSheet.sheetId) {
      if (fills.length === 0) {
        this.sheetFills = undefined;
        this.meta.clear();
        pixiApp.setViewportDirty();
      } else {
        this.sheetFills = fills;
        this.setDirty();
      }
    }
  };

  // When conditional formats change, clear all cached fills and re-request them.
  // This is necessary because conditional format changes (like apply_to_blank)
  // can affect cells outside the data bounds that the server doesn't know to
  // mark as dirty.
  private handleSheetConditionalFormats = (sheetId: string) => {
    if (sheetId === this.cellsSheet.sheetId) {
      // Clear all cached fills and loaded flags
      this.fillsByHash.clear();
      this.loadedHashes.clear();
      this.lastViewportHashBounds = undefined;
      // Re-request hashes for the current viewport (needed for blank cells
      // that may now have fills due to apply_to_blank option)
      this.updateViewportHashes();
    }
  };

  setDirty = () => {
    this.dirty = true;
  };

  cheapCull = (viewBounds: Rectangle) => {
    let visibleCount = 0;
    this.cellsContainer.children.forEach((sprite) => {
      sprite.visible = intersects.rectangleRectangle(viewBounds, (sprite as SpriteBounds).viewBounds);
      if (sprite.visible) visibleCount++;
    });
    if (debugFlag('debugShowCellHashesInfo')) {
      console.log(
        `[CellsFills] visible: ${visibleCount}/${this.cellsContainer.children.length} fills (${this.fillsByHash.size} hashes in memory)`
      );
    }
  };

  private getColor(color: string): number {
    if (color === 'blank') {
      return colors.gridBackground;
    } else {
      return convertColorStringToTint(color);
    }
  }

  private get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsFills.sheet`);
    return sheet;
  }

  private drawCells = () => {
    this.cellsContainer.removeChildren();
    this.debugGraphics.clear();
    const showDebug = debugFlag('debugShowCellHashesInfo');
    let totalFills = 0;
    this.fillsByHash.forEach((fills) => {
      totalFills += fills.length;
      fills.forEach((fill) => {
        const sprite = this.cellsContainer.addChild(new Sprite(Texture.WHITE)) as SpriteBounds;
        sprite.tint = this.getColor(fill.color);
        const screen = this.sheet.getScreenRectangle(Number(fill.x), Number(fill.y), fill.w, fill.h);
        sprite.position.set(screen.x, screen.y);
        sprite.width = screen.width;
        sprite.height = screen.height;
        sprite.viewBounds = new Rectangle(screen.x, screen.y, screen.width + 1, screen.height + 1);

        // Draw debug outline around each fill
        if (showDebug) {
          this.debugGraphics.lineStyle(2, 0xff0000, 1);
          this.debugGraphics.drawRect(screen.x, screen.y, screen.width, screen.height);
        }
      });
    });
    if (showDebug) {
      console.log(`[CellsFills] rendering ${totalFills} fills from ${this.fillsByHash.size} hashes`);
    }
    pixiApp.setViewportDirty();
  };

  private drawSheetCells = (sheetId: string) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.drawCells();
    }
  };

  private drawSheetMeta = (sheetId: string) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.drawMeta();
    }
  };

  update = (dirtyViewport: boolean) => {
    // Load meta fills on first update
    if (!this.metaFillsLoaded) {
      this.metaFillsLoaded = true;
      quadraticCore.getSheetMetaFills(this.cellsSheet.sheetId);
    }

    // Handle viewport-based hash loading
    if (dirtyViewport) {
      this.updateViewportHashes();
    }

    if (dirtyViewport || this.dirty) {
      this.dirty = false;
      this.drawMeta();
    }
    if (this.dirtyTables) {
      this.dirtyTables = false;
      this.drawAlternatingColors();
    }
  };

  // Calculate which hashes are in/near the viewport and load/unload as needed
  private updateViewportHashes = () => {
    const viewport = pixiApp.viewport.getVisibleBounds();

    // Get the cell coordinates at viewport corners
    const topLeft = this.sheet.getColumnRowFromScreen(viewport.left, viewport.top);
    const bottomRight = this.sheet.getColumnRowFromScreen(viewport.right, viewport.bottom);

    // Calculate hash coordinates with padding (clamped to non-negative since there's no content in negative hashes)
    const minHashX = Math.max(0, Math.floor(topLeft.column / sheetHashWidth) - VIEWPORT_PADDING);
    const maxHashX = Math.floor(bottomRight.column / sheetHashWidth) + VIEWPORT_PADDING;
    const minHashY = Math.max(0, Math.floor(topLeft.row / sheetHashHeight) - VIEWPORT_PADDING);
    const maxHashY = Math.floor(bottomRight.row / sheetHashHeight) + VIEWPORT_PADDING;

    // Check if viewport hash bounds changed
    if (
      this.lastViewportHashBounds &&
      this.lastViewportHashBounds.minX === minHashX &&
      this.lastViewportHashBounds.maxX === maxHashX &&
      this.lastViewportHashBounds.minY === minHashY &&
      this.lastViewportHashBounds.maxY === maxHashY
    ) {
      return; // No change
    }

    this.lastViewportHashBounds = { minX: minHashX, maxX: maxHashX, minY: minHashY, maxY: maxHashY };

    // Find hashes that need to be loaded
    const hashesToLoad: JsCoordinate[] = [];
    const activeHashes = new Set<string>();

    for (let hashX = minHashX; hashX <= maxHashX; hashX++) {
      for (let hashY = minHashY; hashY <= maxHashY; hashY++) {
        const key = `${hashX},${hashY}`;
        activeHashes.add(key);

        if (!this.loadedHashes.has(key)) {
          hashesToLoad.push({ x: hashX, y: hashY });
          this.loadedHashes.add(key);
        }
      }
    }

    // Request fills for new hashes
    if (hashesToLoad.length > 0) {
      if (debugFlag('debugShowCellHashesInfo')) {
        console.log(
          `[CellsFills] loading ${hashesToLoad.length} fill hashes: ${hashesToLoad.map((h) => `(${h.x},${h.y})`).join(', ')}`
        );
      }
      quadraticCore.getRenderFillsForHashes(this.cellsSheet.sheetId, hashesToLoad);
    }

    // Unload hashes that are no longer in viewport + padding
    const hashesToUnload: string[] = [];
    for (const key of this.loadedHashes) {
      if (!activeHashes.has(key)) {
        hashesToUnload.push(key);
      }
    }

    for (const key of hashesToUnload) {
      this.loadedHashes.delete(key);
      this.fillsByHash.delete(key);
    }

    // Redraw if we unloaded any hashes
    if (hashesToUnload.length > 0) {
      if (debugFlag('debugShowCellHashesInfo')) {
        console.log(`[CellsFills] unloading ${hashesToUnload.length} fill hashes: ${hashesToUnload.join(', ')}`);
      }
      this.drawCells();
    }
  };

  private drawMeta = () => {
    if (this.sheetFills) {
      this.meta.clear();
      const viewport = pixiApp.viewport.getVisibleBounds();
      this.sheetFills.forEach((fill) => {
        const offset = this.sheet.getCellOffsets(fill.x, fill.y);
        if (offset.x > viewport.right || offset.y > viewport.bottom) return;

        // infinite sheet
        if (fill.w == null && fill.h == null) {
          this.meta.beginFill(this.getColor(fill.color));
          const x = Math.max(offset.x, viewport.left);
          const y = Math.max(offset.y, viewport.top);
          this.meta.drawRect(
            x,
            y,
            viewport.width - (offset.x - viewport.left),
            viewport.height - (offset.y - viewport.top)
          );
          this.meta.endFill();
        }

        // infinite column
        else if (fill.h == null && fill.w != null) {
          this.meta.beginFill(this.getColor(fill.color));
          const startX = Math.max(offset.x, viewport.left);
          const startY = Math.max(offset.y, viewport.top);
          const end = this.sheet.offsets.getColumnPlacement(Number(fill.x) + Number(fill.w));
          let endX = end.position;
          endX = Math.min(endX, viewport.right);
          this.meta.drawRect(startX, startY, endX - startX, viewport.height - (startY - viewport.top));
          this.meta.endFill();
        }

        // infinite row
        else if (fill.w == null && fill.h != null) {
          this.meta.beginFill(this.getColor(fill.color));
          const startX = Math.max(offset.x, viewport.left);
          const startY = Math.max(offset.y, viewport.top);
          const end = this.sheet.offsets.getRowPlacement(Number(fill.y) + Number(fill.h));
          let endY = end.position;
          endY = Math.min(endY, viewport.bottom);
          this.meta.drawRect(startX, startY, viewport.width - (startX - viewport.left), endY - startY);
          this.meta.endFill();
        }
      });
      pixiApp.setViewportDirty();
    }
  };

  // this is called by Table.ts
  updateAlternatingColors = (x: number, y: number, table?: JsRenderCodeCell) => {
    const key = `${x},${y}`;
    if (table && table.h > 1 && table.alternating_colors && !table.is_html_image) {
      this.alternatingColors.set(key, table);
      this.dirtyTables = true;
    } else {
      if (this.alternatingColors.has(key)) {
        this.alternatingColors.delete(key);
        this.dirtyTables = true;
      }
    }
  };

  private drawAlternatingColors = () => {
    this.alternatingColorsGraphics.clear();
    this.alternatingColors.forEach((table) => {
      const bounds = this.sheet.getScreenRectangle(table.x, table.y, table.w, table.y);
      let yOffset = bounds.y;
      for (let y = 0; y < table.h; y++) {
        let height = this.sheet.offsets.getRowHeight(y + table.y);
        if (y % 2 !== (table.show_name !== table.show_columns ? 1 : 0)) {
          this.alternatingColorsGraphics.beginFill(ALTERNATING_BG_COLOR, ALTERNATING_BG_OPACITY);
          this.alternatingColorsGraphics.drawRect(bounds.x, yOffset, bounds.width, height);
          this.alternatingColorsGraphics.endFill();
        }
        yOffset += height;
      }
    });
    pixiApp.setViewportDirty();
  };
}
