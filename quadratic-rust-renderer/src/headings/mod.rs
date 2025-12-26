//! Grid Headings module
//!
//! Renders column headers (A, B, C...) and row headers (1, 2, 3...)
//! for the spreadsheet grid.
//!
//! Unlike the main grid content, headings are rendered in screen space
//! (fixed position) rather than world space.

mod column_headings;
mod grid_headings;
mod row_headings;
mod types;

pub use grid_headings::GridHeadings;
pub use types::{HeadingColors, HeadingSize};
