//! Render Backend abstraction
//!
//! Provides a unified interface for WebGL and WebGPU rendering backends.
//! The worker automatically detects WebGPU availability and falls back to WebGL.

use wasm_bindgen::prelude::*;
use web_sys::OffscreenCanvas;

use crate::webgl::WebGLContext;
use crate::webgpu::WebGPUContext;

/// Which rendering backend is active
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackendType {
    WebGL,
    WebGPU,
}

/// Unified render backend that wraps either WebGL or WebGPU
pub enum RenderBackend {
    WebGL(WebGLContext),
    WebGPU(WebGPUContext),
}

impl RenderBackend {
    /// Check if WebGPU is available
    pub fn is_webgpu_available() -> bool {
        WebGPUContext::is_available()
    }

    /// Create a WebGL backend (synchronous)
    pub fn create_webgl(canvas: OffscreenCanvas) -> Result<Self, JsValue> {
        let ctx = WebGLContext::from_offscreen_canvas(canvas)?;
        Ok(RenderBackend::WebGL(ctx))
    }

    /// Create a WebGPU backend (async)
    pub async fn create_webgpu(canvas: OffscreenCanvas) -> Result<Self, JsValue> {
        let ctx = WebGPUContext::from_offscreen_canvas(canvas).await?;
        Ok(RenderBackend::WebGPU(ctx))
    }

    /// Get the backend type
    pub fn backend_type(&self) -> BackendType {
        match self {
            RenderBackend::WebGL(_) => BackendType::WebGL,
            RenderBackend::WebGPU(_) => BackendType::WebGPU,
        }
    }

    /// Resize the rendering surface
    pub fn resize(&mut self, width: u32, height: u32) {
        match self {
            RenderBackend::WebGL(ctx) => ctx.resize(width, height),
            RenderBackend::WebGPU(ctx) => ctx.resize(width, height),
        }
    }

    /// Get current width
    pub fn width(&self) -> u32 {
        match self {
            RenderBackend::WebGL(ctx) => ctx.width(),
            RenderBackend::WebGPU(ctx) => ctx.width(),
        }
    }

    /// Get current height
    pub fn height(&self) -> u32 {
        match self {
            RenderBackend::WebGL(ctx) => ctx.height(),
            RenderBackend::WebGPU(ctx) => ctx.height(),
        }
    }

    /// Check if a font texture is loaded
    pub fn has_font_texture(&self, texture_uid: u32) -> bool {
        match self {
            RenderBackend::WebGL(ctx) => ctx.has_font_texture(texture_uid),
            RenderBackend::WebGPU(ctx) => ctx.has_font_texture(texture_uid),
        }
    }

    /// Upload a font texture from raw RGBA pixel data
    pub fn upload_font_texture_from_data(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        match self {
            RenderBackend::WebGL(ctx) => {
                ctx.upload_font_texture_from_data(texture_uid, width, height, data)
            }
            RenderBackend::WebGPU(ctx) => {
                ctx.upload_font_texture_from_data(texture_uid, width, height, data)
            }
        }
    }

    /// Get reference to WebGL context (if available)
    pub fn as_webgl(&self) -> Option<&WebGLContext> {
        match self {
            RenderBackend::WebGL(ctx) => Some(ctx),
            RenderBackend::WebGPU(_) => None,
        }
    }

    /// Get mutable reference to WebGL context (if available)
    pub fn as_webgl_mut(&mut self) -> Option<&mut WebGLContext> {
        match self {
            RenderBackend::WebGL(ctx) => Some(ctx),
            RenderBackend::WebGPU(_) => None,
        }
    }

    /// Get reference to WebGPU context (if available)
    pub fn as_webgpu(&self) -> Option<&WebGPUContext> {
        match self {
            RenderBackend::WebGL(_) => None,
            RenderBackend::WebGPU(ctx) => Some(ctx),
        }
    }

    /// Get mutable reference to WebGPU context (if available)
    pub fn as_webgpu_mut(&mut self) -> Option<&mut WebGPUContext> {
        match self {
            RenderBackend::WebGL(_) => None,
            RenderBackend::WebGPU(ctx) => Some(ctx),
        }
    }
}
