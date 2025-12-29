/**
 * Decelerate - smooth viewport momentum after panning
 *
 * This provides smooth deceleration after the user releases a pan gesture,
 * simulating inertia/momentum scrolling.
 */

/** Time period of decay (1 frame at 60fps = ~16.67ms) */
const TP = 16.0;

/** Maximum number of snapshots to keep */
const MAX_SNAPSHOTS = 60;

/** Number of snapshots to keep when pruning */
const PRUNE_TO = 30;

/** Decay factor per axis */
const DECAY_FACTOR_X = 0.98;
const DECAY_FACTOR_Y = 0.98;

/** Options for the decelerate plugin */
export interface DecelerateOptions {
  /** Percent to decelerate after movement (0.0 to 1.0, exclusive)
   * Higher values = less friction = longer coast */
  friction: number;

  /** Percent to decelerate when past boundaries */
  bounce: number;

  /** Minimum velocity before stopping (px/frame normalized to 16ms) */
  minSpeed: number;
}

export const DEFAULT_DECELERATE_OPTIONS: DecelerateOptions = {
  friction: 0.98,
  bounce: 0.8,
  minSpeed: 0.1,
};

/** Viewport position snapshot for velocity estimation */
interface Snapshot {
  /** Viewport position at this moment */
  x: number;
  y: number;
  /** Time in milliseconds when snapshot was taken */
  time: number;
}

/** 2D Vector */
interface Vec2 {
  x: number;
  y: number;
}

/**
 * Decelerate plugin state
 *
 * Tracks viewport momentum and applies smooth deceleration after panning ends.
 */
export class Decelerate {
  private options: DecelerateOptions;

  /** Current velocity (px/frame, normalized to 16ms) - null when not decelerating */
  private velocity: Vec2 | null = null;

  /** Decay factor per axis */
  private percentChange: Vec2 = { x: DECAY_FACTOR_X, y: DECAY_FACTOR_Y };

  /** Recent position snapshots for velocity estimation */
  private snapshots: Snapshot[] = [];

  /** Time since drag release (for integration) */
  private timeSinceRelease = 0;

  /** Whether the plugin is paused */
  private paused = false;

  constructor(options: DecelerateOptions = DEFAULT_DECELERATE_OPTIONS) {
    this.options = { ...options };
  }

  /** Check if deceleration is currently active */
  isActive(): boolean {
    return this.velocity !== null;
  }

  /** Pause the deceleration */
  pause(): void {
    this.paused = true;
  }

  /** Resume the deceleration */
  resume(): void {
    this.paused = false;
  }

  /** Reset deceleration state (stop any active deceleration) */
  reset(): void {
    this.velocity = null;
    this.snapshots = [];
  }

  /** Called when a wheel event occurs - stops deceleration */
  onWheel(): void {
    this.snapshots = [];
    this.velocity = null;
  }

  /** Called when pointer/touch down - stops deceleration and starts recording */
  onDown(): void {
    this.snapshots = [];
    this.velocity = null;
  }

  /**
   * Called during pointer/touch move - records viewport position
   *
   * @param x - Current viewport X position
   * @param y - Current viewport Y position
   * @param time - Current time in milliseconds (e.g., from performance.now())
   */
  onMove(x: number, y: number, time: number): void {
    if (this.paused) return;

    this.snapshots.push({ x, y, time });

    // Prune old snapshots to avoid unbounded growth
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots.splice(0, MAX_SNAPSHOTS - PRUNE_TO);
    }
  }

  /**
   * Called when pointer/touch up - calculates velocity from snapshots
   *
   * @param currentX - Final viewport X position
   * @param currentY - Final viewport Y position
   * @param time - Current time in milliseconds
   */
  onUp(currentX: number, currentY: number, time: number): void {
    if (this.snapshots.length === 0) return;

    // Find a snapshot from within the last 100ms
    const threshold = time - 100;

    for (const snapshot of this.snapshots) {
      if (snapshot.time >= threshold) {
        const dt = time - snapshot.time;
        if (dt > 0) {
          // Calculate velocity in px/ms
          this.velocity = {
            x: (currentX - snapshot.x) / dt,
            y: (currentY - snapshot.y) / dt,
          };
          this.percentChange = {
            x: this.options.friction,
            y: this.options.friction,
          };
          this.timeSinceRelease = 0;
        }
        break;
      }
    }

    this.snapshots = [];
  }

  /**
   * Manually activate deceleration with a specific velocity
   *
   * @param vx - X velocity in px/ms
   * @param vy - Y velocity in px/ms
   */
  activate(vx: number, vy: number): void {
    this.velocity = { x: vx, y: vy };
    this.percentChange = {
      x: this.options.friction,
      y: this.options.friction,
    };
    this.timeSinceRelease = 0;
  }

  /** Manually activate deceleration on X axis only */
  activateX(vx: number): void {
    const vy = this.velocity?.y ?? 0;
    this.velocity = { x: vx, y: vy };
    this.percentChange.x = this.options.friction;
    this.timeSinceRelease = 0;
  }

  /** Manually activate deceleration on Y axis only */
  activateY(vy: number): void {
    const vx = this.velocity?.x ?? 0;
    this.velocity = { x: vx, y: vy };
    this.percentChange.y = this.options.friction;
    this.timeSinceRelease = 0;
  }

  /**
   * Update deceleration state and return position delta to apply
   * - Velocity decays exponentially by the decay factor each frame
   * - Displacement is calculated by integrating the velocity function
   *
   * @param elapsed - Time elapsed since last update in milliseconds
   * @returns Position delta to apply to the viewport, or null if not decelerating
   */
  update(elapsed: number): Vec2 | null {
    if (this.paused || !this.velocity) return null;

    const velocity = this.velocity;
    const ti = this.timeSinceRelease;
    const tf = this.timeSinceRelease + elapsed;

    const delta: Vec2 = { x: 0, y: 0 };

    // Apply X velocity with exponential decay
    if (Math.abs(velocity.x) > Number.EPSILON) {
      const k = this.percentChange.x;
      const lnk = Math.log(k);

      // Integrate velocity to get displacement:
      // ∫v₀ * k^(t/TP) dt = v₀ * TP / ln(k) * (k^(tf/TP) - k^(ti/TP))
      delta.x = ((velocity.x * TP) / lnk) * (Math.pow(k, tf / TP) - Math.pow(k, ti / TP));

      // Decay velocity
      velocity.x *= Math.pow(k, elapsed / TP);
    }

    // Apply Y velocity with exponential decay
    if (Math.abs(velocity.y) > Number.EPSILON) {
      const k = this.percentChange.y;
      const lnk = Math.log(k);

      delta.y = ((velocity.y * TP) / lnk) * (Math.pow(k, tf / TP) - Math.pow(k, ti / TP));

      // Decay velocity
      velocity.y *= Math.pow(k, elapsed / TP);
    }

    this.timeSinceRelease += elapsed;

    // Stop deceleration when velocity is below threshold
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    if (speed < this.options.minSpeed) {
      this.velocity = null;
    }

    return delta;
  }

  /** Get current velocity (if any) */
  getVelocity(): Vec2 | null {
    return this.velocity ? { ...this.velocity } : null;
  }
}
