//! WebGPU-specific texture storage
//!
//! Backend-specific texture handle management for WebGPU.
//! Shared primitive types are in `crate::primitives`.

pub mod texture;

pub use texture::{TextureId, TextureInfo, TextureManager};
