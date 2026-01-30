//! Render context trait and command buffering
//!
//! Defines a common interface for rendering backends. The trait is implemented
//! by platform-specific renderers (wgpu for both native and WASM).

/// Texture identifier type
pub type TextureId = u32;

/// Error type for render context operations
#[derive(Debug, Clone)]
pub struct RenderError(pub String);

impl std::fmt::Display for RenderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for RenderError {}

/// A buffered draw command
///
/// Commands are recorded during the frame and executed at `end_frame()`.
#[derive(Clone)]
pub enum DrawCommand {
    /// Clear the canvas with a color
    Clear { r: f32, g: f32, b: f32, a: f32 },

    /// Set viewport
    SetViewport {
        x: i32,
        y: i32,
        width: i32,
        height: i32,
    },

    /// Reset viewport to full canvas
    ResetViewport,

    /// Set scissor rect
    SetScissor {
        x: i32,
        y: i32,
        width: i32,
        height: i32,
    },

    /// Disable scissor test
    DisableScissor,

    /// Draw triangles
    /// Vertex format: [x, y, r, g, b, a] (6 floats per vertex)
    Triangles { vertices: Vec<f32>, matrix: [f32; 16] },

    /// Draw lines (native line primitives)
    /// Vertex format: [x, y, r, g, b, a] (6 floats per vertex, 2 per line)
    Lines { vertices: Vec<f32>, matrix: [f32; 16] },

    /// Draw MSDF text
    /// Vertex format: [x, y, u, v, r, g, b, a] (8 floats per vertex)
    Text {
        vertices: Vec<f32>,
        indices: Vec<u32>,
        texture_uid: u32,
        matrix: [f32; 16],
        viewport_scale: f32,
        font_scale: f32,
        distance_range: f32,
    },

    /// Draw sprites
    /// Vertex format: [x, y, u, v, r, g, b, a] (8 floats per vertex, 4 per sprite)
    Sprites {
        texture_id: TextureId,
        vertices: Vec<f32>,
        indices: Vec<u32>,
        matrix: [f32; 16],
    },
}

/// Common interface for rendering backends
///
/// This trait abstracts over different wgpu configurations (native vs WASM,
/// surface vs texture target). All draw calls are buffered and executed
/// when `end_frame()` is called.
///
/// ## Usage Pattern
///
/// ```ignore
/// ctx.begin_frame();
/// ctx.clear(0.9, 0.9, 0.9, 1.0);
/// rects.render(&mut ctx, &matrix);
/// lines.render(&mut ctx, &matrix);
/// ctx.end_frame();
/// ```
pub trait RenderContext {
    // ========================================================================
    // Lifecycle & State
    // ========================================================================

    /// Begin a new frame. Must be called before any draw operations.
    /// Clears the command buffer from the previous frame.
    fn begin_frame(&mut self);

    /// End the current frame and execute all buffered commands.
    /// This is where actual GPU calls happen.
    fn end_frame(&mut self);

    /// Resize the rendering surface
    fn resize(&mut self, width: u32, height: u32);

    /// Get current width
    fn width(&self) -> u32;

    /// Get current height
    fn height(&self) -> u32;

    /// Get the backend name (e.g., "wgpu-WebGPU", "wgpu-Vulkan")
    fn backend_name(&self) -> &'static str;

    // ========================================================================
    // Command Recording (these buffer commands, don't execute immediately)
    // ========================================================================

    /// Clear the canvas with a color
    fn clear(&mut self, r: f32, g: f32, b: f32, a: f32);

    /// Set the viewport to a specific area
    fn set_viewport(&mut self, x: i32, y: i32, width: i32, height: i32);

    /// Reset viewport to full canvas
    fn reset_viewport(&mut self);

    /// Set scissor rect for clipping
    fn set_scissor(&mut self, x: i32, y: i32, width: i32, height: i32);

    /// Disable scissor test
    fn disable_scissor(&mut self);

    /// Draw triangles from vertex data
    /// Vertex format: [x, y, r, g, b, a, ...] (6 floats per vertex)
    fn draw_triangles(&mut self, vertices: &[f32], matrix: &[f32; 16]);

    /// Draw lines from vertex data
    /// Vertex format: [x, y, r, g, b, a, ...] (6 floats per vertex, 2 vertices per line)
    fn draw_lines(&mut self, vertices: &[f32], matrix: &[f32; 16]);

    /// Draw text using MSDF rendering
    /// Vertex format: [x, y, u, v, r, g, b, a, ...] (8 floats per vertex)
    #[allow(clippy::too_many_arguments)]
    fn draw_text(
        &mut self,
        vertices: &[f32],
        indices: &[u32],
        texture_uid: u32,
        matrix: &[f32; 16],
        viewport_scale: f32,
        font_scale: f32,
        distance_range: f32,
    );

    /// Draw sprites using the specified texture
    /// Vertex format: [x, y, u, v, r, g, b, a, ...] (8 floats per vertex, 4 vertices per sprite)
    fn draw_sprites(
        &mut self,
        texture_id: TextureId,
        vertices: &[f32],
        indices: &[u32],
        matrix: &[f32; 16],
    );

    // ========================================================================
    // Resource Management (these execute immediately, not buffered)
    // ========================================================================

    /// Check if a font texture is loaded
    fn has_font_texture(&self, texture_uid: u32) -> bool;

    /// Upload a font texture from raw RGBA pixel data
    fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), RenderError>;

    /// Check if a sprite texture is loaded
    fn has_sprite_texture(&self, texture_id: TextureId) -> bool;

    /// Upload a sprite texture from raw RGBA pixel data
    fn upload_sprite_texture(
        &mut self,
        texture_id: TextureId,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), RenderError>;

    /// Remove a sprite texture
    fn remove_sprite_texture(&mut self, texture_id: TextureId);
}

/// Command buffer for storing draw commands
///
/// This is a convenience struct that backends can use to store commands.
#[derive(Default)]
pub struct CommandBuffer {
    commands: Vec<DrawCommand>,
}

impl CommandBuffer {
    pub fn new() -> Self {
        Self {
            commands: Vec::with_capacity(256),
        }
    }

    pub fn clear(&mut self) {
        self.commands.clear();
    }

    pub fn push(&mut self, command: DrawCommand) {
        self.commands.push(command);
    }

    pub fn commands(&self) -> &[DrawCommand] {
        &self.commands
    }

    pub fn is_empty(&self) -> bool {
        self.commands.is_empty()
    }

    pub fn len(&self) -> usize {
        self.commands.len()
    }
}
