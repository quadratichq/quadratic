//! Rust-native rendering types for the Rust renderer.
//!
//! This module produces `RenderCell`, `RenderFill`, and `RenderCodeCell` directly
//! from `quadratic-core-shared`, eliminating conversion overhead when communicating
//! with the Rust renderer.
//!
//! When the TypeScript renderer is fully deprecated, the `rendering/` module can
//! be deleted and this module can be renamed to `rendering/`.

mod cells;
mod code;
mod fills;
