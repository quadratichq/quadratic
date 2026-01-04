//! WGSL shaders for WebGPU rendering
//!
//! These shaders leverage WebGPU-specific features:
//! - Storage buffers for instanced rendering
//! - Built-in instance_index for GPU instancing

/// Basic shader for lines and rectangles
pub const BASIC_SHADER: &str = include_str!("basic.wgsl");

/// MSDF text shader
pub const MSDF_SHADER: &str = include_str!("msdf.wgsl");

/// Sprite shader
pub const SPRITE_SHADER: &str = include_str!("sprite.wgsl");

/// Instanced rectangle shader (WebGPU optimization)
/// Uses GPU instancing to draw many rectangles with a single draw call.
/// ~6x less data upload compared to non-instanced rendering.
pub const INSTANCED_SHADER: &str = include_str!("instanced.wgsl");
