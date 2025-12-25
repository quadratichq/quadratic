//! Grid Headings module
//!
//! Renders column headers (A, B, C...) and row headers (1, 2, 3...)
//! for the spreadsheet grid.
//!
//! Unlike the main grid content, headings are rendered in screen space
//! (fixed position) rather than world space.

mod grid_headings;

pub use grid_headings::{GridHeadings, HeadingColors, HeadingSize};
