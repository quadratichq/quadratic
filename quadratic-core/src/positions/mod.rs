//! Position types for referencing cells on sheets and within tables.
//!
//! This module provides a hierarchy of position types:
//! - [`Pos`] - A cell position on a sheet (x, y coordinates)
//! - [`SheetPos`] - A position with sheet context (Pos + SheetId)
//! - [`TablePos`] - A position within a data table (parent table anchor + relative position)
//! - [`MultiPos`] - Either a sheet position or a table position
//! - [`MultiSheetPos`] - A MultiPos with sheet context

mod multi_pos;
mod multi_sheet_pos;
mod table_pos;

pub use multi_pos::*;
pub use multi_sheet_pos::*;
pub use table_pos::*;
