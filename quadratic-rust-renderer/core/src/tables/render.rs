//! Table rendering using RenderContext
//!
//! Platform-agnostic table rendering functions.

use crate::primitives::{Color, NativeLines, Rects};
use crate::render_context::RenderContext;

use super::bounds::TableBounds;
use super::cache::TableCache;
use super::TABLE_WHITE;

/// Render output for tables
pub struct TableRenderOutput {
    /// Table name background rectangles
    pub name_backgrounds: Rects,
    /// Column header background rectangles
    pub column_backgrounds: Rects,
    /// Table outline lines
    pub outlines: NativeLines,
    /// Column header bottom lines
    pub header_lines: NativeLines,
}

impl TableRenderOutput {
    /// Create new empty output
    pub fn new() -> Self {
        Self {
            name_backgrounds: Rects::new(),
            column_backgrounds: Rects::new(),
            outlines: NativeLines::new(),
            header_lines: NativeLines::new(),
        }
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.name_backgrounds.is_empty()
            && self.column_backgrounds.is_empty()
            && self.outlines.is_empty()
            && self.header_lines.is_empty()
    }

    /// Render to a RenderContext
    pub fn render(&self, ctx: &mut impl RenderContext, matrix: &[f32; 16]) {
        // Draw backgrounds first
        self.name_backgrounds.render(ctx, matrix);
        self.column_backgrounds.render(ctx, matrix);

        // Draw lines on top
        self.outlines.render(ctx, matrix);
        self.header_lines.render(ctx, matrix);
    }
}

impl Default for TableRenderOutput {
    fn default() -> Self {
        Self::new()
    }
}

/// Build render output for visible tables
pub fn build_table_render_output(
    cache: &TableCache,
    viewport_left: f32,
    viewport_top: f32,
    viewport_right: f32,
    viewport_bottom: f32,
) -> TableRenderOutput {
    let mut output = TableRenderOutput::new();

    for table in cache.get_visible_tables(viewport_left, viewport_top, viewport_right, viewport_bottom) {
        let outline_color = table.outline_color();

        // Render name background
        if let Some(name_bounds) = &table.name_bounds {
            output.name_backgrounds.add(
                name_bounds.left(),
                name_bounds.top(),
                name_bounds.width,
                name_bounds.height,
                outline_color,
            );
        }

        // Render column headers background
        if let Some(headers_bounds) = &table.column_headers_bounds {
            output.column_backgrounds.add(
                headers_bounds.left(),
                headers_bounds.top(),
                headers_bounds.width,
                headers_bounds.height,
                TABLE_WHITE,
            );

            // Add line at bottom of column headers
            output.header_lines.add(
                headers_bounds.left(),
                headers_bounds.bottom(),
                headers_bounds.right(),
                headers_bounds.bottom(),
                outline_color,
            );
        }

        // Render table outline
        add_outline(&mut output.outlines, &table.table_bounds, outline_color);
    }

    output
}

/// Add outline lines around a bounds
fn add_outline(lines: &mut NativeLines, bounds: &TableBounds, color: Color) {
    let x = bounds.left();
    let y = bounds.top();
    let w = bounds.width;
    let h = bounds.height;

    // Top
    lines.add(x, y, x + w, y, color);
    // Bottom
    lines.add(x, y + h, x + w, y + h, color);
    // Left
    lines.add(x, y, x, y + h, color);
    // Right
    lines.add(x + w, y, x + w, y + h, color);
}
