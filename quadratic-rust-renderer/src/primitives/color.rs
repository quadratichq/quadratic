//! Color type for primitives

/// RGBA color as [r, g, b, a] where each component is 0.0-1.0
pub type Color = [f32; 4];

/// Common color constants
pub mod colors {
    use super::Color;

    pub const WHITE: Color = [1.0, 1.0, 1.0, 1.0];
    pub const BLACK: Color = [0.0, 0.0, 0.0, 1.0];
    pub const TRANSPARENT: Color = [0.0, 0.0, 0.0, 0.0];
    pub const RED: Color = [1.0, 0.0, 0.0, 1.0];
    pub const GREEN: Color = [0.0, 1.0, 0.0, 1.0];
    pub const BLUE: Color = [0.0, 0.0, 1.0, 1.0];
}
