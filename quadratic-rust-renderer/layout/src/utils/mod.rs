//! Utility modules

pub mod color;

// Re-export console_logger from shared crate
#[cfg(feature = "wasm")]
pub use quadratic_renderer_core::console_logger;
