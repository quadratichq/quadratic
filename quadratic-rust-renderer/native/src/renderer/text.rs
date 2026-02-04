//! Text mesh creation

use std::collections::HashMap;

use quadratic_renderer_core::calculate_clip_bounds;
use quadratic_renderer_core::sheets::text::{CellLabel, EmojiCharData, HorizontalLine, LabelMesh};
use quadratic_renderer_core::FillBuffer;

use super::NativeRenderer;
use crate::request::RenderRequest;

impl NativeRenderer {
    /// Create text meshes from request using CellLabel from core
    ///
    /// Returns (meshes, atlas_font_size, distance_range, emojis, horizontal_lines)
    pub(super) fn create_text_meshes(
        &self,
        request: &RenderRequest,
    ) -> (Vec<LabelMesh>, f32, f32, Vec<EmojiCharData>, FillBuffer) {
        let default_font = self.fonts.default_font();
        let Some(font) = default_font else {
            return (Vec::new(), 14.0, 4.0, Vec::new(), FillBuffer::new());
        };

        let atlas_font_size = font.size;
        let distance_range = font.distance_range;

        // First pass: Create and layout all labels
        let mut labels: Vec<CellLabel> = Vec::with_capacity(request.cells.len());

        for cell in &request.cells {
            // Skip empty cells
            if cell.value.is_empty() {
                continue;
            }

            // Create CellLabel from RenderCell (handles all styling)
            let mut label = CellLabel::from_render_cell(cell);

            // Set cell bounds from offsets
            label.update_bounds(&request.offsets);

            // Layout the text with emoji support (computes glyph positions and overflow values)
            if let Some(ref spritesheet) = self.emoji_spritesheet {
                label.layout_with_emojis(&self.fonts, Some(spritesheet));
            } else {
                label.layout(&self.fonts);
            }

            labels.push(label);
        }

        // Second pass: Calculate clip bounds for text overflow
        // This ensures overflowing text is clipped by neighboring cell content
        calculate_clip_bounds(&mut labels);

        // Third pass: Generate meshes, emojis, and horizontal lines from clipped labels
        let mut mesh_map: HashMap<u32, LabelMesh> = HashMap::new();
        let mut all_emojis: Vec<EmojiCharData> = Vec::new();
        let mut all_lines: Vec<HorizontalLine> = Vec::new();

        for mut label in labels {
            // Collect emoji data from this label
            let emojis = label.get_emoji_chars(&self.fonts);
            all_emojis.extend(emojis);

            // Collect horizontal lines (underlines/strikethroughs)
            let lines = label.get_horizontal_lines(&self.fonts);
            all_lines.extend(lines.iter().cloned());

            // Merge meshes by texture_uid
            for mesh in label.get_meshes(&self.fonts) {
                if let Some(existing) = mesh_map.get_mut(&mesh.texture_uid) {
                    // Merge vertices and indices
                    let offset = existing.vertices.len() as u32;
                    existing.vertices.extend(mesh.vertices.iter().cloned());
                    for &idx in &mesh.indices {
                        existing.indices.push(idx + offset);
                    }
                } else {
                    mesh_map.insert(mesh.texture_uid, mesh.clone());
                }
            }
        }

        // Convert horizontal lines to fill buffer
        let mut lines_buffer = FillBuffer::new();
        for line in &all_lines {
            lines_buffer.add_rect(line.x, line.y, line.width, line.height, line.color);
        }

        (
            mesh_map.into_values().collect(),
            atlas_font_size,
            distance_range,
            all_emojis,
            lines_buffer,
        )
    }
}
