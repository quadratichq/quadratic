//! Decelerate - smooth viewport momentum after panning
//!
//! Equivalent to Decelerate.ts from pixi-viewport
//!
//! This provides smooth deceleration after the user releases a pan gesture,
//! simulating inertia/momentum scrolling.

use glam::Vec2;

/// Time period of decay (1 frame at 60fps = ~16.67ms)
const TP: f32 = 16.0;

/// Maximum number of snapshots to keep
const MAX_SNAPSHOTS: usize = 60;

/// Number of snapshots to keep when pruning
const PRUNE_TO: usize = 30;

/// Options for the decelerate plugin
#[derive(Debug, Clone)]
pub struct DecelerateOptions {
    /// Percent to decelerate after movement (0.0 to 1.0, exclusive)
    /// Higher values = less friction = longer coast
    pub friction: f32,

    /// Percent to decelerate when past boundaries
    pub bounce: f32,

    /// Minimum velocity before stopping (px/frame normalized to 16ms)
    pub min_speed: f32,
}

impl Default for DecelerateOptions {
    fn default() -> Self {
        Self {
            friction: 0.98,
            bounce: 0.8,
            min_speed: 0.1,
        }
    }
}

/// Viewport position snapshot for velocity estimation
#[derive(Debug, Clone, Copy)]
struct Snapshot {
    /// Viewport position at this moment
    position: Vec2,
    /// Time in milliseconds when snapshot was taken
    time: f64,
}

/// Decelerate plugin state
///
/// Tracks viewport momentum and applies smooth deceleration after panning ends.
#[derive(Debug)]
pub struct Decelerate {
    /// Configuration options
    options: DecelerateOptions,

    /// Current velocity (px/frame, normalized to 16ms frame)
    /// None when not actively decelerating
    velocity: Option<Vec2>,

    /// Decay factor per axis
    percent_change: Vec2,

    /// Recent position snapshots for velocity estimation
    snapshots: Vec<Snapshot>,

    /// Time since drag release (for integration)
    time_since_release: f32,

    /// Whether the plugin is paused
    paused: bool,
}

impl Decelerate {
    /// Create a new decelerate plugin
    pub fn new(options: DecelerateOptions) -> Self {
        Self {
            options,
            velocity: None,
            percent_change: Vec2::new(0.98, 0.98),
            snapshots: Vec::with_capacity(MAX_SNAPSHOTS),
            time_since_release: 0.0,
            paused: false,
        }
    }

    /// Check if deceleration is currently active
    pub fn is_active(&self) -> bool {
        self.velocity.is_some()
    }

    /// Pause the deceleration
    pub fn pause(&mut self) {
        self.paused = true;
    }

    /// Resume the deceleration
    pub fn resume(&mut self) {
        self.paused = false;
    }

    /// Reset deceleration state (stop any active deceleration)
    pub fn reset(&mut self) {
        self.velocity = None;
        self.snapshots.clear();
    }

    /// Called when a wheel event occurs - stops deceleration
    pub fn on_wheel(&mut self) {
        self.snapshots.clear();
        self.velocity = None;
    }

    /// Called when pointer/touch down - stops deceleration and starts recording
    pub fn on_down(&mut self) {
        self.snapshots.clear();
        self.velocity = None;
    }

    /// Called during pointer/touch move - records viewport position
    ///
    /// # Arguments
    /// * `position` - Current viewport position (x, y)
    /// * `time` - Current time in milliseconds (e.g., from performance.now())
    pub fn on_move(&mut self, position: Vec2, time: f64) {
        if self.paused {
            return;
        }

        self.snapshots.push(Snapshot { position, time });

        // Prune old snapshots to avoid unbounded growth
        if self.snapshots.len() > MAX_SNAPSHOTS {
            self.snapshots.drain(0..(MAX_SNAPSHOTS - PRUNE_TO));
        }
    }

    /// Called when pointer/touch up - calculates velocity from snapshots
    ///
    /// # Arguments
    /// * `current_position` - Final viewport position
    /// * `time` - Current time in milliseconds
    pub fn on_up(&mut self, current_position: Vec2, time: f64) {
        if self.snapshots.is_empty() {
            return;
        }

        // Find a snapshot from within the last 100ms
        let threshold = time - 100.0;

        for snapshot in &self.snapshots {
            if snapshot.time >= threshold {
                let dt = time - snapshot.time;
                if dt > 0.0 {
                    // Calculate velocity in px/ms
                    let velocity = (current_position - snapshot.position) / dt as f32;
                    self.velocity = Some(velocity);
                    self.percent_change = Vec2::new(self.options.friction, self.options.friction);
                    self.time_since_release = 0.0;
                }
                break;
            }
        }

        self.snapshots.clear();
    }

    /// Manually activate deceleration with a specific velocity
    ///
    /// # Arguments
    /// * `velocity` - Initial velocity (x, y) in px/ms
    pub fn activate(&mut self, velocity: Vec2) {
        self.velocity = Some(velocity);
        self.percent_change = Vec2::new(self.options.friction, self.options.friction);
        self.time_since_release = 0.0;
    }

    /// Manually activate deceleration on a single axis
    pub fn activate_x(&mut self, vx: f32) {
        let vy = self.velocity.map(|v| v.y).unwrap_or(0.0);
        self.velocity = Some(Vec2::new(vx, vy));
        self.percent_change.x = self.options.friction;
        self.time_since_release = 0.0;
    }

    /// Manually activate deceleration on a single axis
    pub fn activate_y(&mut self, vy: f32) {
        let vx = self.velocity.map(|v| v.x).unwrap_or(0.0);
        self.velocity = Some(Vec2::new(vx, vy));
        self.percent_change.y = self.options.friction;
        self.time_since_release = 0.0;
    }

    /// Update deceleration state and return position delta to apply
    ///
    /// Uses the same math as pixi-viewport:
    /// - Velocity decays exponentially by the decay factor each frame
    /// - Displacement is calculated by integrating the velocity function
    ///
    /// # Arguments
    /// * `elapsed` - Time elapsed since last update in milliseconds
    /// * `_viewport_position` - Current viewport position (unused, kept for API compatibility)
    ///
    /// # Returns
    /// Position delta to apply to the viewport, or None if not decelerating
    pub fn update(&mut self, elapsed: f32, _viewport_position: Vec2) -> Option<Vec2> {
        if self.paused {
            return None;
        }

        let velocity = self.velocity.as_mut()?;

        let ti = self.time_since_release;
        let tf = self.time_since_release + elapsed;

        let mut delta = Vec2::ZERO;

        // Apply X velocity with exponential decay
        if velocity.x.abs() > f32::EPSILON {
            let k = self.percent_change.x;
            let lnk = k.ln();

            // Integrate velocity to get displacement:
            // ∫v₀ * k^(t/TP) dt = v₀ * TP / ln(k) * (k^(tf/TP) - k^(ti/TP))
            delta.x = (velocity.x * TP / lnk) * (k.powf(tf / TP) - k.powf(ti / TP));

            // Decay velocity
            velocity.x *= k.powf(elapsed / TP);
        }

        // Apply Y velocity with exponential decay
        if velocity.y.abs() > f32::EPSILON {
            let k = self.percent_change.y;
            let lnk = k.ln();

            delta.y = (velocity.y * TP / lnk) * (k.powf(tf / TP) - k.powf(ti / TP));

            // Decay velocity
            velocity.y *= k.powf(elapsed / TP);
        }

        self.time_since_release += elapsed;

        // Stop deceleration when velocity is below threshold
        let speed = (velocity.x * velocity.x + velocity.y * velocity.y).sqrt();
        if speed < self.options.min_speed {
            self.velocity = None;
        }

        Some(delta)
    }

    /// Get current velocity (if any)
    pub fn velocity(&self) -> Option<Vec2> {
        self.velocity
    }
}

impl Default for Decelerate {
    fn default() -> Self {
        Self::new(DecelerateOptions::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_options() {
        let dec = Decelerate::default();
        assert!(!dec.is_active());
        assert!((dec.options.friction - 0.98).abs() < f32::EPSILON);
    }

    #[test]
    fn test_activate() {
        let mut dec = Decelerate::default();
        dec.activate(Vec2::new(1.0, 2.0));
        assert!(dec.is_active());
        assert_eq!(dec.velocity(), Some(Vec2::new(1.0, 2.0)));
    }

    #[test]
    fn test_reset() {
        let mut dec = Decelerate::default();
        dec.activate(Vec2::new(1.0, 2.0));
        dec.reset();
        assert!(!dec.is_active());
    }

    #[test]
    fn test_on_down_stops_deceleration() {
        let mut dec = Decelerate::default();
        dec.activate(Vec2::new(1.0, 2.0));
        dec.on_down();
        assert!(!dec.is_active());
    }

    #[test]
    fn test_update_produces_delta() {
        let mut dec = Decelerate::default();
        dec.activate(Vec2::new(1.0, 0.0));

        let delta = dec.update(16.0, Vec2::ZERO);
        assert!(delta.is_some());
        let d = delta.unwrap();
        // Delta should be positive (moving in direction of velocity)
        assert!(d.x > 0.0);
    }

    #[test]
    fn test_velocity_decays() {
        let mut dec = Decelerate::default();
        dec.activate(Vec2::new(10.0, 0.0));

        let v1 = dec.velocity().unwrap().x;
        dec.update(16.0, Vec2::ZERO);
        let v2 = dec.velocity().unwrap().x;

        // Velocity should decrease
        assert!(v2 < v1);
    }

    #[test]
    fn test_snapshot_recording() {
        let mut dec = Decelerate::default();

        dec.on_move(Vec2::new(0.0, 0.0), 0.0);
        dec.on_move(Vec2::new(100.0, 0.0), 50.0);
        dec.on_up(Vec2::new(200.0, 0.0), 100.0);

        // Should have calculated velocity
        assert!(dec.is_active());
        let v = dec.velocity().unwrap();
        // Velocity should be positive in x direction
        assert!(v.x > 0.0);
    }
}
