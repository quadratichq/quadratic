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

use crate::a1::A1Context;
use crate::cellvalue::Import;
use crate::grid::CodeRun;
use crate::util::unique_name;
use crate::{
    Array, ArraySize, CellValue, Pos, Rect, RunError, RunErrorMsg, SheetPos, SheetRect, Value,
};
use anyhow::{Ok, Result, anyhow, bail};
use chrono::{DateTime, Utc};
use column_header::DataTableColumnHeader;
use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sort::DataTableSort;
use strum_macros::Display;

use super::sheet::borders::Borders;
use super::{CodeCellLanguage, Grid, SheetFormatting, SheetId};

/// Returns a unique name for the data table, taking into account its
/// position on the sheet (so it doesn't conflict with itself).
pub fn unique_data_table_name(
    name: &str,
    require_number: bool,
    sheet_pos: Option<SheetPos>,
    a1_context: &A1Context,
) -> String {
    let check_name = |name: &str| !a1_context.table_map.contains_name(name, sheet_pos);

    let name = unique_name(name, require_number, check_name);

    // replace spaces with underscores
    name.replace(' ', "_")
}

impl Grid {
    /// Returns the data table at the given position.
    pub fn data_table(&self, sheet_id: SheetId, pos: Pos) -> Result<&DataTable> {
        self.try_sheet_result(sheet_id)?.data_table_result(pos)
    }

    /// Updates the name of a data table and replaces the old name in all code cells that reference it.
    pub fn update_data_table_name(
        &mut self,
        sheet_pos: SheetPos,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
        require_number: bool,
    ) -> Result<()> {
        let unique_name =
            unique_data_table_name(new_name, require_number, Some(sheet_pos), a1_context);

        self.replace_table_name_in_code_cells(old_name, &unique_name, a1_context);

        let sheet = self
            .try_sheet_mut(sheet_pos.sheet_id)
            .ok_or_else(|| anyhow!("Sheet {} not found", sheet_pos.sheet_id))?;

        sheet
            .data_table_mut(sheet_pos.into())?
            .update_table_name(&unique_name);

        Ok(())
    }

    /// Returns a unique name for a data table
    pub fn next_data_table_name(&self, a1_context: &A1Context) -> String {
        unique_data_table_name("Table", true, None, a1_context)
    }

    /// Replaces the table name in all code cells that reference the old name in all sheets in the grid.
    pub fn replace_table_name_in_code_cells(
        &mut self,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
    ) {
        for sheet in self.sheets.iter_mut() {
            sheet.replace_table_name_in_code_cells(old_name, new_name, a1_context);
        }
    }

    /// Replaces the column name in all code cells that reference the old name in all sheets in the grid.
    pub fn replace_table_column_name_in_code_cells(
        &mut self,
        table_name: &str,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
    ) {
        for sheet in self.sheets.iter_mut() {
            sheet.replace_table_column_name_in_code_cells(
                table_name, old_name, new_name, a1_context,
            );
        }
    }
}

const A1_REGEX: &str = r#"\b\$?[a-zA-Z]+\$\d+\b"#;
const R1C1_REGEX: &str = r#"\bR\d+C\d+\b"#;
const TABLE_NAME_VALID_CHARS: &str = r#"^[a-zA-Z_\\][a-zA-Z0-9_.]*$"#;
const COLUMN_NAME_VALID_CHARS: &str = r#"^[a-zA-Z_\-]([a-zA-Z0-9_\- .()\p{Pd}]*[a-zA-Z0-9_\-)])?$"#;
lazy_static! {
    static ref A1_REGEX_COMPILED: Regex = Regex::new(A1_REGEX).expect("Failed to compile A1_REGEX");
    static ref R1C1_REGEX_COMPILED: Regex =
        Regex::new(R1C1_REGEX).expect("Failed to compile R1C1_REGEX");
    static ref TABLE_NAME_VALID_CHARS_COMPILED: Regex =
        Regex::new(TABLE_NAME_VALID_CHARS).expect("Failed to compile TABLE_NAME_VALID_CHARS");
    static ref COLUMN_NAME_VALID_CHARS_COMPILED: Regex =
        Regex::new(COLUMN_NAME_VALID_CHARS).expect("Failed to compile COLUMN_NAME_VALID_CHARS");
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
    pub sort_dirty: bool,
    pub display_buffer: Option<Vec<u64>>,
    pub value: Value,
    pub spill_error: bool,
    pub last_modified: DateTime<Utc>,
    pub alternating_colors: bool,
    pub formats: SheetFormatting,
    pub borders: Borders,

    pub show_name: Option<bool>,
    pub show_columns: Option<bool>,

    // width and height of the chart (html or image) output
    pub chart_pixel_output: Option<(f32, f32)>,
    pub chart_output: Option<(u32, u32)>,
}

impl From<(Import, Array, &A1Context)> for DataTable {
    fn from((import, cell_values, context): (Import, Array, &A1Context)) -> Self {
        let name = unique_data_table_name(&import.file_name, false, None, context);

        DataTable::new(
            DataTableKind::Import(import),
            &name,
            Value::Array(cell_values),
            false,
            false,
            None,
            None,
            None,
        )
    }
}

impl DataTable {
    /// Creates a new DataTable with the given kind, value, and spill_error,
    /// with the ability to lift the first row as column headings.
    /// This handles the most common use cases.  Use `new_raw` for more control.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        kind: DataTableKind,
        name: &str,
        value: Value,
        spill_error: bool,
        header_is_first_row: bool,
        show_name: Option<bool>,
        show_columns: Option<bool>,
        chart_pixel_output: Option<(f32, f32)>,
    ) -> Self {
        let mut data_table = DataTable {
            kind,
            name: name.into(),
            header_is_first_row,
            chart_pixel_output,
            value,
            spill_error,
            last_modified: Utc::now(),
            alternating_colors: true,

            show_name,
            show_columns,

            column_headers: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,

            formats: Default::default(),
            borders: Default::default(),

            chart_output: None,
        };

        if header_is_first_row {
            data_table.apply_first_row_as_header();
        } else {
            data_table.apply_default_header();
        }

        data_table
    }

    pub fn clone_without_values(&self) -> Self {
        Self {
            kind: self.kind.clone(),
            name: self.name.clone(),
            header_is_first_row: self.header_is_first_row,
            column_headers: self.column_headers.clone(),
            sort: self.sort.clone(),
            sort_dirty: self.sort_dirty,
            display_buffer: self.display_buffer.clone(),
            value: Value::Single(CellValue::Blank),
            spill_error: self.spill_error,
            last_modified: self.last_modified,
            alternating_colors: self.alternating_colors,
            formats: self.formats.clone(),
            borders: self.borders.clone(),

            show_name: self.show_name,
            show_columns: self.show_columns,

            chart_pixel_output: self.chart_pixel_output,
            chart_output: self.chart_output,
        }
    }

    pub fn get_language(&self) -> CodeCellLanguage {
        match &self.kind {
            DataTableKind::CodeRun(code_run) => code_run.language.to_owned(),
            DataTableKind::Import(_) => CodeCellLanguage::Import,
        }
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

    pub fn is_code(&self) -> bool {
        match &self.kind {
            DataTableKind::CodeRun(_) => true,
            DataTableKind::Import(_) => false,
        }
    }

    pub fn get_show_name(&self) -> bool {
        // always show table name for charts
        if self.is_html_or_image() {
            return true;
        }

        // user set value
        if let Some(show_name) = self.show_name {
            return show_name;
        }

        // defaults show_name for different languages and outputs

        let language = self.get_language();
        if language == CodeCellLanguage::Import {
            return true;
        }

        if self.is_single_value() {
            return false;
        }

        if language == CodeCellLanguage::Formula {
            return false;
        }

        true
    }

    pub fn get_show_columns(&self) -> bool {
        // always hide column headers for charts
        if self.is_html_or_image() {
            return false;
        }

        // user set value
        if let Some(show_columns) = self.show_columns {
            return show_columns;
        }

        // defaults show_columns for different languages and outputs

        let language = self.get_language();
        if language == CodeCellLanguage::Import {
            return true;
        }

        if self.is_single_value() {
            return false;
        }

        if self.header_is_first_row {
            return true;
        }

        if self.is_list_series_dataframe() {
            return false;
        }

        if language == CodeCellLanguage::Javascript || language == CodeCellLanguage::Formula {
            return false;
        }

        self.column_headers.is_some()
    }

    pub fn name(&self) -> &str {
        match &self.name {
            CellValue::Text(s) => s,
            _ => "",
        }
    }

    /// Validates the table name. SheetPos is provided to allow the table to be
    /// renamed to itself (eg, with different casing).
    ///
    /// Table name must be between 1 and 255 characters Table name cannot be a
    /// single 'R' or 'C' Table name cannot be a cell reference Table name
    /// cannot contain invalid characters Table name must be unique
    pub fn validate_table_name(
        name: &str,
        sheet_pos: SheetPos,
        a1_context: &A1Context,
    ) -> std::result::Result<bool, String> {
        // Check length limit
        if name.is_empty() || name.len() > 255 {
            return Err("Table name must be between 1 and 255 characters".to_string());
        }

        // Check if name is a single "R", "r", "C", or "c"
        if matches!(name.to_uppercase().as_str(), "R" | "C") {
            return Err("Table name cannot be a single 'R' or 'C'".to_string());
        }

        // Check if name matches a cell reference pattern (A1 or R1C1)
        if A1_REGEX_COMPILED.is_match(name) || R1C1_REGEX_COMPILED.is_match(name) {
            return Err("Table name cannot be a cell reference".to_string());
        }

        // Validate characters using regex pattern
        if !TABLE_NAME_VALID_CHARS_COMPILED.is_match(name) {
            return Err("Table name contains invalid characters".to_string());
        }

        // Check if table name already exists
        if let Some(table) = a1_context.table_map.try_table(name) {
            if table.sheet_id != sheet_pos.sheet_id || table.bounds.min != sheet_pos.into() {
                return Err("Table name must be unique".to_string());
            }
        }

        std::result::Result::Ok(true)
    }

    /// Validates the column name.
    ///
    /// Column name must be between 1 and 255 characters
    /// Column name cannot contain invalid characters
    /// Column name must be unique
    pub fn validate_column_name(
        table_name: &str,
        index: usize,
        column_name: &str,
        a1_context: &A1Context,
    ) -> std::result::Result<bool, String> {
        // Check length limit
        if column_name.is_empty() || column_name.len() > 255 {
            return Err("Column name must be between 1 and 255 characters".to_string());
        }

        // Validate characters using regex pattern
        if !COLUMN_NAME_VALID_CHARS_COMPILED.is_match(column_name) {
            return Err("Column name contains invalid characters".to_string());
        }

        // Check if column name already exists
        if a1_context
            .table_map
            .table_has_column(table_name, column_name, index)
        {
            return Err("Column name must be unique".to_string());
        }

        std::result::Result::Ok(true)
    }

    /// Updates the table name.
    pub fn update_table_name(&mut self, name: &str) {
        self.name = name.into();
    }

    /// Returns a reference to the values in the data table.
    pub fn value_ref(&self) -> Result<Vec<&CellValue>> {
        match &self.value {
            Value::Single(value) => Ok(vec![value]),
            Value::Array(array) => Ok(array.cell_values_slice().iter().collect()),
            Value::Tuple(_) => bail!("Expected an array"),
        }
    }

    /// Returns the width of the data table.
    pub fn width(&self) -> usize {
        match &self.value {
            Value::Single(_) => 1,
            Value::Array(array) => array.width() as usize,
            Value::Tuple(_) => 0,
        }
    }

    /// Returns the height of the data table. The force_table_bounds parameter
    /// will return the actual height of the table, including any UI elements.
    /// If false, it includes the array height, which may contain the column
    /// header row if header_is_first_row is true.
    pub fn height(&self, force_table_bounds: bool) -> usize {
        if self.is_html_or_image() {
            if let Some((_, h)) = self.chart_output {
                (h + (if force_table_bounds { 0 } else { 1 })) as usize
            } else {
                1
            }
        } else {
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
            DataTableKind::CodeRun(code_run) => Some(code_run),
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
                Value::Single(v) => match v {
                    CellValue::Image(_) => CellValue::Blank,
                    CellValue::Html(_) => CellValue::Blank,
                    _ => v.clone(),
                },
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

    /// Returns true if the data table output is a list, series, or dataframe.
    fn is_list_series_dataframe(&self) -> bool {
        self.is_list() || self.is_series() || self.is_dataframe()
    }

    /// Returns true if the data table is an html.
    pub fn is_html(&self) -> bool {
        if let Value::Single(value) = &self.value {
            matches!(value, CellValue::Html(_))
        } else {
            false
        }
    }

    /// Returns true if the data table is an image.
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

    /// Returns the value as an array.
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

    /// Returns the y adjustment for the data table to account for the UI
    /// elements
    pub fn y_adjustment(&self, adjust_for_header_is_first_row: bool) -> i64 {
        let mut y_adjustment = 0;

        if self.get_show_name() {
            y_adjustment += 1;
        }

        if !self.is_html_or_image() && self.get_show_columns() {
            y_adjustment += 1;
        }

        if adjust_for_header_is_first_row && self.header_is_first_row {
            y_adjustment -= 1;
        }

        y_adjustment
    }

    /// Returns true if the data table is a single value (ie, not an array)
    pub fn is_single_value(&self) -> bool {
        if self.is_html_or_image() {
            return false;
        }

        matches!(self.value, Value::Single(_))
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

    /// Returns true if the data table is a pandas Series
    pub fn is_series(&self) -> bool {
        if let DataTableKind::CodeRun(code_run) = &self.kind {
            code_run.output_type == Some("Series".into())
        } else {
            false
        }
    }

    /// Returns true if the data table is a list
    pub fn is_list(&self) -> bool {
        if let DataTableKind::CodeRun(code_run) = &self.kind {
            code_run.output_type == Some("list".into())
        } else {
            false
        }
    }

    /// Returns the rows that are part of the data table's UI.
    pub fn ui_rows(&self, pos: Pos) -> Vec<i64> {
        let mut rows = vec![];
        let show_name = self.get_show_name();
        if show_name || self.is_html_or_image() {
            rows.push(pos.y);
        }

        let show_columns = self.get_show_columns();
        if show_columns && !self.is_html_or_image() {
            if show_name {
                rows.push(pos.y + 1);
            } else {
                rows.push(pos.y);
            }
        }

        rows
    }
}

#[cfg(test)]
pub mod test {

    use super::*;
    use crate::{
        Array,
        controller::GridController,
        grid::{Sheet, SheetId},
        test_util::pretty_print_data_table,
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
        let context = gc.a1_context();
        let data_table = DataTable::from((import.clone(), array, context));

        (sheet, data_table)
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
            None,
            None,
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
            language: CodeCellLanguage::Python,
            code: "Table 1".to_string(),
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
            Some(false),
            Some(false),
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
            language: CodeCellLanguage::Python,
            code: "Table 1".to_string(),
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
            Some(true),
            Some(true),
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
            language: CodeCellLanguage::Python,
            code: "Table 1".to_string(),
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
            Some(true),
            Some(true),
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
            language: CodeCellLanguage::Python,
            code: "Table 1".to_string(),
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
            Some(true),
            Some(true),
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
            Some(true),
            Some(true),
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
            Some(true),
            Some(true),
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
            Some(true),
            Some(true),
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
            Some(true),
            Some(true),
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
            Some(true),
            Some(true),
            None,
        );

        // Create column headers with some hidden columns
        data_table.column_headers = Some(vec![
            DataTableColumnHeader::new("A".to_string(), false, 0), // hidden
            DataTableColumnHeader::new("B".to_string(), true, 1),  // visible
            DataTableColumnHeader::new("C".to_string(), false, 2), // hidden
            DataTableColumnHeader::new("D".to_string(), true, 3),  // visible
        ]);

        assert_eq!(data_table.get_column_index_from_display_index(0, true), 1);
        assert_eq!(data_table.get_column_index_from_display_index(1, true), 3);
        assert_eq!(data_table.get_column_index_from_display_index(2, true), 4); // out of bounds
    }

    #[test]
    fn test_output_size_single_value() {
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "Table 1".to_string(),
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
            Some(false),
            Some(false),
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
            Some(true),
            Some(true),
            None,
        );
        // Height should be 3 (1 for value + 1 for name + 1 for columns)
        assert_eq!(data_table.output_size(), ArraySize::new(1, 3).unwrap());
    }

    #[test]
    fn test_validate_table_name() {
        // valid table name
        let context = A1Context::default();
        let longest_name = "a".repeat(255);
        let valid_names = vec![
            "Sales",
            "tbl_Sales",
            "First_Quarter",
            "First.Quarter",
            "Table_2023",
            "_hidden",
            "\\special",
            longest_name.as_str(),
            "a",
        ];

        let sheet_pos = SheetPos::from((1, 1, SheetId::TEST));

        for name in valid_names {
            assert!(DataTable::validate_table_name(name, sheet_pos, &context).is_ok());
        }

        // invalid table name
        let context = A1Context::default();
        let long_name = "a".repeat(256);
        let test_cases = vec![
            ("", "Table name must be between 1 and 255 characters"),
            (
                long_name.as_str(),
                "Table name must be between 1 and 255 characters",
            ),
            ("R", "Table name cannot be a single 'R' or 'C'"),
            ("C", "Table name cannot be a single 'R' or 'C'"),
            ("r", "Table name cannot be a single 'R' or 'C'"),
            ("c", "Table name cannot be a single 'R' or 'C'"),
            ("A$1", "Table name cannot be a cell reference"),
            ("R1C1", "Table name cannot be a cell reference"),
            ("2Sales", "Table name contains invalid characters"),
            ("Sales Space", "Table name contains invalid characters"),
            ("#Invalid", "Table name contains invalid characters"),
        ];

        for (name, expected_error) in test_cases {
            let result = DataTable::validate_table_name(name, sheet_pos, &context);
            assert!(result.is_err());
            assert_eq!(result.unwrap_err(), expected_error);
        }

        // duplicate table name
        let context = A1Context::test(
            &[("Sheet1", SheetId::TEST)],
            &[
                ("Table1", &["col1", "col2"], Rect::test_a1("A1:B3")),
                ("Table2", &["col3", "col4"], Rect::test_a1("D1:E3")),
            ],
        );
        let result = DataTable::validate_table_name(
            "Table1",
            SheetPos::new(SheetId::TEST, 10, 10),
            &context,
        );
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Table name must be unique");

        // duplicate table name with different casing
        let result = DataTable::validate_table_name("TABLE1", sheet_pos, &context);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_column_name() {
        // Test valid column names
        let context = A1Context::test(
            &[("Sheet1", SheetId::TEST)],
            &[("Table1", &["existing_col"], Rect::test_a1("A1:A3"))],
        );
        let table_name = "Table1";
        let longest_name = "a".repeat(255);
        let valid_names = vec![
            "Sales",
            "First Quarter",
            "Revenue-2023",
            "Cost (USD)",
            "profit_margin",
            "column-with-dashes",
            "column_with_underscore",
            "Column With Spaces",
            "Column.With.Dots",
            "Column(With)Parentheses",
            "_hidden_column",
            "a",
            "Column-with–en—dash", // Testing various dash characters
            longest_name.as_str(),
        ];

        for name in valid_names {
            assert!(
                DataTable::validate_column_name(table_name, 10, name, &context).is_ok(),
                "Expected '{}' to be valid",
                name
            );
        }

        // Test invalid column names
        let long_name = "a".repeat(256);
        let test_cases = vec![
            ("", "Column name must be between 1 and 255 characters"),
            (
                long_name.as_str(),
                "Column name must be between 1 and 255 characters",
            ),
            ("#Invalid", "Column name contains invalid characters"),
            ("@Column", "Column name contains invalid characters"),
            ("Column!", "Column name contains invalid characters"),
            ("Column?", "Column name contains invalid characters"),
            ("Column*", "Column name contains invalid characters"),
            ("Column/", "Column name contains invalid characters"),
            ("Column\\", "Column name contains invalid characters"),
            ("Column$", "Column name contains invalid characters"),
            ("Column%", "Column name contains invalid characters"),
            ("Column^", "Column name contains invalid characters"),
            ("Column&", "Column name contains invalid characters"),
            ("Column+", "Column name contains invalid characters"),
            ("Column=", "Column name contains invalid characters"),
            ("Column;", "Column name contains invalid characters"),
            ("Column,", "Column name contains invalid characters"),
            ("Column<", "Column name contains invalid characters"),
            ("Column>", "Column name contains invalid characters"),
            ("Column[", "Column name contains invalid characters"),
            ("Column]", "Column name contains invalid characters"),
            ("Column{", "Column name contains invalid characters"),
            ("Column}", "Column name contains invalid characters"),
            ("Column|", "Column name contains invalid characters"),
            ("Column`", "Column name contains invalid characters"),
            ("Column~", "Column name contains invalid characters"),
            ("Column'", "Column name contains invalid characters"),
            ("Column\"", "Column name contains invalid characters"),
            // Test names ending with invalid characters
            ("Column ", "Column name contains invalid characters"),
            ("Column.", "Column name contains invalid characters"),
            // Test names starting with invalid characters (except underscore and dash)
            ("1Column", "Column name contains invalid characters"),
            ("2Sales", "Column name contains invalid characters"),
            (".Column", "Column name contains invalid characters"),
            (" Column", "Column name contains invalid characters"),
        ];

        for (name, expected_error) in test_cases {
            let result = DataTable::validate_column_name(table_name, 10, name, &context);
            assert!(
                result.is_err(),
                "Expected '{}' to be invalid, but it was valid",
                name
            );
            assert_eq!(
                result.unwrap_err(),
                expected_error,
                "Unexpected error message for '{}'",
                name
            );
        }

        // Test duplicate column name
        let result = DataTable::validate_column_name(table_name, 10, "existing_col", &context);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Column name must be unique");

        // Allow duplicate column name if the index is the same as the existing column index
        let result = DataTable::validate_column_name(table_name, 0, "existing_col", &context);
        assert!(result.is_ok());
    }

    #[test]
    fn test_ui_rows() {
        let code_run = CodeRun::default();
        let mut data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(Array::new_empty(ArraySize::new(2, 2).unwrap())),
            false,
            false,
            Some(true),
            Some(true),
            None,
        );

        // Test with show_ui = true, show_name = true, show_columns = true
        let pos = pos!(B2);
        assert_eq!(data_table.ui_rows(pos), vec![2, 3]);

        // Test with show_name = false
        data_table.show_name = Some(false);
        assert_eq!(data_table.ui_rows(pos), vec![2]);

        // Test with show_columns = false
        data_table.show_name = Some(true);
        data_table.show_columns = Some(false);
        assert_eq!(data_table.ui_rows(pos), vec![2]);

        // Test with show_ui = false
        data_table.show_name = Some(false);
        data_table.show_columns = Some(false);
        assert_eq!(data_table.ui_rows(pos), Vec::<i64>::new());

        // Test with HTML content
        data_table.show_name = Some(true);
        data_table.show_columns = Some(false);
        data_table.value = Value::Single(CellValue::Html("test".into()));
        assert_eq!(data_table.ui_rows(pos), vec![2]);

        // Test with Image content
        data_table.value = Value::Single(CellValue::Image("test".into()));
        assert_eq!(data_table.ui_rows(pos), vec![2]);
    }
}
