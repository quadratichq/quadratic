//! Rust-native code cell rendering that produces RenderCodeCell directly.
//!
//! This mirrors the logic in `rendering/code.rs` but produces `RenderCodeCell`
//! from `quadratic-core-shared` directly, eliminating conversion overhead.

use crate::{
    CellValue, Pos, Value,
    grid::{CodeCellLanguage, DataTable, DataTableKind, Sheet},
};
use quadratic_core_shared::{RenderCodeCell, RenderCodeCellState, RenderColumnHeader};

impl Sheet {
    /// Returns data for rendering a code cell (Rust-native version).
    fn rust_render_code_cell(&self, pos: Pos, data_table: &DataTable) -> Option<RenderCodeCell> {
        let output_size = data_table.output_size();
        let (state, w, h) = if data_table.has_spill() {
            (
                RenderCodeCellState::SpillError,
                output_size.w.get(),
                output_size.h.get(),
            )
        } else if data_table.has_error()
            || matches!(data_table.value, Value::Single(CellValue::Error(_)))
        {
            (RenderCodeCellState::RunError, 1, 1)
        } else {
            let state = if data_table.is_image() {
                RenderCodeCellState::Image
            } else if data_table.is_html() {
                RenderCodeCellState::Html
            } else {
                RenderCodeCellState::Success
            };
            (state, output_size.w.get(), output_size.h.get())
        };

        let alternating_colors = !data_table.has_spill()
            && !data_table.has_error()
            && !data_table.is_image()
            && !data_table.is_html()
            && data_table.alternating_colors;

        let language = match &data_table.kind {
            DataTableKind::CodeRun(code) => code.language.to_owned(),
            DataTableKind::Import(_) => CodeCellLanguage::Import,
        };

        // Convert column headers to RenderColumnHeader
        let columns: Vec<RenderColumnHeader> = data_table
            .send_columns()
            .into_iter()
            .map(|col| RenderColumnHeader {
                name: col.name,
                display: col.display,
                value_index: col.value_index,
            })
            .collect();

        Some(RenderCodeCell {
            x: pos.x as i32,
            y: pos.y as i32,
            w,
            h,
            language,
            state,
            name: data_table.name().to_string(),
            columns,
            first_row_header: data_table.header_is_first_row,
            show_name: data_table.get_show_name(),
            show_columns: data_table.get_show_columns(),
            alternating_colors,
            is_code: data_table.is_code(),
            is_html: data_table.is_html(),
            is_html_image: data_table.is_html() || data_table.is_image(),
        })
    }

    /// Returns a single code cell for rendering (Rust-native version).
    pub fn get_rust_render_code_cell(&self, pos: Pos) -> Option<RenderCodeCell> {
        let data_table = self.data_table_at(&pos)?;
        self.rust_render_code_cell(pos, data_table)
    }

    /// Returns all render code cells (tables) in the sheet (Rust-native version).
    pub fn get_rust_all_render_code_cells(&self) -> Vec<RenderCodeCell> {
        self.data_tables
            .expensive_iter()
            .filter_map(|(pos, data_table)| self.rust_render_code_cell(*pos, data_table))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        controller::GridController,
        grid::{CodeRun, DataTableKind},
    };

    #[test]
    fn test_rust_render_code_cell() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let pos = (0, 0).into();
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "1 + 1".to_string(),
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single(CellValue::Number(2.into())),
            false,
            None,
            None,
            None,
        );

        sheet.set_data_table(pos, Some(data_table));
        let rendering = sheet.get_rust_render_code_cell(pos);

        assert!(rendering.is_some());
        let cell = rendering.unwrap();
        assert_eq!(cell.x, 0);
        assert_eq!(cell.y, 0);
        assert_eq!(cell.w, 1);
        assert_eq!(cell.h, 1);
        assert_eq!(cell.language, CodeCellLanguage::Python);
        assert_eq!(cell.state, RenderCodeCellState::Success);
        assert_eq!(cell.name, "Table 1");
        assert!(cell.columns.is_empty()); // single values don't have column headers
        assert!(!cell.first_row_header);
        assert!(!cell.show_name); // single values don't show name by default
        assert!(!cell.show_columns);
        assert!(cell.alternating_colors);
        assert!(cell.is_code);
        assert!(!cell.is_html);
        assert!(!cell.is_html_image);
    }

    #[test]
    fn test_rust_get_all_render_code_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        // Initially no code cells
        assert!(sheet.get_rust_all_render_code_cells().is_empty());

        // Add a code cell
        let pos = (5, 5).into();
        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: "test".to_string(),
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "JS Table",
            Value::Single(CellValue::Text("result".to_string())),
            false,
            Some(true),
            Some(true),
            None,
        );

        sheet.set_data_table(pos, Some(data_table));

        let cells = sheet.get_rust_all_render_code_cells();
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].x, 5);
        assert_eq!(cells[0].y, 5);
        assert_eq!(cells[0].language, CodeCellLanguage::Javascript);
        assert_eq!(cells[0].name, "JS Table");
    }
}
