//! Native Renderer for Quadratic
//!
//! Provides server-side / headless rendering using wgpu with native GPU backends.
//! Used for:
//! - Thumbnail generation
//! - Export to image (PNG, JPEG, WebP)
//! - Server-side rendering in cloud workers
//!
//! # Usage
//!
//! ```rust,ignore
//! use quadratic_renderer_native::{NativeRenderer, RenderRequest, SelectionRange};
//!
//! // Create renderer
//! let mut renderer = NativeRenderer::new(800, 600)?;
//!
//! // Define what to render
//! let request = RenderRequest {
//!     selection: SelectionRange::new(1, 1, 10, 20), // cols 1-10, rows 1-20
//!     width: 800,
//!     height: 600,
//!     scale: 1.0,
//!     // ... sheet data
//! };
//!
//! // Render to PNG
//! let png_bytes = renderer.render_to_png(&request)?;
//! ```

mod grid_render;
mod image_export;
mod renderer;
mod request;

pub use grid_render::{prepare_renderer_for_request, AssetPaths};
pub use image_export::ImageFormat;
pub use renderer::NativeRenderer;
pub use request::{
    build_render_request, ChartImage, GridExclusionZone, RenderRequest, SelectionRange,
    TableNameIcon,
};

// Re-export core types that users might need
pub use quadratic_renderer_core::{
    BorderLineStyle, CoreState, FillBuffer, HashRenderData, HorizontalBorder, LayoutEngine,
    LineBuffer, RenderBatch, SheetBorders, TableOutline, TableOutlines, TextBuffer, VerticalBorder,
};

/// Convenience function: render a selection to PNG bytes
///
/// This is the simplest API for one-off rendering.
pub fn render_selection_to_png(request: &RenderRequest) -> anyhow::Result<Vec<u8>> {
    let mut renderer = NativeRenderer::new(request.width, request.height)?;
    renderer.render_to_png(request)
}

/// Convenience function: render a selection to JPEG bytes
pub fn render_selection_to_jpeg(request: &RenderRequest, quality: u8) -> anyhow::Result<Vec<u8>> {
    let mut renderer = NativeRenderer::new(request.width, request.height)?;
    renderer.render_to_jpeg(request, quality)
}

/// Convenience function: render a selection to WebP bytes
pub fn render_selection_to_webp(request: &RenderRequest) -> anyhow::Result<Vec<u8>> {
    let mut renderer = NativeRenderer::new(request.width, request.height)?;
    renderer.render_to_webp(request)
}
