//! Chart image and language icon management

use super::{
    DecodedChartInfo, LanguageIconInfo, NativeRenderer, CHART_IMAGE_TEXTURE_BASE,
    ICON_LEFT_PADDING, ICON_SIZE, ICON_TOP_PADDING,
};
use crate::request::{decode_chart_image, ChartImage, RenderRequest, TableNameIcon};

/// Create sprite vertices and indices for a rectangle.
///
/// Returns (vertices, indices) for the sprite pipeline.
/// Vertex format: [x, y, u, v, r, g, b, a] per vertex (white color, full UVs).
#[inline]
fn create_rect_vertices(x: f32, y: f32, width: f32, height: f32) -> (Vec<f32>, Vec<u32>) {
    let vertices = vec![
        // Top-left
        x,
        y,
        0.0,
        0.0,
        1.0,
        1.0,
        1.0,
        1.0,
        // Top-right
        x + width,
        y,
        1.0,
        0.0,
        1.0,
        1.0,
        1.0,
        1.0,
        // Bottom-right
        x + width,
        y + height,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
        // Bottom-left
        x,
        y + height,
        0.0,
        1.0,
        1.0,
        1.0,
        1.0,
        1.0,
    ];

    // Two triangles: 0-1-2 and 0-2-3
    let indices = vec![0, 1, 2, 0, 2, 3];

    (vertices, indices)
}

impl NativeRenderer {
    /// Upload chart images as textures
    ///
    /// This must be called before render() to upload the chart image data.
    pub fn upload_chart_images(&mut self, chart_images: &[ChartImage]) -> anyhow::Result<()> {
        // Clear previous chart infos
        self.chart_infos.clear();

        for (i, chart) in chart_images.iter().enumerate() {
            let texture_uid = CHART_IMAGE_TEXTURE_BASE + i as u32;

            // Decode the image to get actual dimensions
            let (rgba_data, texture_width, texture_height) = decode_chart_image(chart)?;

            log::debug!(
                "Uploading chart image {} at ({}, {}): cell span {}x{}, texture {}x{} -> texture UID {}",
                i,
                chart.x,
                chart.y,
                chart.width,
                chart.height,
                texture_width,
                texture_height,
                texture_uid
            );

            // Upload to GPU
            self.wgpu
                .upload_texture(texture_uid, texture_width, texture_height, &rgba_data)?;

            // Store both cell span and texture dimensions for aspect-ratio-preserving rendering
            self.chart_infos.push(DecodedChartInfo {
                x: chart.x,
                y: chart.y,
                cell_width: chart.width,
                cell_height: chart.height,
                texture_width,
                texture_height,
                texture_uid,
            });
        }

        Ok(())
    }

    /// Create sprite vertices for a chart image using decoded info
    ///
    /// Returns (vertices, indices) for the sprite pipeline.
    /// Vertex format: [x, y, u, v, r, g, b, a] per vertex
    ///
    /// The chart is rendered to fit within the cell area it spans while
    /// preserving its aspect ratio (centered within the cell bounds).
    pub(super) fn create_chart_sprite_from_info(
        &self,
        chart_info: &DecodedChartInfo,
        request: &RenderRequest,
    ) -> (Vec<f32>, Vec<u32>) {
        // Calculate the world bounds of the cell area the chart spans
        let (start_x, _) = request.offsets.column_position_size(chart_info.x);
        let (start_y, _) = request.offsets.row_position_size(chart_info.y);

        // Get the end position (exclusive) of the cell span
        let end_col = chart_info.x + chart_info.cell_width as i64;
        let end_row = chart_info.y + chart_info.cell_height as i64;
        let (end_x, _) = request.offsets.column_position_size(end_col);
        let (end_y, _) = request.offsets.row_position_size(end_row);

        let cell_area_width = (end_x - start_x) as f32;
        let cell_area_height = (end_y - start_y) as f32;

        // Calculate aspect ratios
        let image_aspect = chart_info.texture_width as f32 / chart_info.texture_height as f32;
        let cell_aspect = cell_area_width / cell_area_height;

        // Fit the image within the cell area while preserving aspect ratio
        let (render_width, render_height) = if image_aspect > cell_aspect {
            // Image is wider than cell area - fit to width
            (cell_area_width, cell_area_width / image_aspect)
        } else {
            // Image is taller than cell area - fit to height
            (cell_area_height * image_aspect, cell_area_height)
        };

        // Center the image within the cell area
        let x = start_x as f32 + (cell_area_width - render_width) / 2.0;
        let y = start_y as f32 + (cell_area_height - render_height) / 2.0;

        create_rect_vertices(x, y, render_width, render_height)
    }

    /// Clear uploaded chart image textures
    pub fn clear_chart_images(&mut self) {
        for chart_info in &self.chart_infos {
            self.wgpu.remove_texture(chart_info.texture_uid);
        }
        self.chart_infos.clear();
    }

    /// Upload language icon textures
    ///
    /// Loads icon PNG files from the specified directory and uploads them as textures.
    /// Must be called before render() if you want language icons to appear.
    pub fn upload_language_icons(
        &mut self,
        icons: &[TableNameIcon],
        icons_dir: &std::path::Path,
    ) -> anyhow::Result<()> {
        // Clear previous icon render info
        self.language_icons.clear();

        for icon in icons {
            let Some(filename) = icon.icon_filename() else {
                continue; // No icon for this language type
            };

            let language_key = icon.language_key().to_string();

            // Check if texture already loaded for this language
            let texture_uid = if let Some(&uid) = self.language_icon_textures.get(&language_key) {
                uid
            } else {
                // Load and upload new texture
                let icon_path = icons_dir.join(filename);
                if !icon_path.exists() {
                    log::warn!("Language icon not found: {:?}", icon_path);
                    continue;
                }

                let png_bytes = std::fs::read(&icon_path)?;
                let img = image::load_from_memory(&png_bytes)?;
                let rgba = img.into_rgba8();
                let (width, height) = (rgba.width(), rgba.height());
                let data = rgba.into_raw();

                let uid = self.next_language_icon_id;
                self.next_language_icon_id += 1;

                log::debug!(
                    "Uploading language icon '{}': {}x{} -> texture UID {}",
                    language_key,
                    width,
                    height,
                    uid
                );

                self.wgpu.upload_texture(uid, width, height, &data)?;
                self.language_icon_textures.insert(language_key, uid);
                uid
            };

            // Add to render list
            self.language_icons.push(LanguageIconInfo {
                x: icon.x,
                y: icon.y,
                texture_uid,
            });
        }

        Ok(())
    }

    /// Create sprite vertices for a language icon
    ///
    /// Returns (vertices, indices) for the sprite pipeline.
    pub(super) fn create_icon_sprite(
        &self,
        icon_info: &LanguageIconInfo,
        request: &RenderRequest,
    ) -> (Vec<f32>, Vec<u32>) {
        // Get world position from cell coordinates
        let (cell_x, _) = request.offsets.column_position_size(icon_info.x);
        let (cell_y, _) = request.offsets.row_position_size(icon_info.y);

        // Position icon with padding from top-left of cell
        let x = cell_x as f32 + ICON_LEFT_PADDING;
        let y = cell_y as f32 + ICON_TOP_PADDING;

        create_rect_vertices(x, y, ICON_SIZE, ICON_SIZE)
    }

    /// Clear language icon render list (but keep textures cached)
    pub fn clear_language_icons(&mut self) {
        self.language_icons.clear();
    }
}
