/**
 * ViewportControls - Handles viewport interaction (drag, zoom, deceleration)
 *
 * This module manages user input for viewport manipulation and controls
 * a TypeScript Viewport that syncs to the Rust renderer via SharedArrayBuffer.
 *
 * Designed to be portable back to the main quadratic-client app.
 */

import { rustRendererWebWorker } from '@/app/web-workers/rustRendererWebWorker/rustRendererWebWorker';
import { Viewport } from './Viewport';
import { createViewportBuffer } from './ViewportBuffer';

/** Zoom sensitivity for wheel events with ctrl/meta key */
export const WHEEL_ZOOM_PERCENT = 1.5;

/** Line height multiplier for non-pixel deltaMode scroll events */
export const LINE_HEIGHT = 20;

/** Divisor for wheel zoom step calculation */
export const WHEEL_ZOOM_DIVISOR = 500;

/** Divisor for pinch zoom step calculation (more sensitive) */
export const PINCH_ZOOM_DIVISOR = 200;

/** Debounce time for viewport updates (ms) */
export const VIEWPORT_UPDATE_DEBOUNCE_MS = 100;

/**
 * Manages viewport interaction for the Rust renderer.
 *
 * Handles:
 * - Drag to pan (with pointer capture)
 * - Wheel to pan (scroll)
 * - Pinch to zoom (ctrl+wheel / trackpad pinch)
 * - Deceleration (momentum scrolling)
 * - Debounced viewport change notifications
 *
 */
export class ViewportControls {
  private canvas: HTMLCanvasElement;

  // Viewport instance
  private viewport: Viewport;

  // Drag state
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;

  // Canvas dimensions (in device pixels)
  private canvasWidth = 0;
  private canvasHeight = 0;

  // Debounce state
  private updateTimeout: ReturnType<typeof setTimeout> | null = null;

  // Animation frame for deceleration
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;

  // Bound event handlers (for cleanup)
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundPointerCancel: (e: PointerEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundResize: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Initialize canvas dimensions
    this.updateCanvasDimensions();

    // Create SharedArrayBuffer and Viewport
    // Note: The buffer is NOT sent to the worker here - call sendBufferToWorker()
    // after the worker is initialized and ready to receive it.
    const buffer = createViewportBuffer();
    this.viewport = new Viewport(this.canvasWidth, this.canvasHeight);
    this.viewport.setBuffer(buffer);
    this.viewport.resize(this.canvasWidth, this.canvasHeight);

    // Bind event handlers
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerCancel = this.handlePointerCancel.bind(this);
    this.boundWheel = this.handleWheel.bind(this);
    this.boundResize = this.handleResize.bind(this);

    // Attach event listeners
    this.canvas.addEventListener('pointerdown', this.boundPointerDown);
    this.canvas.addEventListener('pointermove', this.boundPointerMove);
    this.canvas.addEventListener('pointerup', this.boundPointerUp);
    this.canvas.addEventListener('pointercancel', this.boundPointerCancel);
    this.canvas.addEventListener('wheel', this.boundWheel, { passive: false });

    window.addEventListener('resize', this.boundResize);

    // Start deceleration loop
    this.lastFrameTime = performance.now();
    this.startDecelerationLoop();
  }

  /**
   * Start the deceleration animation loop.
   */
  private startDecelerationLoop(): void {
    const loop = () => {
      const now = performance.now();
      const elapsed = now - this.lastFrameTime;
      this.lastFrameTime = now;

      // Update deceleration
      const moved = this.viewport.updateDecelerate(elapsed);
      if (moved) {
        this.scheduleViewportUpdate();
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Get the Viewport instance.
   */
  getViewport(): Viewport {
    return this.viewport;
  }

  /**
   * Get the SharedArrayBuffer for the viewport.
   * Use this to send the buffer to the worker after it's ready.
   */
  getBuffer(): SharedArrayBuffer {
    return this.viewport.getBuffer()!;
  }

  /**
   * Clean up event listeners.
   * Call this when the viewport controls are no longer needed.
   */
  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundPointerUp);
    this.canvas.removeEventListener('pointercancel', this.boundPointerCancel);
    this.canvas.removeEventListener('wheel', this.boundWheel);

    window.removeEventListener('resize', this.boundResize);

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }

    // Stop deceleration loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Update stored canvas dimensions.
   * Call this after the canvas is resized externally.
   */
  updateCanvasDimensions(): void {
    const dpr = window.devicePixelRatio || 1;
    const container = this.canvas.parentElement;
    if (container) {
      this.canvasWidth = container.clientWidth * dpr;
      this.canvasHeight = container.clientHeight * dpr;
    } else {
      this.canvasWidth = this.canvas.width;
      this.canvasHeight = this.canvas.height;
    }
  }

  /**
   * Get current canvas dimensions in device pixels.
   */
  getCanvasDimensions(): { width: number; height: number } {
    return { width: this.canvasWidth, height: this.canvasHeight };
  }

  /**
   * Notify that the viewport has moved (e.g., from deceleration).
   * This schedules a debounced viewport change callback.
   */
  notifyViewportMoved(): void {
    this.scheduleViewportUpdate();
  }

  /**
   * Manually trigger a resize.
   * Use this after external canvas resizing or during initialization.
   */
  triggerResize(): void {
    this.handleResize();
  }

  // ==========================================================================
  // Private: Event Handlers
  // ==========================================================================

  private handlePointerDown(e: PointerEvent): void {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);

    this.viewport.onDragStart();
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isDragging) return;

    const dpr = window.devicePixelRatio || 1;
    const dx = (e.clientX - this.lastX) * dpr;
    const dy = (e.clientY - this.lastY) * dpr;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    const time = performance.now();

    this.viewport.pan(dx, dy);
    this.viewport.onDragMove(time);

    this.scheduleViewportUpdate();
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.canvas.releasePointerCapture(e.pointerId);

    const time = performance.now();
    this.viewport.onDragEnd(time);
  }

  private handlePointerCancel(_e: PointerEvent): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.viewport.onDragStart(); // Reset deceleration
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const dpr = window.devicePixelRatio || 1;

    // deltaMode: 0 = pixels, 1 = lines, 2 = pages
    const deltaX = e.deltaX * (e.deltaMode ? LINE_HEIGHT : 1);
    const deltaY = e.deltaY * (e.deltaMode ? LINE_HEIGHT : 1);

    // Check if this is a pinch gesture (ctrl key on trackpad)
    const isPinch = e.ctrlKey;

    if (isPinch) {
      // Pinch to zoom
      const step = -deltaY / PINCH_ZOOM_DIVISOR;
      const factor = Math.pow(2, (1 + WHEEL_ZOOM_PERCENT) * step);

      // Calculate zoom center in device pixels
      const rect = this.canvas.getBoundingClientRect();
      const centerX = (e.clientX - rect.left) * (this.canvasWidth / rect.width);
      const centerY = (e.clientY - rect.top) * (this.canvasHeight / rect.height);

      this.viewport.zoom(factor, centerX, centerY);
    } else {
      // Wheel to pan (inverted to match natural scrolling)
      const dx = -deltaX * dpr;
      const dy = -deltaY * dpr;

      this.viewport.onWheel();
      this.viewport.pan(dx, dy);
    }

    this.scheduleViewportUpdate();
  }

  private handleResize(): void {
    this.updateCanvasDimensions();

    this.viewport.resize(this.canvasWidth, this.canvasHeight);

    // Also send resize to worker for canvas resizing
    rustRendererWebWorker.resize(this.canvasWidth, this.canvasHeight);
  }

  // ==========================================================================
  // Private: Debounced Updates
  // ==========================================================================

  private scheduleViewportUpdate(): void {
    if (!this.updateTimeout) {
      this.updateTimeout = setTimeout(() => (this.updateTimeout = null), VIEWPORT_UPDATE_DEBOUNCE_MS);
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate zoom factor from wheel event delta.
 *
 * @param deltaY - The wheel event deltaY value
 * @param deltaMode - The wheel event deltaMode (0=pixels, 1=lines, 2=pages)
 * @param isPinch - Whether this is a pinch gesture (ctrl key held)
 * @returns The zoom factor to apply
 */
export function calculateZoomFactor(deltaY: number, deltaMode: number, isPinch: boolean): number {
  const adjustedDelta = deltaY * (deltaMode ? LINE_HEIGHT : 1);
  const divisor = isPinch ? PINCH_ZOOM_DIVISOR : WHEEL_ZOOM_DIVISOR;
  const step = -adjustedDelta / divisor;
  return Math.pow(2, (1 + WHEEL_ZOOM_PERCENT) * step);
}

/**
 * Convert client coordinates to canvas device pixel coordinates.
 *
 * @param clientX - Client X coordinate (from mouse/touch event)
 * @param clientY - Client Y coordinate
 * @param canvas - The canvas element
 * @param canvasWidth - Canvas width in device pixels
 * @param canvasHeight - Canvas height in device pixels
 * @returns Coordinates in device pixels
 */
export function clientToCanvasPixels(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvasWidth / rect.width),
    y: (clientY - rect.top) * (canvasHeight / rect.height),
  };
}
