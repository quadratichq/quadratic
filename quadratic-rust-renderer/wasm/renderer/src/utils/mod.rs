//! Utility modules

// Re-export console_logger from core crate
#[cfg(feature = "wasm")]
pub use quadratic_renderer_core::console_logger;
