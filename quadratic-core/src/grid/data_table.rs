//! CodeRun is the output of a CellValue::Code type
//!
//! This lives in sheet.data_tables. CodeRun is optional within sheet.data_tables for
//! any given CellValue::Code type (ie, if it doesn't exist then a run hasn't been
//! performed yet).

use crate::cellvalue::Import;
use crate::grid::CodeRun;
use crate::{
    Array, ArraySize, CellValue, Pos, Rect, RunError, RunErrorMsg, SheetPos, SheetRect, Value,
};
use anyhow::anyhow;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::Sheet;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DataTableColumn {
    pub name: String,
    pub display: bool,
    pub value_index: u32,
}

impl DataTableColumn {
    pub fn new(name: String, display: bool, value_index: u32) -> Self {
        DataTableColumn {
            name,
            display,
            value_index,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum DataTableKind {
    CodeRun(CodeRun),
    Import(Import),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DataTable {
    pub kind: DataTableKind,
    pub name: String,
    pub columns: Option<Vec<DataTableColumn>>,
    pub value: Value,
    pub readonly: bool,
    pub spill_error: bool,
    pub last_modified: DateTime<Utc>,
}

impl From<(Import, Array, &Sheet)> for DataTable {
    fn from((import, cell_values, sheet): (Import, Array, &Sheet)) -> Self {
        let name = sheet.next_data_table_name();

        DataTable::new(
            DataTableKind::Import(import),
            &name,
            Value::Array(cell_values),
            false,
            false,
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
        header: bool,
    ) -> Self {
        let readonly = match kind {
            DataTableKind::CodeRun(_) => true,
            DataTableKind::Import(_) => false,
        };

        let mut data_table = DataTable {
            kind,
            name: name.into(),
            columns: None,
            value,
            readonly,
            spill_error,
            last_modified: Utc::now(),
        };

        if header {
            data_table.apply_header_from_first_row();
        }

        data_table
    }

    /// Direcly creates a new DataTable with the given kind, value, spill_error, and columns.
    pub fn new_raw(
        kind: DataTableKind,
        name: &str,
        columns: Option<Vec<DataTableColumn>>,
        value: Value,
        readonly: bool,
        spill_error: bool,
    ) -> Self {
        DataTable {
            kind,
            name: name.into(),
            columns,
            value,
            readonly,
            spill_error,
            last_modified: Utc::now(),
        }
    }

    /// Apply a new last modified date to the DataTable.
    pub fn with_last_modified(mut self, last_modified: DateTime<Utc>) -> Self {
        self.last_modified = last_modified;
        self
    }

    /// Takes the first row of the array and sets it as the column headings.
    /// The source array is shifted up one in place.
    pub fn apply_header_from_first_row(&mut self) {
        self.columns = match self.value {
            Value::Array(ref mut array) => array.shift().ok().map(|array| {
                array
                    .iter()
                    .enumerate()
                    .map(|(i, value)| DataTableColumn::new(value.to_string(), true, i as u32))
                    .collect::<Vec<DataTableColumn>>()
            }),
            _ => None,
        };
    }

    /// Apply default column headings to the DataTable.
    /// For example, the column headings will be "Column 1", "Column 2", etc.
    pub fn apply_default_header(&mut self) {
        self.columns = match self.value {
            Value::Array(ref mut array) => Some(
                (1..=array.width())
                    .map(|i| DataTableColumn::new(format!("Column {i}"), true, i - 1))
                    .collect::<Vec<DataTableColumn>>(),
            ),
            _ => None,
        };
    }

    /// Ensure that the index is within the bounds of the columns.
    /// If there are no columns, apply default headers first if `apply_default_header` is true.
    fn check_index(&mut self, index: usize, apply_default_header: bool) -> anyhow::Result<()> {
        match self.columns {
            Some(ref mut columns) => {
                let column_len = columns.len();

                if index >= column_len {
                    return Err(anyhow!("Column {index} out of bounds: {column_len}"));
                }
            }
            // there are no columns, so we need to apply default headers first
            None => {
                apply_default_header.then(|| self.apply_default_header());
            }
        };

        Ok(())
    }

    /// Replace a column header at the given index in place.
    pub fn set_header_at(
        &mut self,
        index: usize,
        name: String,
        display: bool,
    ) -> anyhow::Result<()> {
        self.check_index(index, true)?;

        self.columns
            .as_mut()
            .and_then(|columns| columns.get_mut(index))
            .map(|column| {
                column.name = name;
                column.display = display;
            });

        Ok(())
    }

    /// Set the display of a column header at the given index.
    pub fn set_header_display_at(&mut self, index: usize, display: bool) -> anyhow::Result<()> {
        self.check_index(index, true)?;

        self.columns
            .as_mut()
            .and_then(|columns| columns.get_mut(index))
            .map(|column| {
                column.display = display;
            });

        Ok(())
    }

    /// Helper functtion to get the CodeRun from the DataTable.
    /// Returns `None` if the DataTableKind is not CodeRun.
    pub fn code_run(&self) -> Option<&CodeRun> {
        match self.kind {
            DataTableKind::CodeRun(ref code_run) => Some(code_run),
            _ => None,
        }
    }

    /// Helper functtion to deterime if the DataTable's CodeRun has an error.
    /// Returns `false` if the DataTableKind is not CodeRun or if there is no error.
    pub fn has_error(&self) -> bool {
        match self.kind {
            DataTableKind::CodeRun(ref code_run) => code_run.error.is_some(),
            _ => false,
        }
    }

    /// Helper functtion to get the error in the CodeRun from the DataTable.
    /// Returns `None` if the DataTableKind is not CodeRun or if there is no error.
    pub fn get_error(&self) -> Option<RunError> {
        self.code_run()
            .and_then(|code_run| code_run.error.to_owned())
    }

    /// Returns the output value of a code run at the relative location (ie, (0,0) is the top of the code run result).
    /// A spill or error returns [`CellValue::Blank`]. Note: this assumes a [`CellValue::Code`] exists at the location.
    pub fn cell_value_at(&self, x: u32, y: u32) -> Option<CellValue> {
        if self.spill_error {
            Some(CellValue::Blank)
        } else {
            self.cell_value_ref_at(x, y).cloned()
        }
    }

    /// Returns the output value of a code run at the relative location (ie, (0,0) is the top of the code run result).
    /// A spill or error returns `None`. Note: this assumes a [`CellValue::Code`] exists at the location.
    pub fn cell_value_ref_at(&self, x: u32, y: u32) -> Option<&CellValue> {
        if self.spill_error {
            None
        } else {
            self.value.get(x, y).ok()
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
        if !self.spill_error {
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

    /// Returns the size of the output array, or defaults to `_1X1` (since output always includes the code_cell).
    /// Note: this does not take spill_error into account.
    pub fn output_size(&self) -> ArraySize {
        match &self.value {
            Value::Array(a) => a.size(),
            Value::Single(_) | Value::Tuple(_) => ArraySize::_1X1,
        }
    }

    pub fn is_html(&self) -> bool {
        match self.cell_value_at(0, 0) {
            Some(code_cell_value) => code_cell_value.is_html(),
            None => false,
        }
    }

    pub fn is_image(&self) -> bool {
        match self.cell_value_at(0, 0) {
            Some(code_cell_value) => code_cell_value.is_image(),
            None => false,
        }
    }

    /// returns a SheetRect for the output size of a code cell (defaults to 1x1)
    /// Note: this returns a 1x1 if there is a spill_error.
    pub fn output_sheet_rect(&self, sheet_pos: SheetPos, ignore_spill: bool) -> SheetRect {
        if !ignore_spill && self.spill_error {
            SheetRect::from_sheet_pos_and_size(sheet_pos, ArraySize::_1X1)
        } else {
            SheetRect::from_sheet_pos_and_size(sheet_pos, self.output_size())
        }
    }

    /// returns a SheetRect for the output size of a code cell (defaults to 1x1)
    /// Note: this returns a 1x1 if there is a spill_error.
    pub fn output_rect(&self, pos: Pos, ignore_spill: bool) -> Rect {
        if !ignore_spill && self.spill_error {
            Rect::from_pos_and_size(pos, ArraySize::_1X1)
        } else {
            Rect::from_pos_and_size(pos, self.output_size())
        }
    }
}

#[cfg(test)]
pub(crate) mod test {
    use std::collections::HashSet;

    use super::*;
    use crate::{controller::GridController, grid::SheetId, Array};
    use serial_test::parallel;

    pub fn new_data_table() -> (Sheet, DataTable) {
        let sheet = GridController::test().grid().sheets()[0].clone();
        let file_name = "test.csv";
        let values = vec![
            vec!["city", "region", "country", "population"],
            vec!["Southborough", "MA", "United States", "1000"],
            vec!["Denver", "CO", "United States", "10000"],
            vec!["Seattle", "WA", "United States", "100"],
        ];
        let import = Import::new(file_name.into());
        let data_table = DataTable::from((import.clone(), values.clone().into(), &sheet));

        (sheet, data_table)
    }

    #[test]
    #[parallel]
    fn test_import_data_table_and_headers() {
        // test data table without column headings
        let (_, mut data_table) = new_data_table();
        let kind = data_table.kind.clone();
        let values = data_table.value.clone().into_array().unwrap();

        let expected_values = Value::Array(values.clone().into());
        let expected_data_table =
            DataTable::new(kind.clone(), "Table 1", expected_values, false, false)
                .with_last_modified(data_table.last_modified);
        let expected_array_size = ArraySize::new(4, 4).unwrap();
        assert_eq!(data_table, expected_data_table);
        assert_eq!(data_table.output_size(), expected_array_size);

        // test default column headings
        data_table.apply_default_header();
        let expected_columns = vec![
            DataTableColumn::new("Column 1".into(), true, 0),
            DataTableColumn::new("Column 2".into(), true, 1),
            DataTableColumn::new("Column 3".into(), true, 2),
            DataTableColumn::new("Column 4".into(), true, 3),
        ];
        assert_eq!(data_table.columns, Some(expected_columns));

        // test column headings taken from first row
        let value = Value::Array(values.clone().into());
        let mut data_table = DataTable::new(kind.clone(), "Table 1", value, false, true)
            .with_last_modified(data_table.last_modified);

        // array height should be 3 since we lift the first row as column headings
        let expected_array_size = ArraySize::new(4, 3).unwrap();
        assert_eq!(data_table.output_size(), expected_array_size);

        let expected_columns = vec![
            DataTableColumn::new("city".into(), true, 0),
            DataTableColumn::new("region".into(), true, 1),
            DataTableColumn::new("country".into(), true, 2),
            DataTableColumn::new("population".into(), true, 3),
        ];
        assert_eq!(data_table.columns, Some(expected_columns));

        let mut expected_values = values.clone();
        expected_values.shift().unwrap();
        assert_eq!(
            data_table.value.clone().into_array().unwrap(),
            expected_values
        );

        // test setting header at index
        data_table.set_header_at(0, "new".into(), true).unwrap();
        assert_eq!(data_table.columns.as_ref().unwrap()[0].name, "new");

        // test setting header display at index
        data_table.set_header_display_at(0, false).unwrap();
        assert_eq!(data_table.columns.as_ref().unwrap()[0].display, false);
    }

    #[test]
    #[parallel]
    fn test_output_size() {
        let sheet_id = SheetId::new();
        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
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
        );

        assert_eq!(data_table.output_size(), ArraySize::_1X1);
        assert_eq!(
            data_table.output_sheet_rect(
                SheetPos {
                    x: -1,
                    y: -2,
                    sheet_id
                },
                false
            ),
            SheetRect::from_numbers(-1, -2, 1, 1, sheet_id)
        );

        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
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
        );

        assert_eq!(data_table.output_size().w.get(), 10);
        assert_eq!(data_table.output_size().h.get(), 11);
        assert_eq!(
            data_table.output_sheet_rect(
                SheetPos {
                    x: 1,
                    y: 2,
                    sheet_id
                },
                false
            ),
            SheetRect::from_numbers(1, 2, 10, 11, sheet_id)
        );
    }

    #[test]
    #[parallel]
    fn test_output_sheet_rect_spill_error() {
        let sheet_id = SheetId::new();
        let code_run = CodeRun {
            formatted_code_string: None,
            std_out: None,
            std_err: None,
            cells_accessed: HashSet::new(),
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
        );
        let sheet_pos = SheetPos::from((1, 2, sheet_id));

        assert_eq!(data_table.output_size().w.get(), 10);
        assert_eq!(data_table.output_size().h.get(), 11);
        assert_eq!(
            data_table.output_sheet_rect(sheet_pos, false),
            SheetRect::from_numbers(1, 2, 1, 1, sheet_id)
        );
        assert_eq!(
            data_table.output_sheet_rect(sheet_pos, true),
            SheetRect::from_numbers(1, 2, 10, 11, sheet_id)
        );
    }
}
