/**
 * Quadratic Rust Renderer - Worker Script
 *
 * This script runs in a Web Worker and handles all rendering.
 * It receives an OffscreenCanvas from the main thread and uses
 * the Rust/WASM renderer to draw to it.
 */

import init, { WorkerRenderer } from '../pkg/quadratic_rust_renderer.js';

// Message types from main thread
interface InitMessage {
  type: 'init';
  canvas: OffscreenCanvas;
}

interface ResizeMessage {
  type: 'resize';
  width: number;
  height: number;
}

interface PanMessage {
  type: 'pan';
  dx: number;
  dy: number;
  time: number;
}

interface ZoomMessage {
  type: 'zoom';
  factor: number;
  centerX: number;
  centerY: number;
}

interface DragStartMessage {
  type: 'dragStart';
}

interface DragEndMessage {
  type: 'dragEnd';
  time: number;
}

interface SetViewportMessage {
  type: 'setViewport';
  x: number;
  y: number;
  scale: number;
}

interface SetCursorMessage {
  type: 'setCursor';
  col: number;
  row: number;
}

interface SetCursorSelectionMessage {
  type: 'setCursorSelection';
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

interface AddFontMessage {
  type: 'addFont';
  fontJson: string;
  fontName?: string;
}

interface UploadFontTextureMessage {
  type: 'uploadFontTexture';
  textureUid: number;
  bitmap: ImageBitmap;
}

interface AddLabelMessage {
  type: 'addLabel';
  text: string;
  cellX: number;
  cellY: number;
  cellWidth: number;
  cellHeight: number;
}

interface AddStyledLabelMessage {
  type: 'addStyledLabel';
  text: string;
  cellX: number;
  cellY: number;
  cellWidth: number;
  cellHeight: number;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  colorR?: number;
  colorG?: number;
  colorB?: number;
  align?: number;
  valign?: number;
}

interface ClearLabelsMessage {
  type: 'clearLabels';
}

interface GetNeededHashesMessage {
  type: 'getNeededHashes';
}

interface GetOffscreenHashesMessage {
  type: 'getOffscreenHashes';
}

interface RemoveHashMessage {
  type: 'removeHash';
  hashX: number;
  hashY: number;
}

interface HasHashMessage {
  type: 'hasHash';
  hashX: number;
  hashY: number;
}

interface GetHashCountMessage {
  type: 'getHashCount';
}

interface GetStatsMessage {
  type: 'getStats';
}

interface GetVisibleHashBoundsMessage {
  type: 'getVisibleHashBounds';
}

interface ToggleFpsMessage {
  type: 'toggleFps';
  enabled: boolean;
}

interface StopMessage {
  type: 'stop';
}

interface SetShowHeadingsMessage {
  type: 'setShowHeadings';
  show: boolean;
}

interface SetSelectedColumnsMessage {
  type: 'setSelectedColumns';
  selections: number[]; // [start1, end1, start2, end2, ...]
}

interface SetSelectedRowsMessage {
  type: 'setSelectedRows';
  selections: number[]; // [start1, end1, start2, end2, ...]
}

interface GetHeadingSizeMessage {
  type: 'getHeadingSize';
}

interface SetHeadingsDprMessage {
  type: 'setHeadingsDpr';
  dpr: number;
}

type WorkerMessage =
  | InitMessage
  | ResizeMessage
  | PanMessage
  | ZoomMessage
  | DragStartMessage
  | DragEndMessage
  | SetViewportMessage
  | SetCursorMessage
  | SetCursorSelectionMessage
  | AddFontMessage
  | UploadFontTextureMessage
  | AddLabelMessage
  | AddStyledLabelMessage
  | ClearLabelsMessage
  | GetNeededHashesMessage
  | GetOffscreenHashesMessage
  | RemoveHashMessage
  | HasHashMessage
  | GetHashCountMessage
  | GetStatsMessage
  | GetVisibleHashBoundsMessage
  | ToggleFpsMessage
  | StopMessage
  | SetShowHeadingsMessage
  | SetSelectedColumnsMessage
  | SetSelectedRowsMessage
  | GetHeadingSizeMessage
  | SetHeadingsDprMessage;

let renderer: WorkerRenderer | null = null;
let animationFrameId: number | null = null;

// FPS tracking
let fpsEnabled = false;
let frameCount = 0;
let lastFpsTime = performance.now();
let frameTimeSum = 0;
let lastFrameTime = performance.now();

// Frame timing for deceleration
let lastRenderTime = performance.now();

// Render status tracking
let lastRenderStatus = false;

/**
 * Main render loop
 */
function renderLoop(): void {
  if (renderer && renderer.is_running()) {
    const now = performance.now();
    const elapsed = now - lastRenderTime;
    lastRenderTime = now;

    // Pass elapsed time for deceleration - frame() now returns whether it rendered
    const didRender = renderer.frame(elapsed);

    // Send render status update if it changed
    if (didRender !== lastRenderStatus) {
      lastRenderStatus = didRender;
      self.postMessage({ type: 'renderStatus', rendering: didRender });
    }

    // Notify main thread if viewport moved due to deceleration
    if (renderer.is_decelerating()) {
      self.postMessage({ type: 'viewportMoved' });
    }

    // FPS tracking
    if (fpsEnabled) {
      const frameTime = now - lastFrameTime;
      lastFrameTime = now;
      frameTimeSum += frameTime;
      frameCount++;

      // Update FPS every 500ms
      if (now - lastFpsTime >= 500) {
        const currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
        const avgFrameTime = frameTimeSum / frameCount;

        self.postMessage({
          type: 'fps',
          fps: currentFps,
          frameTime: avgFrameTime.toFixed(2),
          rendering: lastRenderStatus,
          zoom: renderer.get_scale(),
        });

        frameCount = 0;
        frameTimeSum = 0;
        lastFpsTime = now;
      }
    }
  }
  animationFrameId = requestAnimationFrame(renderLoop);
}

/**
 * Handle messages from the main thread
 */
self.onmessage = async (e: MessageEvent<WorkerMessage>): Promise<void> => {
  const data = e.data;

  switch (data.type) {
    case 'init':
      try {
        // Initialize WASM module
        await init();

        // Create renderer with the transferred OffscreenCanvas
        renderer = new WorkerRenderer(data.canvas);
        renderer.start();

        // Start render loop
        renderLoop();

        self.postMessage({ type: 'ready' });
      } catch (error) {
        self.postMessage({ type: 'error', message: String(error) });
      }
      break;

    case 'resize':
      if (renderer) {
        renderer.resize(data.width, data.height);
        // Render immediately after resize to prevent black flash
        renderer.frame(0);
      }
      break;

    case 'pan':
      if (renderer) {
        renderer.pan(data.dx, data.dy);
        // Record position for deceleration velocity calculation
        renderer.on_drag_move(data.time);
      }
      break;

    case 'zoom':
      if (renderer) {
        renderer.zoom(data.factor, data.centerX, data.centerY);
        // Wheel zoom should stop deceleration
        renderer.on_wheel_event();
      }
      break;

    case 'dragStart':
      if (renderer) {
        renderer.on_drag_start();
      }
      break;

    case 'dragEnd':
      if (renderer) {
        renderer.on_drag_end(data.time);
      }
      break;

    case 'setViewport':
      if (renderer) {
        renderer.set_viewport(data.x, data.y, data.scale);
      }
      break;

    case 'setCursor':
      if (renderer) {
        renderer.set_cursor(BigInt(data.col), BigInt(data.row));
      }
      break;

    case 'setCursorSelection':
      if (renderer) {
        renderer.set_cursor_selection(
          BigInt(data.startCol),
          BigInt(data.startRow),
          BigInt(data.endCol),
          BigInt(data.endRow)
        );
      }
      break;

    case 'addFont':
      if (renderer) {
        try {
          renderer.add_font(data.fontJson);
          self.postMessage({ type: 'fontAdded', font: data.fontName });
        } catch (error) {
          self.postMessage({
            type: 'error',
            message: `Failed to add font: ${error}`,
          });
        }
      }
      break;

    case 'uploadFontTexture':
      // Receive ImageBitmap and upload as texture
      if (renderer && data.bitmap) {
        try {
          // Convert ImageBitmap to ImageData via OffscreenCanvas
          const canvas = new OffscreenCanvas(data.bitmap.width, data.bitmap.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Failed to get 2d context');
          }
          ctx.drawImage(data.bitmap, 0, 0);
          const imageData = ctx.getImageData(0, 0, data.bitmap.width, data.bitmap.height);

          // Upload to the renderer (convert Uint8ClampedArray to Uint8Array)
          renderer.upload_font_texture_from_data(
            data.textureUid,
            data.bitmap.width,
            data.bitmap.height,
            new Uint8Array(imageData.data.buffer)
          );

          self.postMessage({ type: 'textureUploaded', textureUid: data.textureUid });
        } catch (error) {
          console.error('Failed to upload texture:', error);
          self.postMessage({
            type: 'error',
            message: `Failed to upload texture: ${error}`,
          });
        }
      }
      break;

    case 'addLabel':
      if (renderer) {
        renderer.add_label(data.text, data.cellX, data.cellY, data.cellWidth, data.cellHeight);
      }
      break;

    case 'addStyledLabel':
      if (renderer) {
        renderer.add_styled_label(
          data.text,
          data.cellX,
          data.cellY,
          data.cellWidth,
          data.cellHeight,
          data.fontSize ?? 14,
          data.bold ?? false,
          data.italic ?? false,
          data.colorR ?? 0,
          data.colorG ?? 0,
          data.colorB ?? 0,
          data.align ?? 0,
          data.valign ?? 2
        );
      }
      break;

    case 'clearLabels':
      if (renderer) {
        renderer.clear_labels();
      }
      break;

    // =========================================================================
    // Lazy Loading API
    // =========================================================================

    case 'getNeededHashes':
      // Get list of hashes that need to be loaded for current viewport
      if (renderer) {
        const needed = renderer.get_needed_hashes();
        self.postMessage({
          type: 'neededHashes',
          hashes: Array.from(needed), // [hash_x, hash_y, hash_x, hash_y, ...]
        });
      }
      break;

    case 'getOffscreenHashes':
      // Get list of hashes that are offscreen and can be unloaded
      if (renderer) {
        const offscreen = renderer.get_offscreen_hashes();
        self.postMessage({
          type: 'offscreenHashes',
          hashes: Array.from(offscreen), // [hash_x, hash_y, hash_x, hash_y, ...]
        });
      }
      break;

    case 'removeHash':
      // Remove a hash from memory (when it goes offscreen)
      if (renderer) {
        renderer.remove_hash(data.hashX, data.hashY);
      }
      break;

    case 'hasHash':
      // Check if a hash is loaded
      if (renderer) {
        const loaded = renderer.has_hash(data.hashX, data.hashY);
        self.postMessage({
          type: 'hashStatus',
          hashX: data.hashX,
          hashY: data.hashY,
          loaded,
        });
      }
      break;

    case 'getHashCount':
      // Get number of loaded hashes
      if (renderer) {
        self.postMessage({
          type: 'hashCount',
          count: renderer.get_hash_count(),
        });
      }
      break;

    case 'getStats':
      // Get hash and label counts from Rust (source of truth)
      if (renderer) {
        self.postMessage({
          type: 'stats',
          hashCount: renderer.get_hash_count(),
          labelCount: renderer.get_label_count(),
          spriteCount: renderer.get_sprite_count(),
          spriteMemoryBytes: renderer.get_sprite_memory_bytes(),
        });
      }
      break;

    case 'getVisibleHashBounds':
      // Get the current visible hash bounds
      if (renderer) {
        const bounds = renderer.get_visible_hash_bounds();
        self.postMessage({
          type: 'visibleHashBounds',
          minHashX: bounds[0],
          maxHashX: bounds[1],
          minHashY: bounds[2],
          maxHashY: bounds[3],
        });
      }
      break;

    case 'toggleFps':
      fpsEnabled = data.enabled;
      if (fpsEnabled) {
        lastFpsTime = performance.now();
        lastFrameTime = performance.now();
        frameCount = 0;
        frameTimeSum = 0;
      }
      break;

    case 'stop':
      if (renderer) {
        renderer.stop();
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      break;

    // =========================================================================
    // Grid Headings
    // =========================================================================

    case 'setShowHeadings':
      if (renderer) {
        renderer.set_show_headings(data.show);
      }
      break;

    case 'setSelectedColumns':
      if (renderer) {
        renderer.set_selected_columns(new Int32Array(data.selections));
      }
      break;

    case 'setSelectedRows':
      if (renderer) {
        renderer.set_selected_rows(new Int32Array(data.selections));
      }
      break;

    case 'getHeadingSize':
      if (renderer) {
        self.postMessage({
          type: 'headingSize',
          width: renderer.get_heading_width(),
          height: renderer.get_heading_height(),
        });
      }
      break;

    case 'setHeadingsDpr':
      if (renderer) {
        renderer.set_headings_dpr(data.dpr);
      }
      break;

    default:
      console.warn('[RenderWorker] Unknown message type:', (data as { type: string }).type);
  }
};

// Handle errors
self.onerror = (error): void => {
  console.error('[RenderWorker] Error:', error);
  self.postMessage({ type: 'error', message: String(error) });
};
