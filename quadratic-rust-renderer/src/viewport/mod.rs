//! Viewport module - camera/view management
//!
//! Equivalent to the viewport/ folder in gridGL/pixiApp/

mod decelerate;
mod viewport;

pub use decelerate::{Decelerate, DecelerateOptions};
pub use viewport::{Viewport, SNAP_BACK_MAX_DISTANCE, SNAP_BACK_VELOCITY};
