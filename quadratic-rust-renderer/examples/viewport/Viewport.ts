/**
 * Viewport - manages camera position and zoom
 *
 * Ported from Rust: quadratic-rust-renderer/src/viewport/viewport.rs
 *
 * This class manages the viewport state on the main thread and syncs it
 * to the Rust renderer via SharedArrayBuffer.
 */

import { Decelerate, type DecelerateOptions, DEFAULT_DECELERATE_OPTIONS } from './Decelerate';

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
 * via SharedArrayBuffer.
 */
export class Viewport {
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

  /** SharedArrayBuffer for syncing viewport to renderer */
  private buffer: SharedArrayBuffer | null = null;

  constructor(width = 0, height = 0, options?: DecelerateOptions) {
    this.sizeWidth = width;
    this.sizeHeight = height;
    this.decelerate = new Decelerate(options ?? DEFAULT_DECELERATE_OPTIONS);
  }

  // =========================================================================
  // SharedArrayBuffer Integration
  // =========================================================================

  /**
   * Set the SharedArrayBuffer for viewport synchronization.
   * Call this after creating the buffer and before starting rendering.
   */
  setBuffer(buffer: SharedArrayBuffer): void {
    this.buffer = buffer;
    this.syncToBuffer();
  }

  /**
   * Get the SharedArrayBuffer (for passing to the worker).
   */
  getBuffer(): SharedArrayBuffer | null {
    return this.buffer;
  }

  /**
   * Sync viewport state to the SharedArrayBuffer.
   * Called automatically when viewport changes.
   */
  syncToBuffer(): void {
    if (!this.buffer) return;

    const view = new Float32Array(this.buffer);
    view[0] = this.positionX;
    view[1] = this.positionY;
    view[2] = this.scaleValue;
    view[3] = this.dprValue;
    view[4] = this.sizeWidth;
    view[5] = this.sizeHeight;
    view[6] = this.dirty ? 1 : 0;
  }

  // =========================================================================
  // Viewport Management
  // =========================================================================

  /**
   * Resize the viewport with device pixel ratio
   *
   * @param width - Width in device pixels
   * @param height - Height in device pixels
   * @param dpr - Device pixel ratio (e.g., 2.0 for Retina displays)
   */
  resize(width: number, height: number, dpr: number): void {
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
   */
  pan(dx: number, dy: number): void {
    // Convert screen delta to world delta using effective scale
    const effectiveScale = this.scaleValue * this.dprValue;
    const worldDx = dx / effectiveScale;
    const worldDy = dy / effectiveScale;

    // Apply pan and clamp to prevent negative positions
    this.positionX = Math.max(0, this.positionX - worldDx);
    this.positionY = Math.max(0, this.positionY - worldDy);
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
   * @param centerX - Center X in device pixels
   * @param centerY - Center Y in device pixels
   */
  zoom(factor: number, centerX: number, centerY: number): void {
    const oldScale = this.scaleValue;
    const newScale = Math.min(
      this.maxScale,
      Math.max(this.minScale, this.scaleValue * factor)
    );

    if (Math.abs(newScale - oldScale) > Number.EPSILON) {
      // Step 1: Get world position of cursor before zoom
      const worldPoint = this.screenToWorld(centerX, centerY);

      // Step 2: Apply zoom
      this.scaleValue = newScale;

      // Step 3: Get new screen position of that world point after zoom
      const newScreen = this.worldToScreen(worldPoint.x, worldPoint.y);

      // Step 4: Move viewport so cursor stays at same world position
      const effectiveScale = this.scaleValue * this.dprValue;
      const dx = (centerX - newScreen.x) / effectiveScale;
      const dy = (centerY - newScreen.y) / effectiveScale;
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

  /** Convert screen coordinates (device pixels) to world coordinates */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const effectiveScale = this.scaleValue * this.dprValue;
    return {
      x: this.positionX + screenX / effectiveScale,
      y: this.positionY + screenY / effectiveScale,
    };
  }

  /** Convert world coordinates to screen coordinates (device pixels) */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const effectiveScale = this.scaleValue * this.dprValue;
    return {
      x: (worldX - this.positionX) * effectiveScale,
      y: (worldY - this.positionY) * effectiveScale,
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

  /** Get the effective rendering scale (scale * dpr) */
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
  }

  /**
   * Called during drag/pan - records position for velocity calculation
   * @param time - Current time in milliseconds (e.g., from performance.now())
   */
  onDragMove(time: number): void {
    this.decelerate.onMove(this.positionX, this.positionY, time);
  }

  /**
   * Called when drag/pan ends - calculates velocity and starts deceleration
   * @param time - Current time in milliseconds
   */
  onDragEnd(time: number): void {
    this.decelerate.onUp(this.positionX, this.positionY, time);
  }

  /** Called on wheel event - stops deceleration */
  onWheel(): void {
    this.decelerate.onWheel();
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
      this.positionX += delta.x;
      this.positionY += delta.y;

      // Clamp to prevent going negative during deceleration
      this.positionX = Math.max(0, this.positionX);
      this.positionY = Math.max(0, this.positionY);

      this.dirty = true;
      moved = true;
    }

    // Update snap-back delay countdown
    if (this.snapBackDelayRemaining > 0) {
      this.snapBackDelayRemaining = Math.max(
        0,
        this.snapBackDelayRemaining - elapsed
      );
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
      const speed =
        Math.max(distance / SNAP_BACK_MAX_DISTANCE, 0.3) * SNAP_BACK_VELOCITY;
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
      const speed =
        Math.max(distance / SNAP_BACK_MAX_DISTANCE, 0.3) * SNAP_BACK_VELOCITY;
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
}
