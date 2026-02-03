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
    Triangles {
        vertices: Vec<f32>,
        matrix: [f32; 16],
    },

    /// Draw lines (native line primitives)
    /// Vertex format: [x, y, r, g, b, a] (6 floats per vertex, 2 per line)
    Lines {
        vertices: Vec<f32>,
        matrix: [f32; 16],
    },

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

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // RenderError tests
    // =========================================================================

    #[test]
    fn test_render_error_display() {
        let error = RenderError("Test error message".to_string());
        assert_eq!(format!("{}", error), "Test error message");
    }

    #[test]
    fn test_render_error_debug() {
        let error = RenderError("Debug test".to_string());
        let debug_str = format!("{:?}", error);
        assert!(debug_str.contains("Debug test"));
    }

    #[test]
    fn test_render_error_clone() {
        let error = RenderError("Clone test".to_string());
        let cloned = error.clone();
        assert_eq!(error.0, cloned.0);
    }

    #[test]
    fn test_render_error_as_error() {
        let error = RenderError("Error trait test".to_string());
        let error_ref: &dyn std::error::Error = &error;
        assert_eq!(error_ref.to_string(), "Error trait test");
    }

    // =========================================================================
    // DrawCommand tests
    // =========================================================================

    #[test]
    fn test_draw_command_clear() {
        let cmd = DrawCommand::Clear {
            r: 0.5,
            g: 0.6,
            b: 0.7,
            a: 1.0,
        };
        match cmd {
            DrawCommand::Clear { r, g, b, a } => {
                assert_eq!(r, 0.5);
                assert_eq!(g, 0.6);
                assert_eq!(b, 0.7);
                assert_eq!(a, 1.0);
            }
            _ => panic!("Expected Clear command"),
        }
    }

    #[test]
    fn test_draw_command_set_viewport() {
        let cmd = DrawCommand::SetViewport {
            x: 10,
            y: 20,
            width: 100,
            height: 200,
        };
        match cmd {
            DrawCommand::SetViewport {
                x,
                y,
                width,
                height,
            } => {
                assert_eq!(x, 10);
                assert_eq!(y, 20);
                assert_eq!(width, 100);
                assert_eq!(height, 200);
            }
            _ => panic!("Expected SetViewport command"),
        }
    }

    #[test]
    fn test_draw_command_triangles() {
        let vertices = vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0];
        let matrix = [1.0; 16];
        let cmd = DrawCommand::Triangles {
            vertices: vertices.clone(),
            matrix,
        };
        match cmd {
            DrawCommand::Triangles {
                vertices: v,
                matrix: m,
            } => {
                assert_eq!(v, vertices);
                assert_eq!(m, matrix);
            }
            _ => panic!("Expected Triangles command"),
        }
    }

    #[test]
    fn test_draw_command_lines() {
        let vertices = vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0];
        let matrix = [1.0; 16];
        let cmd = DrawCommand::Lines {
            vertices: vertices.clone(),
            matrix,
        };
        match cmd {
            DrawCommand::Lines {
                vertices: v,
                matrix: m,
            } => {
                assert_eq!(v, vertices);
                assert_eq!(m, matrix);
            }
            _ => panic!("Expected Lines command"),
        }
    }

    #[test]
    fn test_draw_command_text() {
        let vertices = vec![0.0; 16];
        let indices = vec![0, 1, 2];
        let matrix = [1.0; 16];
        let cmd = DrawCommand::Text {
            vertices: vertices.clone(),
            indices: indices.clone(),
            texture_uid: 42,
            matrix,
            viewport_scale: 2.0,
            font_scale: 1.5,
            distance_range: 0.5,
        };
        match cmd {
            DrawCommand::Text {
                vertices: v,
                indices: i,
                texture_uid,
                matrix: m,
                viewport_scale,
                font_scale,
                distance_range,
            } => {
                assert_eq!(v, vertices);
                assert_eq!(i, indices);
                assert_eq!(texture_uid, 42);
                assert_eq!(m, matrix);
                assert_eq!(viewport_scale, 2.0);
                assert_eq!(font_scale, 1.5);
                assert_eq!(distance_range, 0.5);
            }
            _ => panic!("Expected Text command"),
        }
    }

    #[test]
    fn test_draw_command_sprites() {
        let vertices = vec![0.0; 32];
        let indices = vec![0, 1, 2, 0, 2, 3];
        let matrix = [1.0; 16];
        let cmd = DrawCommand::Sprites {
            texture_id: 10,
            vertices: vertices.clone(),
            indices: indices.clone(),
            matrix,
        };
        match cmd {
            DrawCommand::Sprites {
                texture_id,
                vertices: v,
                indices: i,
                matrix: m,
            } => {
                assert_eq!(texture_id, 10);
                assert_eq!(v, vertices);
                assert_eq!(i, indices);
                assert_eq!(m, matrix);
            }
            _ => panic!("Expected Sprites command"),
        }
    }

    #[test]
    fn test_draw_command_clone() {
        let cmd = DrawCommand::Clear {
            r: 0.1,
            g: 0.2,
            b: 0.3,
            a: 0.4,
        };
        let cloned = cmd.clone();
        match cloned {
            DrawCommand::Clear { r, g, b, a } => {
                assert_eq!(r, 0.1);
                assert_eq!(g, 0.2);
                assert_eq!(b, 0.3);
                assert_eq!(a, 0.4);
            }
            _ => panic!("Expected Clear command"),
        }
    }

    // =========================================================================
    // CommandBuffer tests
    // =========================================================================

    #[test]
    fn test_command_buffer_new() {
        let buffer = CommandBuffer::new();
        assert!(buffer.is_empty());
        assert_eq!(buffer.len(), 0);
    }

    #[test]
    fn test_command_buffer_default() {
        let buffer = CommandBuffer::default();
        assert!(buffer.is_empty());
        assert_eq!(buffer.len(), 0);
    }

    #[test]
    fn test_command_buffer_push() {
        let mut buffer = CommandBuffer::new();
        buffer.push(DrawCommand::ResetViewport);
        assert!(!buffer.is_empty());
        assert_eq!(buffer.len(), 1);
    }

    #[test]
    fn test_command_buffer_push_multiple() {
        let mut buffer = CommandBuffer::new();
        buffer.push(DrawCommand::ResetViewport);
        buffer.push(DrawCommand::DisableScissor);
        buffer.push(DrawCommand::Clear {
            r: 0.0,
            g: 0.0,
            b: 0.0,
            a: 1.0,
        });
        assert_eq!(buffer.len(), 3);
    }

    #[test]
    fn test_command_buffer_clear() {
        let mut buffer = CommandBuffer::new();
        buffer.push(DrawCommand::ResetViewport);
        buffer.push(DrawCommand::DisableScissor);
        assert_eq!(buffer.len(), 2);
        buffer.clear();
        assert!(buffer.is_empty());
        assert_eq!(buffer.len(), 0);
    }

    #[test]
    fn test_command_buffer_commands() {
        let mut buffer = CommandBuffer::new();
        buffer.push(DrawCommand::ResetViewport);
        buffer.push(DrawCommand::DisableScissor);

        let commands = buffer.commands();
        assert_eq!(commands.len(), 2);
        match commands[0] {
            DrawCommand::ResetViewport => {}
            _ => panic!("Expected ResetViewport"),
        }
        match commands[1] {
            DrawCommand::DisableScissor => {}
            _ => panic!("Expected DisableScissor"),
        }
    }

    #[test]
    fn test_command_buffer_is_empty() {
        let mut buffer = CommandBuffer::new();
        assert!(buffer.is_empty());
        buffer.push(DrawCommand::ResetViewport);
        assert!(!buffer.is_empty());
        buffer.clear();
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_command_buffer_len() {
        let mut buffer = CommandBuffer::new();
        assert_eq!(buffer.len(), 0);
        buffer.push(DrawCommand::SetScissor {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        });
        assert_eq!(buffer.len(), 1);
        buffer.push(DrawCommand::DisableScissor);
        assert_eq!(buffer.len(), 2);
    }

    #[test]
    fn test_command_buffer_all_command_types() {
        let mut buffer = CommandBuffer::new();

        buffer.push(DrawCommand::Clear {
            r: 1.0,
            g: 0.0,
            b: 0.0,
            a: 1.0,
        });
        buffer.push(DrawCommand::SetViewport {
            x: 0,
            y: 0,
            width: 800,
            height: 600,
        });
        buffer.push(DrawCommand::ResetViewport);
        buffer.push(DrawCommand::SetScissor {
            x: 10,
            y: 20,
            width: 100,
            height: 200,
        });
        buffer.push(DrawCommand::DisableScissor);
        buffer.push(DrawCommand::Triangles {
            vertices: vec![0.0; 18],
            matrix: [1.0; 16],
        });
        buffer.push(DrawCommand::Lines {
            vertices: vec![0.0; 12],
            matrix: [1.0; 16],
        });
        buffer.push(DrawCommand::Text {
            vertices: vec![0.0; 16],
            indices: vec![0, 1, 2],
            texture_uid: 1,
            matrix: [1.0; 16],
            viewport_scale: 1.0,
            font_scale: 1.0,
            distance_range: 0.5,
        });
        buffer.push(DrawCommand::Sprites {
            texture_id: 5,
            vertices: vec![0.0; 32],
            indices: vec![0, 1, 2, 0, 2, 3],
            matrix: [1.0; 16],
        });

        assert_eq!(buffer.len(), 9);
    }
}
