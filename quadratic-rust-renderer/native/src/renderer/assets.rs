//! Chart image and language icon management

use super::{
    DecodedChartInfo, LanguageIconInfo, NativeRenderer, CHART_IMAGE_TEXTURE_BASE,
    ICON_LEFT_PADDING, ICON_SIZE, ICON_TOP_PADDING,
};
use crate::request::{ChartImage, RenderRequest, TableNameIcon};

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
            let (rgba_data, width, height) = chart.decode_image()?;

            log::debug!(
                "Uploading chart image {} at ({}, {}): {}x{} -> texture UID {}",
                i,
                chart.x,
                chart.y,
                width,
                height,
                texture_uid
            );

            // Upload to GPU
            self.wgpu
                .upload_texture(texture_uid, width, height, &rgba_data)?;

            // Store decoded info with actual pixel dimensions
            self.chart_infos.push(DecodedChartInfo {
                x: chart.x,
                y: chart.y,
                width,
                height,
                texture_uid,
            });
        }

        Ok(())
    }

    /// Create sprite vertices for a chart image using decoded info
    ///
    /// Returns (vertices, indices) for the sprite pipeline.
    /// Vertex format: [x, y, u, v, r, g, b, a] per vertex
    pub(super) fn create_chart_sprite_from_info(
        &self,
        chart_info: &DecodedChartInfo,
        request: &RenderRequest,
    ) -> (Vec<f32>, Vec<u32>) {
        // Get world position from cell coordinates
        let (x, _) = request.offsets.column_position_size(chart_info.x);
        let (y, _) = request.offsets.row_position_size(chart_info.y);

        let x = x as f32;
        let y = y as f32;
        // Use actual decoded image dimensions
        let w = chart_info.width as f32;
        let h = chart_info.height as f32;

        // Create a quad (2 triangles)
        // Vertices: position (x, y), uv (u, v), color (r, g, b, a)
        // Color is white (1, 1, 1, 1) to show image as-is
        let vertices = vec![
            // Top-left
            x,
            y,
            0.0,
            0.0,
            1.0,
            1.0,
            1.0,
            1.0, // Top-right
            x + w,
            y,
            1.0,
            0.0,
            1.0,
            1.0,
            1.0,
            1.0, // Bottom-right
            x + w,
            y + h,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0, // Bottom-left
            x,
            y + h,
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
        let w = ICON_SIZE;
        let h = ICON_SIZE;

        // Create a quad (2 triangles)
        // Vertices: position (x, y), uv (u, v), color (r, g, b, a)
        // Color is white (1, 1, 1, 1) to show icon as-is
        let vertices = vec![
            // Top-left
            x,
            y,
            0.0,
            0.0,
            1.0,
            1.0,
            1.0,
            1.0, // Top-right
            x + w,
            y,
            1.0,
            0.0,
            1.0,
            1.0,
            1.0,
            1.0, // Bottom-right
            x + w,
            y + h,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0,
            1.0, // Bottom-left
            x,
            y + h,
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

    /// Clear language icon render list (but keep textures cached)
    pub fn clear_language_icons(&mut self) {
        self.language_icons.clear();
    }
}
