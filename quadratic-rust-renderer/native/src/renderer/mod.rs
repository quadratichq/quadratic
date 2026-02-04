//! Native headless renderer using wgpu

mod assets;
mod export;
mod fonts;
mod geometry;
mod render_pass;
mod text;

use std::collections::HashMap;

use wgpu::{
    Backends, DeviceDescriptor, Extent3d, Features, Instance, InstanceDescriptor, Limits,
    MemoryHints, PowerPreference, RequestAdapterOptions, Texture, TextureDescriptor,
    TextureDimension, TextureFormat, TextureUsages,
};

use quadratic_renderer_core::emoji_loader::EmojiSpritesheet;
use quadratic_renderer_core::sheets::text::BitmapFonts;
use quadratic_renderer_core::WgpuRenderer;

/// Base texture ID for chart images (to avoid collision with font textures)
pub(super) const CHART_IMAGE_TEXTURE_BASE: u32 = 10000;

/// Base texture ID for language icons
pub(super) const LANGUAGE_ICON_TEXTURE_BASE: u32 = 20000;

/// Icon size in pixels (icons are rendered at this size)
pub(super) const ICON_SIZE: f32 = 14.0;

/// Vertical padding from top of row
pub(super) const ICON_TOP_PADDING: f32 = 4.0;

/// Horizontal padding from left of cell
pub(super) const ICON_LEFT_PADDING: f32 = 4.0;

/// Decoded chart image info (position, cell span, and texture dimensions)
pub(super) struct DecodedChartInfo {
    /// X position in cell coordinates
    pub x: i64,
    /// Y position in cell coordinates
    pub y: i64,
    /// Width in cells (how many columns the chart spans)
    pub cell_width: u32,
    /// Height in cells (how many rows the chart spans)
    pub cell_height: u32,
    /// Texture width in pixels (for aspect ratio preservation)
    pub texture_width: u32,
    /// Texture height in pixels (for aspect ratio preservation)
    pub texture_height: u32,
    pub texture_uid: u32,
}

/// Language icon info for rendering
pub(super) struct LanguageIconInfo {
    pub x: i64,
    pub y: i64,
    pub texture_uid: u32,
}

/// Native headless renderer
///
/// Uses wgpu to render to an offscreen texture, which can then be
/// exported to PNG or JPEG.
pub struct NativeRenderer {
    pub(super) wgpu: WgpuRenderer,
    pub(super) render_texture: Texture,
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) fonts: BitmapFonts,
    /// Decoded chart image info (with actual pixel dimensions)
    pub(super) chart_infos: Vec<DecodedChartInfo>,
    /// Language icon texture IDs (keyed by language name)
    pub(super) language_icon_textures: HashMap<String, u32>,
    /// Next available language icon texture ID
    pub(super) next_language_icon_id: u32,
    /// Language icons to render (populated during upload)
    pub(super) language_icons: Vec<LanguageIconInfo>,
    /// Emoji spritesheet (optional, for emoji rendering)
    pub(super) emoji_spritesheet: Option<EmojiSpritesheet>,
    /// Directory containing emoji PNG files (for lazy loading)
    pub(super) emoji_directory: Option<std::path::PathBuf>,
    /// Set of emoji texture pages that have been uploaded
    pub(super) uploaded_emoji_pages: std::collections::HashSet<u32>,
}

impl NativeRenderer {
    /// Create a new headless renderer with the given output size
    pub fn new(width: u32, height: u32) -> anyhow::Result<Self> {
        if width == 0 || height == 0 {
            return Err(anyhow::anyhow!(
                "Invalid renderer dimensions: {}x{}",
                width,
                height
            ));
        }

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

        log::info!(
            "Using adapter: {:?} ({:?})",
            adapter.get_info().name,
            adapter.get_info().backend
        );

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
            emoji_directory: None,
            uploaded_emoji_pages: std::collections::HashSet::new(),
        })
    }

    /// Resize the render target
    pub fn resize(&mut self, width: u32, height: u32) {
        if width == 0 || height == 0 || (width == self.width && height == self.height) {
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

    /// Get output dimensions
    pub fn dimensions(&self) -> (u32, u32) {
        (self.width, self.height)
    }
}
