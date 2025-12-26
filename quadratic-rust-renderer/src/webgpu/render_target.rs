//! Render target for WebGPU render-to-texture operations
//!
//! Used to pre-render text hashes to sprite textures for efficient
//! rendering when zoomed out.

/// A render target with an attached color texture for render-to-texture operations
pub struct RenderTarget {
    /// The color texture
    pub texture: wgpu::Texture,
    /// Texture view for sampling (all mip levels)
    pub view: wgpu::TextureView,
    /// Texture view for rendering (base mip level only)
    pub render_view: wgpu::TextureView,
    /// Width in pixels
    pub width: u32,
    /// Height in pixels
    pub height: u32,
    /// Number of mip levels
    pub mip_level_count: u32,
}

impl RenderTarget {
    /// Create a new render target with the specified dimensions
    pub fn new(device: &wgpu::Device, width: u32, height: u32) -> Self {
        // Use BGRA8Unorm to match the surface/pipeline format
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Sprite Cache Texture"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Bgra8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT
                | wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let render_view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        Self {
            texture,
            view,
            render_view,
            width,
            height,
            mip_level_count: 1,
        }
    }

    /// Create a new render target with mipmap support
    pub fn new_with_mipmaps(device: &wgpu::Device, width: u32, height: u32) -> Self {
        // Calculate mip levels
        let mip_level_count = (width.max(height) as f32).log2().floor() as u32 + 1;

        // Use BGRA8Unorm to match the surface/pipeline format
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Sprite Cache Texture (mipmapped)"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Bgra8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT
                | wgpu::TextureUsages::TEXTURE_BINDING
                | wgpu::TextureUsages::COPY_DST
                | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });

        // View for sampling (all mip levels)
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        // View for rendering (base mip level only - required for render attachment)
        let render_view = texture.create_view(&wgpu::TextureViewDescriptor {
            base_mip_level: 0,
            mip_level_count: Some(1),
            ..Default::default()
        });

        Self {
            texture,
            view,
            render_view,
            width,
            height,
            mip_level_count,
        }
    }
}
