//! Render Backend using core's WgpuRenderContext
//!
//! This provides GPU rendering using wgpu, which supports:
//! - WebGPU (modern browsers: Chrome 113+, Firefox 127+, Safari 18+)
//! - WebGL2 (fallback for older browsers via wgpu's GL backend)
//!
//! The backend automatically selects the best available option.

use wasm_bindgen::prelude::*;
use web_sys::OffscreenCanvas;

use quadratic_renderer_core::RenderContext;
use quadratic_renderer_core::wgpu_backend::{WgpuBackend, WgpuRenderContext};

/// Which rendering backend is active
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackendType {
    /// WebGPU (native wgpu WebGPU backend)
    WebGPU,
    /// WebGL2 (wgpu's GL backend)
    WebGL,
}

impl From<WgpuBackend> for BackendType {
    fn from(backend: WgpuBackend) -> Self {
        match backend {
            WgpuBackend::WebGpu => BackendType::WebGPU,
            WgpuBackend::Gl => BackendType::WebGL,
            // All other backends (Vulkan, Metal, DX12) shouldn't appear in WASM
            _ => BackendType::WebGPU,
        }
    }
}

/// Unified render backend wrapping core's WgpuRenderContext
pub struct RenderBackend {
    ctx: WgpuRenderContext,
    backend_type: BackendType,
}

impl RenderBackend {
    /// Check if WebGPU is available in this browser
    pub fn is_webgpu_available() -> bool {
        // Check via navigator.gpu using js_sys
        let global = js_sys::global();

        let navigator =
            js_sys::Reflect::get(&global, &wasm_bindgen::JsValue::from_str("navigator"))
                .unwrap_or(wasm_bindgen::JsValue::UNDEFINED);

        if navigator.is_undefined() || navigator.is_null() {
            return false;
        }

        let gpu = js_sys::Reflect::get(&navigator, &wasm_bindgen::JsValue::from_str("gpu"))
            .unwrap_or(wasm_bindgen::JsValue::UNDEFINED);

        !gpu.is_undefined() && !gpu.is_null()
    }

    /// Create a renderer from an OffscreenCanvas
    ///
    /// Automatically selects WebGPU if available, falling back to WebGL2.
    pub async fn create(canvas: OffscreenCanvas) -> Result<Self, JsValue> {
        let width = canvas.width();
        let height = canvas.height();

        // Try WebGPU first, fall back to WebGL2
        let backends = if Self::is_webgpu_available() {
            wgpu::Backends::BROWSER_WEBGPU
        } else {
            wgpu::Backends::GL
        };

        log::info!(
            "Creating renderer ({}x{}) with backends: {:?}",
            width,
            height,
            backends
        );

        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends,
            ..Default::default()
        });

        // Create surface from OffscreenCanvas
        let surface = instance
            .create_surface(wgpu::SurfaceTarget::OffscreenCanvas(canvas))
            .map_err(|e| JsValue::from_str(&format!("Failed to create surface: {:?}", e)))?;

        // Request adapter
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .ok_or_else(|| JsValue::from_str("No suitable GPU adapter found"))?;

        let adapter_info = adapter.get_info();
        log::info!("GPU adapter: {:?}", adapter_info);

        // Determine backend type from adapter
        let wgpu_backend = match adapter_info.backend {
            wgpu::Backend::BrowserWebGpu => WgpuBackend::WebGpu,
            wgpu::Backend::Gl => WgpuBackend::Gl,
            wgpu::Backend::Vulkan => WgpuBackend::Vulkan,
            wgpu::Backend::Metal => WgpuBackend::Metal,
            wgpu::Backend::Dx12 => WgpuBackend::Dx12,
            _ => WgpuBackend::Other,
        };

        // Request device with WebGL2-compatible limits for maximum compatibility
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("Quadratic Renderer"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::downlevel_webgl2_defaults(),
                    memory_hints: wgpu::MemoryHints::Performance,
                },
                None,
            )
            .await
            .map_err(|e| JsValue::from_str(&format!("Failed to create device: {:?}", e)))?;

        // Configure surface
        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps
            .formats
            .iter()
            .find(|f| f.is_srgb())
            .copied()
            .unwrap_or(surface_caps.formats[0]);

        let alpha_mode = if surface_caps
            .alpha_modes
            .contains(&wgpu::CompositeAlphaMode::PreMultiplied)
        {
            wgpu::CompositeAlphaMode::PreMultiplied
        } else {
            surface_caps.alpha_modes[0]
        };

        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width,
            height,
            present_mode: wgpu::PresentMode::Fifo,
            alpha_mode,
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &config);

        // Create core's WgpuRenderContext
        let ctx = WgpuRenderContext::new(device, queue, surface, config, wgpu_backend);

        Ok(Self {
            ctx,
            backend_type: wgpu_backend.into(),
        })
    }

    /// Get the backend type
    pub fn backend_type(&self) -> BackendType {
        self.backend_type
    }

    /// Get the backend name as a string
    pub fn backend_name(&self) -> &'static str {
        self.ctx.backend_name()
    }

    /// Resize the rendering surface
    pub fn resize(&mut self, width: u32, height: u32) {
        self.ctx.resize(width, height);
    }

    /// Get current width
    pub fn width(&self) -> u32 {
        self.ctx.width()
    }

    /// Get current height
    pub fn height(&self) -> u32 {
        self.ctx.height()
    }

    /// Get mutable reference to the render context
    pub fn context_mut(&mut self) -> &mut WgpuRenderContext {
        &mut self.ctx
    }

    /// Get reference to the render context
    pub fn context(&self) -> &WgpuRenderContext {
        &self.ctx
    }

    /// Check if a font texture is loaded
    pub fn has_font_texture(&self, texture_uid: u32) -> bool {
        self.ctx.has_font_texture(texture_uid)
    }

    /// Upload a font texture from raw RGBA pixel data
    pub fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        self.ctx
            .upload_font_texture(texture_uid, width, height, data)
            .map_err(|e| JsValue::from_str(&e.0))
    }

    /// Check if a sprite texture is loaded
    pub fn has_sprite_texture(&self, texture_id: u32) -> bool {
        self.ctx.has_sprite_texture(texture_id)
    }

    /// Upload a sprite texture from raw RGBA pixel data
    pub fn upload_sprite_texture(
        &mut self,
        texture_id: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        self.ctx
            .upload_sprite_texture(texture_id, width, height, data)
            .map_err(|e| JsValue::from_str(&e.0))
    }

    /// Remove a sprite texture
    pub fn remove_sprite_texture(&mut self, texture_id: u32) {
        self.ctx.remove_sprite_texture(texture_id);
    }
}
