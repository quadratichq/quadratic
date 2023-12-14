pub mod autocomplete;
/// This module manages all Operations for GridController.
/// Functions within this directory should create Operations but should not execute them.
/// Only execute_operations should change the Grid.
///
pub mod borders;
pub mod cells;
pub mod clipboard;
pub mod formatting;
pub mod import;
pub mod operation;
