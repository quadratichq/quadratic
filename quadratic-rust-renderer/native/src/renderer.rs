//! Native headless renderer using wgpu

use glam::Mat4;
use wgpu::*;

use quadratic_renderer_core::sheets::text::BitmapFonts;
use quadratic_renderer_core::types::{FillBuffer, LineBuffer};
use quadratic_renderer_core::WgpuRenderer;

use crate::image_export::ImageFormat;
use crate::request::RenderRequest;

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
}

impl NativeRenderer {
    /// Create a new headless renderer with the given output size
    pub fn new(width: u32, height: u32) -> anyhow::Result<Self> {
        // Create wgpu instance with all available backends
        let instance = Instance::new(InstanceDescriptor {
            backends: Backends::all(),
            ..Default::default()
        });

        // Request adapter (GPU or software fallback)
        let adapter = pollster::block_on(instance.request_adapter(&RequestAdapterOptions {
            power_preference: PowerPreference::HighPerformance,
            compatible_surface: None, // Headless - no surface needed
            force_fallback_adapter: false,
        }))
        .ok_or_else(|| anyhow::anyhow!("No GPU adapter found"))?;

        log::info!("Using GPU adapter: {:?}", adapter.get_info().name);

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
        })
    }

    /// Set the bitmap fonts for text rendering
    pub fn set_fonts(&mut self, fonts: BitmapFonts) {
        log::info!("Setting {} fonts", fonts.count());
        self.fonts = fonts;
    }

    /// Upload a font texture from PNG bytes
    pub fn upload_font_texture(&mut self, texture_uid: u32, png_bytes: &[u8]) -> anyhow::Result<()> {
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
        self.wgpu.upload_texture(texture_uid, width, height, &data)?;

        Ok(())
    }

    /// Check if fonts are loaded
    pub fn has_fonts(&self) -> bool {
        !self.fonts.is_empty()
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
                self.wgpu.draw_triangles(&mut pass, &fills.vertices, &matrix);
            }

            // Draw grid lines
            if let Some(ref lines) = grid_lines {
                if !lines.vertices.is_empty() {
                    self.wgpu.draw_lines(&mut pass, &lines.vertices, &matrix);
                }
            }

            // TODO: Draw text (requires font textures)
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
        crate::image_export::encode(
            &pixels,
            self.width,
            self.height,
            ImageFormat::Jpeg(quality),
        )
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
            let (x, w) = request.offsets.column_position_size(fill.col);
            let (y, h) = request.offsets.row_position_size(fill.row);
            buffer.add_rect(x as f32, y as f32, w as f32, h as f32, fill.color);
        }

        buffer
    }

    /// Create grid lines for visible area
    fn create_grid_lines(
        &self,
        request: &RenderRequest,
        viewport_x: f32,
        viewport_y: f32,
        scale: f32,
    ) -> LineBuffer {
        let mut buffer = LineBuffer::new();
        let color = [0.9, 0.9, 0.9, 1.0]; // Light gray

        // Calculate visible bounds
        let visible_width = self.width as f32 / scale;
        let visible_height = self.height as f32 / scale;
        let left = viewport_x;
        let top = viewport_y;
        let right = left + visible_width;
        let bottom = top + visible_height;

        // Get column range
        let (min_col, _) = request.offsets.column_from_x(left.max(0.0) as f64);
        let (max_col, _) = request.offsets.column_from_x(right.max(0.0) as f64);

        // Get row range
        let (min_row, _) = request.offsets.row_from_y(top.max(0.0) as f64);
        let (max_row, _) = request.offsets.row_from_y(bottom.max(0.0) as f64);

        // Vertical lines (column boundaries)
        for col in min_col..=max_col + 1 {
            let (x, _) = request.offsets.column_position_size(col);
            let x = x as f32;
            if x >= left && x <= right {
                buffer.add_line(x, top.max(0.0), x, bottom, color);
            }
        }

        // Horizontal lines (row boundaries)
        for row in min_row..=max_row + 1 {
            let (y, _) = request.offsets.row_position_size(row);
            let y = y as f32;
            if y >= top && y <= bottom {
                buffer.add_line(left.max(0.0), y, right, y, color);
            }
        }

        buffer
    }

    /// Get output dimensions
    pub fn dimensions(&self) -> (u32, u32) {
        (self.width, self.height)
    }
}
