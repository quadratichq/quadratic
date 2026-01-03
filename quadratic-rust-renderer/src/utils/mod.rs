//! Utility modules

pub mod color;
pub mod math;

// Re-export console_logger from shared crate
#[cfg(feature = "wasm")]
pub use quadratic_rust_renderer_shared::console_logger;
