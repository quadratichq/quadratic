//! Native headless renderer using wgpu

use std::collections::HashMap;

use glam::Mat4;
use wgpu::*;

use quadratic_renderer_core::emoji_loader::EmojiSpritesheet;
use quadratic_renderer_core::sheets::text::{BitmapFonts, CellLabel, EmojiCharData, LabelMesh};
use quadratic_renderer_core::types::{FillBuffer, LineBuffer};
use quadratic_renderer_core::{
    calculate_clip_bounds, GridLines, SheetBordersRender, WgpuRenderer, GRID_LINE_COLOR,
};

use crate::image_export::ImageFormat;
use crate::request::{ChartImage, RenderRequest, TableNameIcon};

/// Base texture ID for chart images (to avoid collision with font textures)
const CHART_IMAGE_TEXTURE_BASE: u32 = 10000;

/// Base texture ID for language icons
const LANGUAGE_ICON_TEXTURE_BASE: u32 = 20000;

/// Icon size in pixels (icons are rendered at this size)
const ICON_SIZE: f32 = 14.0;

/// Vertical padding from top of row
const ICON_TOP_PADDING: f32 = 4.0;

/// Horizontal padding from left of cell
const ICON_LEFT_PADDING: f32 = 4.0;

/// Decoded chart image info (position and actual pixel dimensions)
struct DecodedChartInfo {
    x: i64,
    y: i64,
    width: u32,
    height: u32,
    texture_uid: u32,
}

/// Language icon info for rendering
struct LanguageIconInfo {
    x: i64,
    y: i64,
    texture_uid: u32,
}

/// Native headless renderer
///
/// Uses wgpu to render to an offscreen texture, which can then be
/// exported to PNG or JPEG.
pub struct NativeRenderer {
    wgpu: WgpuRenderer,
    render_texture: Texture,
    width: u32,
    height: u32,
    fonts: BitmapFonts,
    /// Decoded chart image info (with actual pixel dimensions)
    chart_infos: Vec<DecodedChartInfo>,
    /// Language icon texture IDs (keyed by language name)
    language_icon_textures: HashMap<String, u32>,
    /// Next available language icon texture ID
    next_language_icon_id: u32,
    /// Language icons to render (populated during upload)
    language_icons: Vec<LanguageIconInfo>,
    /// Emoji spritesheet (optional, for emoji rendering)
    emoji_spritesheet: Option<EmojiSpritesheet>,
}

impl NativeRenderer {
    /// Create a new headless renderer with the given output size
    pub fn new(width: u32, height: u32) -> anyhow::Result<Self> {
        // Create wgpu instance with all available backends
        let instance = Instance::new(InstanceDescriptor {
            backends: Backends::all(),
            ..Default::default()
        });

        // Try to get a GPU adapter first, fall back to CPU if not available
        let adapter = pollster::block_on(instance.request_adapter(&RequestAdapterOptions {
            power_preference: PowerPreference::HighPerformance,
            compatible_surface: None, // Headless - no surface needed
            force_fallback_adapter: false,
        }))
        .or_else(|| {
            log::info!("No GPU adapter found, trying CPU fallback...");
            pollster::block_on(instance.request_adapter(&RequestAdapterOptions {
                power_preference: PowerPreference::LowPower,
                compatible_surface: None,
                force_fallback_adapter: true,
            }))
        })
        .ok_or_else(|| anyhow::anyhow!("No GPU or CPU adapter found"))?;

        log::info!("Using adapter: {:?} ({:?})", adapter.get_info().name, adapter.get_info().backend);

        // Request device and queue
        let (device, queue) = pollster::block_on(adapter.request_device(
            &DeviceDescriptor {
                label: Some("Native Renderer Device"),
                required_features: Features::empty(),
                required_limits: Limits::default(),
                memory_hints: MemoryHints::default(),
            },
            None,
        ))?;

        // Create render target texture
        let format = TextureFormat::Rgba8Unorm;
        let render_texture = device.create_texture(&TextureDescriptor {
            label: Some("Render Target"),
            size: Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: TextureDimension::D2,
            format,
            usage: TextureUsages::RENDER_ATTACHMENT | TextureUsages::COPY_SRC,
            view_formats: &[],
        });

        // Create shared wgpu renderer from core
        let wgpu = WgpuRenderer::new(device, queue, format);

        Ok(Self {
            wgpu,
            render_texture,
            width,
            height,
            fonts: BitmapFonts::new(),
            chart_infos: Vec::new(),
            language_icon_textures: HashMap::new(),
            next_language_icon_id: LANGUAGE_ICON_TEXTURE_BASE,
            language_icons: Vec::new(),
            emoji_spritesheet: None,
        })
    }

    /// Set the bitmap fonts for text rendering
    pub fn set_fonts(&mut self, fonts: BitmapFonts) {
        log::info!("Setting {} fonts", fonts.count());
        self.fonts = fonts;
    }

    /// Upload a font texture from PNG bytes
    pub fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        png_bytes: &[u8],
    ) -> anyhow::Result<()> {
        // Decode the PNG image
        let img = image::load_from_memory(png_bytes)?;
        let rgba = img.into_rgba8();
        let (width, height) = (rgba.width(), rgba.height());
        let data = rgba.into_raw();

        log::info!(
            "Uploading font texture UID {} ({}x{}, {} bytes)",
            texture_uid,
            width,
            height,
            data.len()
        );

        // Upload to wgpu
        self.wgpu
            .upload_texture(texture_uid, width, height, &data)?;

        Ok(())
    }

    /// Check if fonts are loaded
    pub fn has_fonts(&self) -> bool {
        !self.fonts.is_empty()
    }

    /// Set the emoji spritesheet for emoji rendering
    pub fn set_emoji_spritesheet(&mut self, spritesheet: EmojiSpritesheet) {
        log::info!(
            "Setting emoji spritesheet with {} emojis, {} pages",
            spritesheet.emoji_count(),
            spritesheet.page_count()
        );
        self.emoji_spritesheet = Some(spritesheet);
    }

    /// Check if emoji spritesheet is loaded
    pub fn has_emoji_spritesheet(&self) -> bool {
        self.emoji_spritesheet.is_some()
    }

    /// Upload an emoji texture from PNG bytes
    pub fn upload_emoji_texture(
        &mut self,
        texture_uid: u32,
        png_bytes: &[u8],
    ) -> anyhow::Result<()> {
        // Decode the PNG image
        let img = image::load_from_memory(png_bytes)?;
        let rgba = img.into_rgba8();
        let (width, height) = (rgba.width(), rgba.height());
        let data = rgba.into_raw();

        log::info!(
            "Uploading emoji texture UID {} ({}x{})",
            texture_uid,
            width,
            height
        );

        // Upload to wgpu
        self.wgpu
            .upload_texture(texture_uid, width, height, &data)?;

        Ok(())
    }

    /// Resize the render target
    pub fn resize(&mut self, width: u32, height: u32) {
        if width == self.width && height == self.height {
            return;
        }

        self.render_texture = self.wgpu.device().create_texture(&TextureDescriptor {
            label: Some("Render Target"),
            size: Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: TextureDimension::D2,
            format: self.wgpu.target_format(),
            usage: TextureUsages::RENDER_ATTACHMENT | TextureUsages::COPY_SRC,
            view_formats: &[],
        });

        self.width = width;
        self.height = height;
    }

    /// Render a request and return raw RGBA pixels
    pub fn render(&mut self, request: &RenderRequest) -> anyhow::Result<Vec<u8>> {
        // Resize if needed
        self.resize(request.width, request.height);

        // Calculate viewport
        let (viewport_x, viewport_y, scale) = request.calculate_viewport();

        // Create view-projection matrix
        let matrix = self.create_matrix(viewport_x, viewport_y, scale);

        // Create render data from request
        let background = self.create_background(request);
        let fills = self.create_fills(request);
        let grid_lines = if request.show_grid_lines {
            Some(self.create_grid_lines(request, viewport_x, viewport_y, scale))
        } else {
            None
        };

        // Render
        let view = self
            .render_texture
            .create_view(&TextureViewDescriptor::default());

        let mut encoder = self
            .wgpu
            .device()
            .create_command_encoder(&CommandEncoderDescriptor {
                label: Some("Render Encoder"),
            });

        {
            let bg = request.background();
            let mut pass = encoder.begin_render_pass(&RenderPassDescriptor {
                label: Some("Main Pass"),
                color_attachments: &[Some(RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: Operations {
                        load: LoadOp::Clear(Color {
                            r: bg[0] as f64,
                            g: bg[1] as f64,
                            b: bg[2] as f64,
                            a: bg[3] as f64,
                        }),
                        store: StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            // Draw background (in-bounds area)
            if !background.vertices.is_empty() {
                self.wgpu
                    .draw_triangles(&mut pass, &background.vertices, &matrix);
            }

            // Draw fills
            if !fills.vertices.is_empty() {
                self.wgpu
                    .draw_triangles(&mut pass, &fills.vertices, &matrix);
            }

            // Draw grid lines
            if let Some(ref lines) = grid_lines {
                if !lines.vertices.is_empty() {
                    self.wgpu.draw_lines(&mut pass, &lines.vertices, &matrix);
                }
            }

            // Draw borders (on top of grid lines)
            if !request.borders.is_empty() {
                let border_lines = request.borders.to_line_buffer(
                    &request.offsets,
                    request.selection.start_col,
                    request.selection.start_row,
                    request.selection.end_col,
                    request.selection.end_row,
                );
                if !border_lines.vertices.is_empty() {
                    log::info!(
                        "Drawing {} border line vertices",
                        border_lines.vertices.len() / 12
                    );
                    self.wgpu
                        .draw_lines(&mut pass, &border_lines.vertices, &matrix);
                }
            }

            // Draw table outlines (on top of borders)
            if !request.table_outlines.is_empty() {
                let (outline_lines, name_bgs, col_bgs) =
                    request.table_outlines.to_render_buffers(&request.offsets);

                // Draw name backgrounds first (under text)
                if !name_bgs.vertices.is_empty() {
                    log::info!("Drawing table name backgrounds");
                    self.wgpu
                        .draw_triangles(&mut pass, &name_bgs.vertices, &matrix);
                }

                // Draw column header backgrounds
                if !col_bgs.vertices.is_empty() {
                    log::info!("Drawing table column header backgrounds");
                    self.wgpu
                        .draw_triangles(&mut pass, &col_bgs.vertices, &matrix);
                }

                // Draw outline lines
                if !outline_lines.vertices.is_empty() {
                    log::info!(
                        "Drawing {} table outline lines",
                        outline_lines.vertices.len() / 12
                    );
                    self.wgpu
                        .draw_lines(&mut pass, &outline_lines.vertices, &matrix);
                }
            }

            // Draw text and collect emoji data
            let mut emojis_to_render: Vec<EmojiCharData> = Vec::new();
            if !request.cells.is_empty() && !self.fonts.is_empty() {
                let (meshes, atlas_font_size, distance_range, emojis) =
                    self.create_text_meshes(request);
                emojis_to_render = emojis;

                log::info!(
                    "Text geometry: {} meshes, {} emojis, atlas_font_size={}, distance_range={}, viewport_scale={}",
                    meshes.len(),
                    emojis_to_render.len(),
                    atlas_font_size,
                    distance_range,
                    scale
                );
                for mesh in &meshes {
                    if !mesh.is_empty() {
                        let vertices = mesh.get_vertex_data();
                        let font_scale = mesh.font_size / atlas_font_size;
                        log::debug!(
                            "Drawing text mesh: texture_uid={}, font_scale={}, vertices={}, indices={}",
                            mesh.texture_uid,
                            font_scale,
                            vertices.len(),
                            mesh.indices.len()
                        );
                        self.wgpu.draw_text(
                            &mut pass,
                            &vertices,
                            &mesh.indices,
                            mesh.texture_uid,
                            &matrix,
                            scale,
                            font_scale,
                            distance_range,
                        );
                    }
                }
            }

            // Draw emoji sprites
            if !emojis_to_render.is_empty() {
                if let Some(ref spritesheet) = self.emoji_spritesheet {
                    // Group emojis by texture page
                    let mut emoji_sprites_by_texture: HashMap<u32, (Vec<f32>, Vec<u32>)> =
                        HashMap::new();

                    for emoji in &emojis_to_render {
                        if let Some(uv) = spritesheet.get_emoji_uv(&emoji.emoji) {
                            let entry = emoji_sprites_by_texture
                                .entry(uv.texture_uid)
                                .or_insert_with(|| (Vec::new(), Vec::new()));

                            let vertex_offset = (entry.0.len() / 8) as u32;

                            // Create quad vertices
                            // Position: centered on (emoji.x, emoji.y)
                            let half_w = emoji.width / 2.0;
                            let half_h = emoji.height / 2.0;
                            let x1 = emoji.x - half_w;
                            let y1 = emoji.y - half_h;
                            let x2 = emoji.x + half_w;
                            let y2 = emoji.y + half_h;

                            let [u0, v0, u1, v1] = uv.uvs;

                            // White color (show emoji as-is)
                            let r = 1.0f32;
                            let g = 1.0f32;
                            let b = 1.0f32;
                            let a = 1.0f32;

                            // Top-left
                            entry.0.extend_from_slice(&[x1, y1, u0, v0, r, g, b, a]);
                            // Top-right
                            entry.0.extend_from_slice(&[x2, y1, u1, v0, r, g, b, a]);
                            // Bottom-right
                            entry.0.extend_from_slice(&[x2, y2, u1, v1, r, g, b, a]);
                            // Bottom-left
                            entry.0.extend_from_slice(&[x1, y2, u0, v1, r, g, b, a]);

                            // Indices for two triangles
                            entry.1.push(vertex_offset);
                            entry.1.push(vertex_offset + 1);
                            entry.1.push(vertex_offset + 2);
                            entry.1.push(vertex_offset);
                            entry.1.push(vertex_offset + 2);
                            entry.1.push(vertex_offset + 3);
                        }
                    }

                    // Draw emoji sprites by texture
                    for (texture_uid, (vertices, indices)) in &emoji_sprites_by_texture {
                        if self.wgpu.has_texture(*texture_uid) {
                            log::debug!(
                                "Drawing {} emojis with texture {}",
                                indices.len() / 6,
                                texture_uid
                            );
                            self.wgpu.draw_sprites(
                                &mut pass,
                                *texture_uid,
                                vertices,
                                indices,
                                &matrix,
                            );
                        }
                    }
                }
            }

            // Draw language icons (on table name backgrounds)
            for icon_info in &self.language_icons {
                if self.wgpu.has_texture(icon_info.texture_uid) {
                    let (vertices, indices) = self.create_icon_sprite(icon_info, request);
                    self.wgpu.draw_sprites(
                        &mut pass,
                        icon_info.texture_uid,
                        &vertices,
                        &indices,
                        &matrix,
                    );
                }
            }

            // Draw chart images (on top of everything)
            for chart_info in &self.chart_infos {
                if self.wgpu.has_texture(chart_info.texture_uid) {
                    let (vertices, indices) = self.create_chart_sprite_from_info(chart_info, request);
                    log::info!(
                        "Drawing chart image at ({}, {}): {}x{} pixels",
                        chart_info.x,
                        chart_info.y,
                        chart_info.width,
                        chart_info.height
                    );
                    self.wgpu.draw_sprites(
                        &mut pass,
                        chart_info.texture_uid,
                        &vertices,
                        &indices,
                        &matrix,
                    );
                }
            }
        }

        self.wgpu.queue().submit(std::iter::once(encoder.finish()));

        // Read pixels back
        self.read_pixels()
    }

    /// Render and export to PNG
    pub fn render_to_png(&mut self, request: &RenderRequest) -> anyhow::Result<Vec<u8>> {
        let pixels = self.render(request)?;
        crate::image_export::encode(&pixels, self.width, self.height, ImageFormat::Png)
    }

    /// Render and export to JPEG
    pub fn render_to_jpeg(
        &mut self,
        request: &RenderRequest,
        quality: u8,
    ) -> anyhow::Result<Vec<u8>> {
        let pixels = self.render(request)?;
        crate::image_export::encode(&pixels, self.width, self.height, ImageFormat::Jpeg(quality))
    }

    /// Read pixels from the render texture
    fn read_pixels(&self) -> anyhow::Result<Vec<u8>> {
        // Create staging buffer with proper alignment
        // wgpu requires bytes_per_row to be aligned to 256
        let bytes_per_row = (self.width * 4).next_multiple_of(256);
        let buffer_size = (bytes_per_row * self.height) as u64;

        let staging_buffer = self.wgpu.device().create_buffer(&BufferDescriptor {
            label: Some("Staging Buffer"),
            size: buffer_size,
            usage: BufferUsages::COPY_DST | BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        // Copy texture to buffer
        let mut encoder = self
            .wgpu
            .device()
            .create_command_encoder(&CommandEncoderDescriptor::default());

        encoder.copy_texture_to_buffer(
            ImageCopyTexture {
                texture: &self.render_texture,
                mip_level: 0,
                origin: Origin3d::ZERO,
                aspect: TextureAspect::All,
            },
            ImageCopyBuffer {
                buffer: &staging_buffer,
                layout: ImageDataLayout {
                    offset: 0,
                    bytes_per_row: Some(bytes_per_row),
                    rows_per_image: Some(self.height),
                },
            },
            Extent3d {
                width: self.width,
                height: self.height,
                depth_or_array_layers: 1,
            },
        );

        self.wgpu.queue().submit(std::iter::once(encoder.finish()));

        // Map and read the buffer
        let buffer_slice = staging_buffer.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        buffer_slice.map_async(MapMode::Read, move |result| {
            tx.send(result).unwrap();
        });

        self.wgpu.device().poll(Maintain::Wait);
        rx.recv()??;

        let data = buffer_slice.get_mapped_range();

        // Remove row padding (copy only actual pixel data)
        let mut pixels = Vec::with_capacity((self.width * self.height * 4) as usize);
        for row in 0..self.height {
            let start = (row * bytes_per_row) as usize;
            let end = start + (self.width * 4) as usize;
            pixels.extend_from_slice(&data[start..end]);
        }

        drop(data);
        staging_buffer.unmap();

        Ok(pixels)
    }

    /// Create the view-projection matrix
    fn create_matrix(&self, viewport_x: f32, viewport_y: f32, scale: f32) -> [f32; 16] {
        let view = Mat4::from_scale_rotation_translation(
            glam::Vec3::new(scale, scale, 1.0),
            glam::Quat::IDENTITY,
            glam::Vec3::new(-viewport_x * scale, -viewport_y * scale, 0.0),
        );

        let projection =
            Mat4::orthographic_rh(0.0, self.width as f32, self.height as f32, 0.0, -1.0, 1.0);

        (projection * view).to_cols_array()
    }

    /// Create background fill for the selection area
    fn create_background(&self, request: &RenderRequest) -> FillBuffer {
        let mut buffer = FillBuffer::new();
        let (x, y, w, h) = request.selection.world_bounds(&request.offsets);
        buffer.add_rect(x, y, w, h, request.background());
        buffer
    }

    /// Create fill rectangles from request
    fn create_fills(&self, request: &RenderRequest) -> FillBuffer {
        let mut buffer = FillBuffer::new();
        buffer.reserve(request.fills.len());

        for fill in &request.fills {
            // Get screen rectangle from cell coordinates
            let (x, _) = request.offsets.column_position_size(fill.x);
            let (y, _) = request.offsets.row_position_size(fill.y);

            // Calculate width and height by getting the end position
            let (x_end, w_end) = request
                .offsets
                .column_position_size(fill.x + fill.w as i64 - 1);
            let (y_end, h_end) = request
                .offsets
                .row_position_size(fill.y + fill.h as i64 - 1);

            let width = (x_end + w_end - x) as f32;
            let height = (y_end + h_end - y) as f32;

            buffer.add_rect(x as f32, y as f32, width, height, fill.color.to_f32_array());
        }

        buffer
    }

    /// Create grid lines for visible area
    ///
    /// Uses core's GridLines::generate_for_bounds() and adds selection-edge handling
    /// to ensure boundary lines are visible at viewport edges.
    fn create_grid_lines(
        &self,
        request: &RenderRequest,
        viewport_x: f32,
        viewport_y: f32,
        scale: f32,
    ) -> LineBuffer {
        // Calculate visible bounds from viewport
        let visible_width = self.width as f32 / scale;
        let visible_height = self.height as f32 / scale;
        let left = viewport_x;
        let top = viewport_y;
        let right = left + visible_width;
        let bottom = top + visible_height;

        // Generate base grid lines from core
        let mut buffer = GridLines::generate_for_bounds(left, top, right, bottom, &request.offsets);

        // Selection boundary handling for screenshots:
        // When the selection edge is at the viewport edge, we need to offset by 0.5px
        // so the line is fully visible (not half-clipped)
        let (sel_left, _) = request
            .offsets
            .column_position_size(request.selection.start_col);
        let sel_left = sel_left as f32;

        let (sel_top, _) = request
            .offsets
            .row_position_size(request.selection.start_row);
        let sel_top = sel_top as f32;

        // Add offset lines at selection boundaries if they're at viewport edges
        if (sel_left - left).abs() < 0.01 && sel_left >= left && sel_left <= right {
            buffer.add_line(
                sel_left + 0.5,
                top.max(0.0),
                sel_left + 0.5,
                bottom,
                GRID_LINE_COLOR,
            );
        }
        if (sel_top - top).abs() < 0.01 && sel_top >= top && sel_top <= bottom {
            buffer.add_line(
                left.max(0.0),
                sel_top + 0.5,
                right,
                sel_top + 0.5,
                GRID_LINE_COLOR,
            );
        }

        buffer
    }

    /// Get output dimensions
    pub fn dimensions(&self) -> (u32, u32) {
        (self.width, self.height)
    }

    /// Create text meshes from request using CellLabel from core
    ///
    /// Returns (meshes, atlas_font_size, distance_range) for MSDF rendering.
    /// Create text meshes and collect emoji data from cell labels
    ///
    /// Returns (meshes, atlas_font_size, distance_range, emojis)
    fn create_text_meshes(
        &self,
        request: &RenderRequest,
    ) -> (Vec<LabelMesh>, f32, f32, Vec<EmojiCharData>) {
        let default_font = self.fonts.default_font();
        let Some(font) = default_font else {
            return (Vec::new(), 14.0, 4.0, Vec::new());
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

            // Layout the text (computes glyph positions and overflow values)
            label.layout(&self.fonts);

            labels.push(label);
        }

        // Second pass: Calculate clip bounds for text overflow
        // This ensures overflowing text is clipped by neighboring cell content
        calculate_clip_bounds(&mut labels);

        // Third pass: Generate meshes and collect emojis from clipped labels
        let mut mesh_map: HashMap<u32, LabelMesh> = HashMap::new();
        let mut all_emojis: Vec<EmojiCharData> = Vec::new();

        for mut label in labels {
            // Collect emoji data from this label
            let emojis = label.get_emoji_chars(&self.fonts);
            all_emojis.extend(emojis);

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

        (
            mesh_map.into_values().collect(),
            atlas_font_size,
            distance_range,
            all_emojis,
        )
    }

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

            log::info!(
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
    fn create_chart_sprite_from_info(
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
            x, y, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0,
            // Top-right
            x + w, y, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0,
            // Bottom-right
            x + w, y + h, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
            // Bottom-left
            x, y + h, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0,
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

                log::info!(
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
    fn create_icon_sprite(
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
            x, y, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0,
            // Top-right
            x + w, y, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0,
            // Bottom-right
            x + w, y + h, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
            // Bottom-left
            x, y + h, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0,
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
