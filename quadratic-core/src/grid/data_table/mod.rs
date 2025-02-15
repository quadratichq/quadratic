//! CodeRun is the output of a CellValue::Code or CellValue::Import type
//!
//! This lives in sheet.data_tables. CodeRun is optional within sheet.data_tables for
//! any given CellValue::Code type (ie, if it doesn't exist then a run hasn't been
//! performed yet).

pub mod column;
pub mod column_header;
pub mod display_value;
pub mod formats;
pub mod row;
pub mod send_render;
pub mod sort;

use std::num::NonZeroU32;

use crate::cellvalue::Import;
use crate::grid::CodeRun;
use crate::util::unique_name;
use crate::{
    Array, ArraySize, CellValue, Pos, Rect, RunError, RunErrorMsg, SheetPos, SheetRect, Value,
};
use anyhow::{anyhow, bail, Ok, Result};
use chrono::{DateTime, Utc};
use column_header::DataTableColumnHeader;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use sort::DataTableSort;
use strum_macros::Display;

#[cfg(test)]
use tabled::{
    builder::Builder,
    settings::{Color, Modify, Style},
};

use super::sheet::borders::Borders;
use super::{CodeRunOld, CodeRunResult, Grid, SheetFormatting, SheetId};

impl Grid {
    pub fn data_table(&self, sheet_id: SheetId, pos: Pos) -> Result<&DataTable> {
        self.try_sheet_result(sheet_id)?.data_table_result(pos)
    }

    /// Returns a unique name for the data table, taking into account its
    /// Returns a unique name for the data table, taking into account its
    /// position on the sheet (so it doesn't conflict with itself).
    pub fn unique_data_table_name(
        &self,
        name: &str,
        require_number: bool,
        sheet_pos: Option<SheetPos>,
    ) -> String {
        let all_names = &self
            .sheets()
            .iter()
            .flat_map(|sheet| {
                sheet.data_tables.iter().filter_map(|(pos, dt)| {
                    if let Some(sheet_pos) = sheet_pos {
                        if sheet.id != sheet_pos.sheet_id || pos != &sheet_pos.into() {
                            Some(dt.name.to_display())
                        } else {
                            None
                        }
                    } else {
                        Some(dt.name.to_display())
                    }
                })
            })
            .collect_vec();

        let name = unique_name(name, all_names, require_number);

        // replace spaces with underscores
        name.replace(' ', "_")
    }

    pub fn update_data_table_name(
        &mut self,
        sheet_pos: SheetPos,
        old_name: &str,
        new_name: &str,
        require_number: bool,
    ) -> Result<()> {
        let unique_name = self.unique_data_table_name(new_name, require_number, Some(sheet_pos));

        self.replace_table_name_in_code_cells(old_name, &unique_name);

        let sheet = self
            .try_sheet_mut(sheet_pos.sheet_id)
            .ok_or_else(|| anyhow!("Sheet {} not found", sheet_pos.sheet_id))?;

        sheet
            .data_table_mut(sheet_pos.into())?
            .update_table_name(&unique_name);

        Ok(())
    }

    /// Returns a unique name for a data table
    pub fn next_data_table_name(&self) -> String {
        self.unique_data_table_name("Table", true, None)
    }

    /// Replaces the table name in all code cells that reference the old name in all sheets in the grid.
    pub fn replace_table_name_in_code_cells(&mut self, old_name: &str, new_name: &str) {
        for sheet in self.sheets.iter_mut() {
            sheet.replace_table_name_in_code_cells(old_name, new_name);
        }
    }

    pub fn replace_data_table_column_name_in_code_cells(&mut self, old_name: &str, new_name: &str) {
        for sheet in self.sheets.iter_mut() {
            sheet.replace_data_table_column_name_in_code_cells(old_name, new_name);
        }
    }
}

#[allow(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Display)]
pub enum DataTableKind {
    CodeRun(CodeRun),
    Import(Import),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DataTable {
    pub kind: DataTableKind,
    pub name: CellValue,
    pub header_is_first_row: bool,
    pub column_headers: Option<Vec<DataTableColumnHeader>>,
    pub sort: Option<Vec<DataTableSort>>,
    pub display_buffer: Option<Vec<u64>>,
    pub value: Value,
    pub readonly: bool,
    pub spill_error: bool,
    pub last_modified: DateTime<Utc>,
    pub alternating_colors: bool,
    pub formats: SheetFormatting,
    pub borders: Borders,

    pub show_ui: bool,
    pub show_name: bool,
    pub show_columns: bool,

    // width and height of the chart (html or image) output
    pub chart_pixel_output: Option<(f32, f32)>,
    pub chart_output: Option<(u32, u32)>,
}

impl From<(Import, Array, &Grid)> for DataTable {
    fn from((import, cell_values, grid): (Import, Array, &Grid)) -> Self {
        let name = grid.unique_data_table_name(&import.file_name, false, None);

        DataTable::new(
            DataTableKind::Import(import),
            &name,
            Value::Array(cell_values),
            false,
            false,
            true,
            None,
        )
    }
}

impl From<CodeRunOld> for DataTable {
    fn from(code_run_old: CodeRunOld) -> Self {
        let value = match code_run_old.result.to_owned() {
            CodeRunResult::Ok(value) => value,
            CodeRunResult::Err(_) => Value::Single(CellValue::Blank),
        };

        DataTable::new(
            DataTableKind::CodeRun(code_run_old.into()),
            "Table1",
            value,
            false,
            false,
            true,
            None,
        )
    }
}

impl DataTable {
    /// Creates a new DataTable with the given kind, value, and spill_error,
    /// with the ability to lift the first row as column headings.
    /// This handles the most common use cases.  Use `new_raw` for more control.
    pub fn new(
        kind: DataTableKind,
        name: &str,
        value: Value,
        spill_error: bool,
        header_is_first_row: bool,
        show_ui: bool,
        chart_pixel_output: Option<(f32, f32)>,
    ) -> Self {
        let readonly = match kind {
            DataTableKind::CodeRun(_) => true,
            DataTableKind::Import(_) => false,
        };

        let mut data_table = DataTable {
            kind,
            name: name.into(),
            header_is_first_row,
            chart_pixel_output,
            value,
            readonly,
            spill_error,
            last_modified: Utc::now(),
            alternating_colors: true,

            show_ui,
            show_name: true,
            show_columns: true,

            column_headers: None,
            sort: None,
            formats: Default::default(),
            borders: Default::default(),
            display_buffer: None,
            chart_output: None,
        };

        if header_is_first_row {
            data_table.apply_first_row_as_header();
        } else {
            data_table.apply_default_header();
        }

        data_table
    }

    /// Apply a new last modified date to the DataTable.
    pub fn with_last_modified(mut self, last_modified: DateTime<Utc>) -> Self {
        self.last_modified = last_modified;
        self
    }

    /// Adds column headers to the DataTable.
    pub fn with_column_headers(mut self, column_headers: Vec<DataTableColumnHeader>) -> Self {
        self.column_headers = Some(column_headers);
        self
    }

    /// Sets the show_columns flag.
    pub fn with_show_columns(mut self, show_columns: bool) -> Self {
        self.show_columns = show_columns;
        self
    }

    pub fn update_table_name(&mut self, name: &str) {
        self.name = name.into();
    }

    pub fn value_ref(&self) -> Result<Vec<&CellValue>> {
        match &self.value {
            Value::Single(value) => Ok(vec![value]),
            Value::Array(array) => Ok(array.cell_values_slice().iter().collect()),
            Value::Tuple(_) => bail!("Expected an array"),
        }
    }

    pub fn width(&self) -> usize {
        match &self.value {
            Value::Single(_) => 1,
            Value::Array(array) => array.width() as usize,
            Value::Tuple(_) => 0,
        }
    }

    pub fn height(&self, force_table_bounds: bool) -> usize {
        match &self.value {
            Value::Single(_) => 1,
            Value::Array(array) => {
                if force_table_bounds {
                    array.height() as usize
                } else {
                    (array.height() as i64 + self.y_adjustment(true)) as usize
                }
            }
            Value::Tuple(_) => 0,
        }
    }

    /// Helper function to get the CodeRun from the DataTable.
    /// Returns `None` if the DataTableKind is not CodeRun.
    pub fn code_run(&self) -> Option<&CodeRun> {
        match self.kind {
            DataTableKind::CodeRun(ref code_run) => Some(code_run),
            _ => None,
        }
    }

    /// Helper function to get the CodeRun from the DataTable.
    /// Returns `None` if the DataTableKind is not CodeRun.
    pub fn code_run_mut(&mut self) -> Option<&mut CodeRun> {
        match &mut self.kind {
            DataTableKind::CodeRun(ref mut code_run) => Some(code_run),
            _ => None,
        }
    }

    /// Helper function to determine if the DataTable's CodeRun has an error.
    /// Returns `false` if the DataTableKind is not CodeRun or if there is no error.
    pub fn has_error(&self) -> bool {
        match self.kind {
            DataTableKind::CodeRun(ref code_run) => code_run.error.is_some(),
            _ => false,
        }
    }

    /// Helper function to get the error in the CodeRun from the DataTable.
    /// Returns `None` if the DataTableKind is not CodeRun or if there is no error.
    pub fn get_error(&self) -> Option<RunError> {
        self.code_run()
            .and_then(|code_run| code_run.error.to_owned())
    }

    /// Returns the output value of a code run at the relative location (ie, (0,0) is the top of the code run result).
    /// A spill or error returns [`CellValue::Blank`]. Note: this assumes a [`CellValue::Code`] exists at the location.
    pub fn cell_value_at(&self, x: u32, y: u32) -> Option<CellValue> {
        if self.spill_error || self.has_error() {
            Some(CellValue::Blank)
        } else {
            self.display_value_at((x, y).into()).ok().cloned()
        }
    }

    /// Returns the output value of a code run at the relative location (ie, (0,0) is the top of the code run result).
    /// A spill or error returns `None`. Note: this assumes a [`CellValue::Code`] exists at the location.
    pub fn cell_value_ref_at(&self, x: u32, y: u32) -> Option<&CellValue> {
        if self.spill_error || self.has_error() {
            None
        } else {
            self.display_value_at((x, y).into()).ok()
        }
    }

    /// Returns the cell value at a relative location (0-indexed) into the code
    /// run output, for use when a formula references a cell.
    pub fn get_cell_for_formula(&self, x: u32, y: u32) -> CellValue {
        if self.spill_error {
            CellValue::Blank
        } else {
            match &self.value {
                Value::Single(v) => v.clone(),
                Value::Array(a) => a.get(x, y).cloned().unwrap_or(CellValue::Blank),
                Value::Tuple(_) => CellValue::Error(Box::new(
                    // should never happen
                    RunErrorMsg::InternalError("tuple saved as code run result".into())
                        .without_span(),
                )),
            }
        }
    }

    /// Sets the cell value at a relative location (0-indexed) into the code.
    /// Returns `false` if the value cannot be set.
    pub fn set_cell_value_at(&mut self, x: u32, y: u32, value: CellValue) -> bool {
        if !self.spill_error && !self.has_error() {
            match self.value {
                Value::Single(_) => {
                    self.value = Value::Single(value);
                }
                Value::Array(ref mut a) => {
                    if let Err(error) = a.set(x, y, value) {
                        dbgjs!(format!("Unable to set cell value at ({x}, {y}): {error}"));
                        return false;
                    }
                }
                Value::Tuple(_) => {}
            }

            return true;
        }

        false
    }

    /// Returns the size of the output array, or defaults to `_1X1` (since
    /// output always includes the code_cell). This is the full size of the
    /// output, including any the table name and column names, if visible.
    ///
    /// Note: this does not take spill_error into account.
    pub fn output_size(&self) -> ArraySize {
        if let Some((w, h)) = self.chart_output {
            if w == 0 || h == 0 {
                ArraySize::_1X1
            } else {
                ArraySize::new(w, h + 1).unwrap_or(ArraySize::_1X1)
            }
        } else {
            match &self.value {
                Value::Array(a) => {
                    let mut size = a.size();

                    let mut height = size.h.get();
                    height = height.saturating_add_signed(self.y_adjustment(true) as i32);

                    size.h = NonZeroU32::new(height).unwrap_or(ArraySize::_1X1.h);

                    let width = self.columns_to_show().len();
                    size.w = NonZeroU32::new(width as u32).unwrap_or(ArraySize::_1X1.w);

                    size
                }
                Value::Single(_) | Value::Tuple(_) => {
                    let mut height: u32 = 1;
                    height = height.saturating_add_signed(self.y_adjustment(true) as i32);
                    ArraySize::new(1, height).unwrap_or(ArraySize::_1X1)
                }
            }
        }
    }

    pub fn is_html(&self) -> bool {
        if let Value::Single(value) = &self.value {
            matches!(value, CellValue::Html(_))
        } else {
            false
        }
    }

    pub fn is_image(&self) -> bool {
        if let Value::Single(value) = &self.value {
            matches!(value, CellValue::Image(_))
        } else {
            false
        }
    }

    pub fn is_html_or_image(&self) -> bool {
        if let Value::Single(value) = &self.value {
            matches!(value, CellValue::Html(_) | CellValue::Image(_))
        } else {
            false
        }
    }

    /// returns a SheetRect for the output size of a code cell (defaults to 1x1)
    /// Note: this returns a 1x1 if there is a spill_error.
    pub fn output_sheet_rect(&self, sheet_pos: SheetPos, ignore_spill_error: bool) -> SheetRect {
        if !ignore_spill_error && (self.spill_error || self.has_error()) {
            SheetRect::from_sheet_pos_and_size(sheet_pos, ArraySize::_1X1)
        } else {
            SheetRect::from_sheet_pos_and_size(sheet_pos, self.output_size())
        }
    }

    /// returns a SheetRect for the output size of a code cell (defaults to 1x1)
    /// Note: this returns a 1x1 if there is a spill_error.
    pub fn output_rect(&self, pos: Pos, ignore_spill_error: bool) -> Rect {
        if !ignore_spill_error && (self.spill_error || self.has_error()) {
            Rect::from_pos_and_size(pos, ArraySize::_1X1)
        } else {
            Rect::from_pos_and_size(pos, self.output_size())
        }
    }

    pub fn value_as_array(&self) -> Result<&Array> {
        match &self.value {
            Value::Array(array) => Ok(array),
            _ => bail!("Expected an array"),
        }
    }

    pub fn mut_value_as_array(&mut self) -> Result<&mut Array> {
        match &mut self.value {
            Value::Array(array) => Ok(array),
            _ => bail!("Expected an array"),
        }
    }

    /// Pretty print a data table for testing
    #[cfg(test)]
    pub fn pretty_print_data_table(
        data_table: &DataTable,
        title: Option<&str>,
        max: Option<usize>,
    ) -> String {
        let mut builder = Builder::default();
        let array = data_table
            .display_value(false)
            .unwrap()
            .into_array()
            .unwrap();
        let max = max.unwrap_or(array.height() as usize);
        let title = title.unwrap_or("Data Table");
        let display_buffer = data_table
            .display_buffer
            .clone()
            .unwrap_or((0..array.height() as u64).collect::<Vec<_>>());

        for (index, row) in array.rows().take(max).enumerate() {
            let row = row.iter().map(|s| s.to_string()).collect::<Vec<_>>();
            let display_index = vec![display_buffer[index].to_string()];

            if index == 0 && data_table.column_headers.is_some() {
                let headers = data_table
                    .column_headers
                    .as_ref()
                    .unwrap()
                    .iter()
                    .filter(|h| h.display)
                    .map(|h| h.name.to_string())
                    .collect::<Vec<_>>();
                builder.set_header([display_index, headers].concat());
            } else if index == 0 && data_table.header_is_first_row {
                let row = [display_index, row].concat();
                builder.set_header(row);
            } else {
                let row = [display_index, row].concat();
                builder.push_record(row);
            }
        }

        let mut table = builder.build();
        table.with(Style::modern());

        // bold the headers if they exist
        if data_table.header_is_first_row {
            table.with(Modify::new((0, 0)).with(Color::BOLD));

            (0..table.count_columns())
                .collect::<Vec<usize>>()
                .iter()
                .enumerate()
                .for_each(|(index, _)| {
                    table.with(Modify::new((0, index + 1)).with(Color::BOLD));
                });
        }

        format!("\nData Table: {title}\n{table}")
    }

    /// Returns the display column index from the column index in the values array.
    pub fn get_display_index_from_column_index(
        &self,
        column_index: u32,
        include_self: bool,
    ) -> i64 {
        let mut x_adjustment = 0;
        let columns = self.column_headers.iter().flatten().collect::<Vec<_>>();
        for (i, column) in columns.iter().enumerate() {
            if i > column_index as usize || (!include_self && i == column_index as usize) {
                break;
            }
            if !column.display {
                x_adjustment += 1;
            }
        }
        column_index as i64 - x_adjustment
    }

    /// Returns the column index from the display column index.
    pub fn get_column_index_from_display_index(&self, display_index: u32) -> u32 {
        let mut hidden_columns = 0;
        let mut seen_display_index = -1;
        for column in self.column_headers.iter().flatten() {
            if column.display {
                seen_display_index += 1;
                if seen_display_index == display_index as i32 {
                    break;
                }
            } else {
                hidden_columns += 1;
            }
        }
        display_index + hidden_columns
    }

    /// Returns the y adjustment for the data table to account for the UI
    /// elements
    pub fn y_adjustment(&self, adjust_for_header_is_first_row: bool) -> i64 {
        let mut y_adjustment = 0;

        if self.show_ui {
            if self.show_name {
                y_adjustment += 1;
            }
            if !self.is_html_or_image() && self.show_columns {
                y_adjustment += 1;
            }
        }

        if self.header_is_first_row && adjust_for_header_is_first_row {
            y_adjustment -= 1;
        }

        y_adjustment
    }

    /// Returns true if the data table is a single value (ie, not an array)
    pub fn is_single_value(&self) -> bool {
        if self.is_html_or_image() {
            return false;
        }
        match &self.value {
            Value::Single(_) => true,
            Value::Array(_) => false,
            Value::Tuple(_) => false,
        }
    }

    /// Returns true if the data table is a single column (ie, not an array), or
    /// if it's an html or image.
    pub fn is_single_column(&self) -> bool {
        if self.is_html_or_image() {
            return true;
        }
        match &self.value {
            Value::Array(a) => a.width() == 1,
            _ => false,
        }
    }

    /// Returns true if the data table is a pandas DataFrame
    pub fn is_dataframe(&self) -> bool {
        if let DataTableKind::CodeRun(code_run) = &self.kind {
            code_run.output_type == Some("DataFrame".into())
        } else {
            false
        }
    }
}

#[cfg(test)]
pub mod test {

    use super::*;
    use crate::{
        controller::GridController,
        grid::{Sheet, SheetId},
        Array,
    };

    pub fn test_csv_values() -> Vec<Vec<&'static str>> {
        vec![
            vec!["city", "region", "country", "population"],
            vec!["Southborough", "MA", "United States", "1000"],
            vec!["Denver", "CO", "United States", "10000"],
            vec!["Seattle", "WA", "United States", "100"],
        ]
    }

    pub fn new_data_table() -> (Sheet, DataTable) {
        let gc = GridController::test();
        let grid = gc.grid();
        let sheet = grid.sheets()[0].clone();
        let file_name = "test.csv";
        let values = test_csv_values();
        let import = Import::new(file_name.into());
        let array = Array::from_str_vec(values, true).unwrap();
        let data_table = DataTable::from((import.clone(), array, grid));

        (sheet, data_table)
    }

    /// Util to print a data table when testing
    #[track_caller]
    pub fn pretty_print_data_table(
        data_table: &DataTable,
        title: Option<&str>,
        max: Option<usize>,
    ) {
        let data_table = super::DataTable::pretty_print_data_table(data_table, title, max);
        println!("{}", data_table);
    }

    /// Assert a data table row matches the expected values
    #[track_caller]
    pub fn assert_data_table_row(data_table: &DataTable, row_index: usize, expected: Vec<&str>) {
        let values = data_table
            .display_value(false)
            .unwrap()
            .into_array()
            .unwrap();

        values.get_row(row_index).unwrap().iter().enumerate().for_each(|(index, value)| {
            let value = value.to_string();
            let expected_value = expected[index];
            assert_eq!(&value, expected_value, "Expected row {row_index} to be {expected_value} at col {index}, but got {value}");
        });
    }

    #[test]
    fn test_import_data_table() {
        // test data table without column headings
        let (_, data_table) = new_data_table();
        let kind = data_table.kind.clone();
        let values = data_table.value.clone().into_array().unwrap();

        let expected_values = Value::Array(values.clone());
        let expected_data_table = DataTable::new(
            kind.clone(),
            "test.csv",
            expected_values,
            false,
            false,
            true,
            None,
        )
        .with_last_modified(data_table.last_modified);

        let expected_array_size = ArraySize::new(4, 6).unwrap();
        assert_eq!(data_table, expected_data_table);
        assert_eq!(data_table.output_size(), expected_array_size);

        pretty_print_data_table(&data_table, None, None);

        println!(
            "Data Table: {:?}",
            data_table.display_value_at((0, 1).into()).unwrap()
        );
    }

    #[test]
    fn test_output_size() {
        let sheet_id = SheetId::new();
        let code_run = CodeRun {
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
            Value::Single(CellValue::Number(1.into())),
            false,
            false,
            false,
            None,
        );

        assert_eq!(data_table.output_size(), ArraySize::_1X1);
        assert_eq!(
            data_table.output_sheet_rect(
                SheetPos {
                    x: -1,
                    y: -2,
                    sheet_id
                },
                false,
            ),
            SheetRect::from_numbers(-1, -2, 1, 1, sheet_id)
        );

        let code_run = CodeRun {
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
            Value::Array(Array::new_empty(ArraySize::new(10, 11).unwrap())),
            false,
            false,
            true,
            None,
        );

        assert_eq!(data_table.output_size().w.get(), 10);
        assert_eq!(data_table.output_size().h.get(), 13);
        assert_eq!(
            data_table.output_sheet_rect(
                SheetPos {
                    x: 1,
                    y: 2,
                    sheet_id
                },
                false,
            ),
            SheetRect::new(1, 2, 10, 14, sheet_id)
        );
    }

    #[test]
    fn test_output_sheet_rect_spill_error() {
        let sheet_id = SheetId::new();
        let code_run = CodeRun {
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
            Value::Array(Array::new_empty(ArraySize::new(10, 11).unwrap())),
            true,
            false,
            true,
            None,
        );
        let sheet_pos = SheetPos::from((1, 2, sheet_id));

        assert_eq!(data_table.output_size().w.get(), 10);
        assert_eq!(data_table.output_size().h.get(), 13);
        assert_eq!(
            data_table.output_sheet_rect(sheet_pos, false),
            SheetRect::new(1, 2, 1, 2, sheet_id)
        );
        assert_eq!(
            data_table.output_sheet_rect(sheet_pos, true),
            SheetRect::new(1, 2, 10, 14, sheet_id)
        );
    }

    #[test]
    fn test_y_adjustment() {
        let (_, data_table) = new_data_table();
        assert_eq!(data_table.y_adjustment(true), 2);
    }

    #[test]
    fn test_is_single_column() {
        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };

        // Test single value (not a single column)
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run.clone()),
            "Table 1",
            Value::Single(CellValue::Number(1.into())),
            false,
            false,
            true,
            None,
        );
        assert!(!data_table.is_single_column());

        // Test single column array
        let single_column = Array::new_empty(ArraySize::new(1, 3).unwrap());
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run.clone()),
            "Table 1",
            Value::Array(single_column),
            false,
            false,
            true,
            None,
        );
        assert!(data_table.is_single_column());

        // Test multi-column array
        let multi_column = Array::new_empty(ArraySize::new(2, 3).unwrap());
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(multi_column),
            false,
            false,
            true,
            None,
        );
        assert!(!data_table.is_single_column());

        // Test HTML content (should be single column so data_table.show_columns
        // is false)
        let data_table = DataTable::new(
            DataTableKind::CodeRun(CodeRun::default()),
            "Table 1",
            Value::Single(CellValue::Html("test".into())),
            false,
            false,
            true,
            None,
        );
        assert!(data_table.is_single_column());
    }

    #[test]
    fn test_get_display_index_from_column_index() {
        let code_run = CodeRun::default();
        let mut data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(Array::new_empty(ArraySize::new(4, 3).unwrap())),
            false,
            false,
            true,
            None,
        );

        // Create column headers with some hidden columns
        data_table.column_headers = Some(vec![
            DataTableColumnHeader::new("A".to_string(), false, 0), // hidden
            DataTableColumnHeader::new("B".to_string(), true, 1),  // visible
            DataTableColumnHeader::new("C".to_string(), false, 2), // hidden
            DataTableColumnHeader::new("D".to_string(), true, 3),  // visible
        ]);

        assert_eq!(data_table.get_display_index_from_column_index(0, false), 0);
        assert_eq!(data_table.get_display_index_from_column_index(0, true), -1);
        assert_eq!(data_table.get_display_index_from_column_index(1, false), 0);
        assert_eq!(data_table.get_display_index_from_column_index(1, true), 0);
        assert_eq!(data_table.get_display_index_from_column_index(2, false), 1);
        assert_eq!(data_table.get_display_index_from_column_index(2, true), 0);
        assert_eq!(data_table.get_display_index_from_column_index(3, false), 1);
        assert_eq!(data_table.get_display_index_from_column_index(3, true), 1);
    }

    #[test]
    fn test_get_column_index_from_display_index() {
        let code_run = CodeRun::default();
        let mut data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(Array::new_empty(ArraySize::new(4, 3).unwrap())),
            false,
            false,
            true,
            None,
        );

        // Create column headers with some hidden columns
        data_table.column_headers = Some(vec![
            DataTableColumnHeader::new("A".to_string(), false, 0), // hidden
            DataTableColumnHeader::new("B".to_string(), true, 1),  // visible
            DataTableColumnHeader::new("C".to_string(), false, 2), // hidden
            DataTableColumnHeader::new("D".to_string(), true, 3),  // visible
        ]);

        assert_eq!(data_table.get_column_index_from_display_index(0), 1);
        assert_eq!(data_table.get_column_index_from_display_index(1), 3);
        assert_eq!(data_table.get_column_index_from_display_index(2), 4); // out of bounds
    }

    #[test]
    fn test_output_size_single_value() {
        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };

        // Test with show_ui = false (no name or columns shown)
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run.clone()),
            "Table 1",
            Value::Single(CellValue::Number(1.into())),
            false,
            false,
            false,
            None,
        );
        assert_eq!(data_table.output_size(), ArraySize::_1X1);

        // Test with show_ui = true (name and columns shown)
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single(CellValue::Number(1.into())),
            false,
            false,
            true,
            None,
        );
        // Height should be 3 (1 for value + 1 for name + 1 for columns)
        assert_eq!(data_table.output_size(), ArraySize::new(1, 3).unwrap());
    }
}
