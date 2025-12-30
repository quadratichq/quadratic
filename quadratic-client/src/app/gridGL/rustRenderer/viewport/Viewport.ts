/**
 * Viewport - manages camera position and zoom
 *
 * Ported from Rust: quadratic-rust-renderer/src/viewport/viewport.rs
 *
 * This class manages the viewport state on the main thread and syncs it
 * to the Rust renderer via SharedArrayBuffer using the WASM ViewportBufferWriter.
 */

import initRustClient, {
  createViewportBuffer,
  ViewportBufferWriter,
} from '@/app/quadratic-rust-client/quadratic_rust_client';
import { Decelerate, type DecelerateOptions, DEFAULT_DECELERATE_OPTIONS } from './Decelerate';

// Track WASM initialization
let rustClientInitialized = false;
let rustClientInitPromise: Promise<void> | null = null;

async function ensureRustClientInitialized(): Promise<void> {
  if (rustClientInitialized) return;
  if (rustClientInitPromise) return rustClientInitPromise;

  rustClientInitPromise = (async () => {
    await initRustClient();
    rustClientInitialized = true;
    console.log('[Viewport] quadratic-rust-client WASM initialized');
  })();

  return rustClientInitPromise;
}

/** Velocity for snap-back animation (px/ms) */
export const SNAP_BACK_VELOCITY = 1.5;

/** Maximum negative distance allowed before snap-back becomes stronger */
export const SNAP_BACK_MAX_DISTANCE = 200.0;

/** Delay before snap-back starts after zooming (ms) */
export const SNAP_BACK_DELAY = 300.0;

/** Represents the visible area in world coordinates */
export interface VisibleBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Viewport - manages camera position and zoom
 *
 * Designed to run on the main thread and sync to the Rust renderer
 * via SharedArrayBuffer using WASM ViewportBufferWriter.
 */
export class Viewport {
  /** WASM ViewportBufferWriter for writing to SharedArrayBuffer */
  private viewportBuffer: ViewportBufferWriter | null = null;

  /** The SharedArrayBuffer for viewport synchronization */
  private buffer: SharedArrayBuffer | null = null;

  /** Position of the viewport in world coordinates */
  private positionX = 0;
  private positionY = 0;

  /** Scale factor (zoom level) */
  private scaleValue = 1.0;

  /** Device pixel ratio (for high-DPI displays) */
  private dprValue = 1.0;

  /** Size of the viewport in device pixels */
  private sizeWidth = 0;
  private sizeHeight = 0;

  /** Current sheet ID (36-character UUID string) */
  private sheetIdValue = '';

  /** Whether the viewport has changed and needs re-rendering */
  dirty = true;

  /** Minimum allowed scale */
  private minScale = 0.01;

  /** Maximum allowed scale */
  private maxScale = 10.0;

  /** Deceleration plugin for smooth momentum scrolling */
  private decelerate: Decelerate;

  /** Remaining delay before snap-back starts (ms) */
  private snapBackDelayRemaining = 0;

  constructor(width = 0, height = 0, options?: DecelerateOptions) {
    this.sizeWidth = width;
    this.sizeHeight = height;
    this.decelerate = new Decelerate(options ?? DEFAULT_DECELERATE_OPTIONS);
  }

  // =========================================================================
  // SharedArrayBuffer Integration (WASM-based)
  // =========================================================================

  /**
   * Set the SharedArrayBuffer for viewport synchronization.
   * Call this after creating the buffer and before starting rendering.
   */
  setBuffer(buffer: SharedArrayBuffer): void {
    this.buffer = buffer;
    this.viewportBuffer = new ViewportBufferWriter(buffer);
    this.syncToBuffer();
  }

  /**
   * Create and set a new SharedArrayBuffer for viewport synchronization.
   * Returns the buffer for passing to workers.
   * This is async because it needs to initialize the WASM module first.
   */
  async createBuffer(): Promise<SharedArrayBuffer> {
    await ensureRustClientInitialized();
    this.buffer = createViewportBuffer();
    this.viewportBuffer = new ViewportBufferWriter(this.buffer);
    this.syncToBuffer();
    return this.buffer;
  }

  /**
   * Get the SharedArrayBuffer (for passing to the worker).
   */
  getBuffer(): SharedArrayBuffer | null {
    return this.buffer;
  }

  /**
   * Sync viewport state to the SharedArrayBuffer using WASM ping-pong buffering.
   * Called automatically when viewport changes.
   *
   * NOTE: Width and height are sent as device pixels (CSS * dpr) because the
   * Rust renderer uses effective_scale (scale * dpr) for all calculations.
   */
  syncToBuffer(): void {
    if (!this.viewportBuffer) return;

    this.viewportBuffer.writeAll(
      this.positionX,
      this.positionY,
      this.scaleValue,
      this.dprValue,
      this.sizeWidth * this.dprValue, // device pixels
      this.sizeHeight * this.dprValue, // device pixels
      this.dirty,
      this.sheetIdValue
    );
  }

  /**
   * Set the current sheet ID.
   * @param sheetId - 36-character UUID string
   */
  setSheetId(sheetId: string): void {
    if (this.sheetIdValue !== sheetId) {
      this.sheetIdValue = sheetId;
      this.dirty = true;
      this.syncToBuffer();
    }
  }

  /**
   * Get the current sheet ID.
   */
  get sheetId(): string {
    return this.sheetIdValue;
  }

  // =========================================================================
  // Viewport Management
  // =========================================================================

  /**
   * Resize the viewport
   *
   * @param width - Width in CSS pixels (logical pixels)
   * @param height - Height in CSS pixels (logical pixels)
   */
  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.sizeWidth = width;
    this.sizeHeight = height;
    if (Math.abs(this.dprValue - dpr) > 0.001) {
      this.dprValue = dpr;
    }
    this.dirty = true;
    this.syncToBuffer();
  }

  /** Set the device pixel ratio */
  setDpr(dpr: number): void {
    if (Math.abs(this.dprValue - dpr) > 0.001) {
      this.dprValue = dpr;
      this.dirty = true;
      this.syncToBuffer();
    }
  }

  /** Get the device pixel ratio */
  get dpr(): number {
    return this.dprValue;
  }

  /**
   * Pan the viewport by a screen-space delta (in device pixels)
   *
   * Clamps to prevent panning into negative space (x < 0, y < 0).
   * When already in negative space (waiting to snap back), only allows
   * panning that moves back toward the valid bounds.
   */
  pan(dx: number, dy: number): void {
    // Convert screen delta (CSS pixels) to world delta
    // DPR is not needed here since inputs are CSS pixels, not device pixels
    const worldDx = dx / this.scaleValue;
    const worldDy = dy / this.scaleValue;

    // Check if we're in negative space or delay is active
    const inGracePeriod = this.positionX < 0 || this.positionY < 0 || this.snapBackDelayRemaining > 0;

    // Reset snap-back delay during interaction (pauses the snap-back animation)
    if (inGracePeriod) {
      this.snapBackDelayRemaining = SNAP_BACK_DELAY;
    }

    // Calculate new positions
    let newX = this.positionX - worldDx;
    let newY = this.positionY - worldDy;

    // Apply clamping based on current state
    if (this.positionX < 0) {
      // Already in negative X - don't allow going more negative, but allow moving toward 0
      newX = Math.max(this.positionX, Math.min(0, newX));
    } else {
      // Currently positive/zero - don't allow going negative
      newX = Math.max(0, newX);
    }

    if (this.positionY < 0) {
      // Already in negative Y - don't allow going more negative, but allow moving toward 0
      newY = Math.max(this.positionY, Math.min(0, newY));
    } else {
      // Currently positive/zero - don't allow going negative
      newY = Math.max(0, newY);
    }

    this.positionX = newX;
    this.positionY = newY;

    this.dirty = true;
    this.syncToBuffer();
  }

  /**
   * Zoom around a screen-space point (pinch-to-zoom behavior)
   *
   * This implements the pixi-viewport algorithm:
   * 1. Get world position of cursor before zoom
   * 2. Apply zoom
   * 3. Get new screen position of that world point after zoom
   * 4. Move viewport so cursor stays at same world position
   *
   * @param factor - Zoom factor (> 1 to zoom in, < 1 to zoom out)
   * @param centerX - Center X in CSS pixels
   * @param centerY - Center Y in CSS pixels
   */
  zoom(factor: number, centerX: number, centerY: number): void {
    const oldScale = this.scaleValue;
    const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scaleValue * factor));

    if (Math.abs(newScale - oldScale) > Number.EPSILON) {
      // Step 1: Get world position of cursor before zoom
      const worldPoint = this.screenToWorld(centerX, centerY);

      // Step 2: Apply zoom
      this.scaleValue = newScale;

      // Step 3: Get new screen position of that world point after zoom
      const newScreen = this.worldToScreen(worldPoint.x, worldPoint.y);

      // Step 4: Move viewport so cursor stays at same world position
      // Use just scale since inputs are CSS pixels
      const dx = (centerX - newScreen.x) / this.scaleValue;
      const dy = (centerY - newScreen.y) / this.scaleValue;
      this.positionX -= dx;
      this.positionY -= dy;

      // Reset snap-back delay when zooming into negative space
      if (this.positionX < 0 || this.positionY < 0) {
        this.snapBackDelayRemaining = SNAP_BACK_DELAY;
      }

      this.dirty = true;
      this.syncToBuffer();
    }
  }

  /** Convert screen coordinates (CSS pixels) to world coordinates */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    // Use just scale since inputs are CSS pixels, not device pixels
    return {
      x: this.positionX + screenX / this.scaleValue,
      y: this.positionY + screenY / this.scaleValue,
    };
  }

  /** Convert world coordinates to screen coordinates (CSS pixels) */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    // Use just scale since outputs are CSS pixels, not device pixels
    return {
      x: (worldX - this.positionX) * this.scaleValue,
      y: (worldY - this.positionY) * this.scaleValue,
    };
  }

  /** Get the visible bounds in world coordinates */
  getVisibleBounds(): VisibleBounds {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(this.sizeWidth, this.sizeHeight);

    return {
      left: topLeft.x,
      top: topLeft.y,
      right: bottomRight.x,
      bottom: bottomRight.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  /** Set the viewport position directly */
  setPosition(x: number, y: number): void {
    this.positionX = x;
    this.positionY = y;
    this.dirty = true;
    this.syncToBuffer();
  }

  /** Get the current user-visible scale (zoom level) */
  get scale(): number {
    return this.scaleValue;
  }

  /**
   * Get the effective rendering scale (scale * dpr).
   * This is used by the Rust renderer for device-pixel operations.
   * TypeScript code should typically use just `scale` for CSS pixel math.
   */
  get effectiveScale(): number {
    return this.scaleValue * this.dprValue;
  }

  /** Set the scale directly */
  setScale(scale: number): void {
    this.scaleValue = Math.min(this.maxScale, Math.max(this.minScale, scale));
    this.dirty = true;
    this.syncToBuffer();
  }

  /** Get the X position */
  get x(): number {
    return this.positionX;
  }

  /** Get the Y position */
  get y(): number {
    return this.positionY;
  }

  /** Get the viewport width in screen pixels */
  get width(): number {
    return this.sizeWidth;
  }

  /** Get the viewport height in screen pixels */
  get height(): number {
    return this.sizeHeight;
  }

  /** Mark the viewport as clean (after rendering) */
  markClean(): void {
    this.dirty = false;
    this.syncToBuffer();
  }

  // =========================================================================
  // Deceleration (momentum scrolling)
  // =========================================================================

  /** Check if deceleration is currently active */
  isDecelerating(): boolean {
    return this.decelerate.isActive();
  }

  /** Called when drag/pan starts - stops any active deceleration */
  onDragStart(): void {
    this.decelerate.onDown();

    // Reset snap-back delay if we're in negative space or delay is active
    // (keeps timeout paused during interaction)
    if (this.positionX < 0 || this.positionY < 0 || this.snapBackDelayRemaining > 0) {
      this.snapBackDelayRemaining = SNAP_BACK_DELAY;
    }
  }

  /**
   * Called during drag/pan - records position for velocity calculation
   * @param time - Current time in milliseconds (e.g., from performance.now())
   */
  onDragMove(time: number): void {
    this.decelerate.onMove(this.positionX, this.positionY, time);

    // Reset snap-back delay if we're in negative space or delay is active
    // (keeps timeout paused during interaction)
    if (this.positionX < 0 || this.positionY < 0 || this.snapBackDelayRemaining > 0) {
      this.snapBackDelayRemaining = SNAP_BACK_DELAY;
    }
  }

  /**
   * Called when drag/pan ends - calculates velocity and starts deceleration
   * @param time - Current time in milliseconds
   */
  onDragEnd(time: number): void {
    this.decelerate.onUp(this.positionX, this.positionY, time);
  }

  /** Called on wheel event - stops deceleration and resets snap-back delay */
  onWheel(): void {
    this.decelerate.onWheel();

    // Reset snap-back delay if we're in negative space or delay is active
    // (keeps timeout paused during interaction)
    if (this.positionX < 0 || this.positionY < 0 || this.snapBackDelayRemaining > 0) {
      this.snapBackDelayRemaining = SNAP_BACK_DELAY;
    }
  }

  /**
   * Update deceleration and apply velocity to viewport
   *
   * Call this each frame to apply momentum scrolling.
   * Also handles snap-back when viewport is in negative space (after zoom).
   *
   * @param elapsed - Time elapsed since last update in milliseconds
   * @returns true if the viewport was moved by deceleration or snap-back
   */
  updateDecelerate(elapsed: number): boolean {
    let moved = false;

    // Apply regular deceleration with clamping
    const delta = this.decelerate.update(elapsed);
    if (delta) {
      const prevX = this.positionX;
      const prevY = this.positionY;

      this.positionX += delta.x;
      this.positionY += delta.y;

      // Clamp to prevent going negative during deceleration
      this.positionX = Math.max(0, this.positionX);
      this.positionY = Math.max(0, this.positionY);

      // Check if we actually moved (not clamped)
      const actuallyMovedX = Math.abs(this.positionX - prevX) > 0.01;
      const actuallyMovedY = Math.abs(this.positionY - prevY) > 0.01;

      // If clamped in a direction, stop deceleration in that direction
      if (!actuallyMovedX && !actuallyMovedY) {
        // Completely clamped - stop deceleration entirely
        this.decelerate.reset();
      } else if (!actuallyMovedX) {
        // Clamped in X only - stop X velocity
        this.decelerate.activateX(0);
      } else if (!actuallyMovedY) {
        // Clamped in Y only - stop Y velocity
        this.decelerate.activateY(0);
      }

      if (actuallyMovedX || actuallyMovedY) {
        this.dirty = true;
        moved = true;
      }
    }

    // Update snap-back delay countdown
    if (this.snapBackDelayRemaining > 0) {
      this.snapBackDelayRemaining = Math.max(0, this.snapBackDelayRemaining - elapsed);
    }

    // Check for snap-back when not actively decelerating and delay has expired
    if (!this.decelerate.isActive() && this.snapBackDelayRemaining <= 0) {
      moved = this.applySnapBack(elapsed) || moved;
    }

    if (moved) {
      this.syncToBuffer();
    }

    return moved;
  }

  /** Apply snap-back animation when viewport is in negative space */
  private applySnapBack(elapsed: number): boolean {
    let moved = false;

    // Snap back X if in negative space
    if (this.positionX < 0) {
      const distance = -this.positionX;
      const speed = Math.max(distance / SNAP_BACK_MAX_DISTANCE, 0.3) * SNAP_BACK_VELOCITY;
      const delta = speed * elapsed;

      if (delta >= distance) {
        this.positionX = 0;
      } else {
        this.positionX += delta;
      }
      this.dirty = true;
      moved = true;
    }

    // Snap back Y if in negative space
    if (this.positionY < 0) {
      const distance = -this.positionY;
      const speed = Math.max(distance / SNAP_BACK_MAX_DISTANCE, 0.3) * SNAP_BACK_VELOCITY;
      const delta = speed * elapsed;

      if (delta >= distance) {
        this.positionY = 0;
      } else {
        this.positionY += delta;
      }
      this.dirty = true;
      moved = true;
    }

    return moved;
  }

  /** Check if snap-back animation is active */
  isSnappingBack(): boolean {
    return this.positionX < 0 || this.positionY < 0;
  }

  /**
   * Manually activate deceleration with a specific velocity
   * @param vx - X velocity in px/ms
   * @param vy - Y velocity in px/ms
   */
  activateDecelerate(vx: number, vy: number): void {
    this.decelerate.activate(vx, vy);
  }

  /** Manually activate horizontal deceleration */
  activateDecelerateX(vx: number): void {
    this.decelerate.activateX(vx);
  }

  /** Manually activate vertical deceleration */
  activateDecelerateY(vy: number): void {
    this.decelerate.activateY(vy);
  }

  /** Reset/stop deceleration */
  resetDecelerate(): void {
    this.decelerate.reset();
  }

  /** Pause deceleration */
  pauseDecelerate(): void {
    this.decelerate.pause();
  }

  /** Resume deceleration */
  resumeDecelerate(): void {
    this.decelerate.resume();
  }

  /** Free WASM resources when done with the viewport */
  dispose(): void {
    if (this.viewportBuffer) {
      this.viewportBuffer.free();
      this.viewportBuffer = null;
    }
    this.buffer = null;
  }
}
