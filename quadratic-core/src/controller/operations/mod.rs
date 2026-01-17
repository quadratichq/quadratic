//! This module manages all Operations for GridController.
//! Functions within this directory should create Operations but should not execute them.
//! Only execute_operations should change the Grid.

pub mod autocomplete;
pub mod borders;
pub mod cell_value;
pub mod clipboard;
pub mod code_cell;
mod csv;
pub mod data_table;
pub mod format_painter;
pub mod formats;
pub mod import;
pub mod merge_cells;
pub mod operation;
pub mod sheets;
pub mod tracked_operation;
