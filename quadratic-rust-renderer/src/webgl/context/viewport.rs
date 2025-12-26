//! WebGL2 viewport accessors
//!
//! Additional viewport-related methods not covered by RenderContext trait.
//! The main viewport methods (resize, set_viewport, etc.) are in render_context.rs.

use crate::webgl::WebGLContext;

impl WebGLContext {
    /// Get the canvas width
    pub fn canvas_width(&self) -> u32 {
        self.width
    }

    /// Get the canvas height
    pub fn canvas_height(&self) -> u32 {
        self.height
    }
}
