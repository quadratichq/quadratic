//! Export and pixel reading methods

use wgpu::{
    BufferDescriptor, BufferUsages, CommandEncoderDescriptor, Extent3d, ImageCopyBuffer,
    ImageCopyTexture, ImageDataLayout, Maintain, MapMode, Origin3d, TextureAspect,
};

use super::NativeRenderer;
use crate::image_export::ImageFormat;
use crate::request::RenderRequest;

impl NativeRenderer {
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

    /// Render and export to WebP (lossless)
    pub fn render_to_webp(&mut self, request: &RenderRequest) -> anyhow::Result<Vec<u8>> {
        let pixels = self.render(request)?;
        crate::image_export::encode(&pixels, self.width, self.height, ImageFormat::Webp)
    }

    /// Render and export to the specified format
    pub fn render_to_format(
        &mut self,
        request: &RenderRequest,
        format: ImageFormat,
    ) -> anyhow::Result<Vec<u8>> {
        let pixels = self.render(request)?;
        crate::image_export::encode(&pixels, self.width, self.height, format)
    }

    /// Read pixels from the render texture
    pub(super) fn read_pixels(&self) -> anyhow::Result<Vec<u8>> {
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
            let _ = tx.send(result);
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
}
