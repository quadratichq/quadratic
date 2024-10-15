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
use anyhow::{anyhow, Ok, Result};
use chrono::{DateTime, Utc};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use tabled::{
    builder::Builder,
    settings::{Color, Modify, Style},
};

use super::Sheet;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DataTableColumn {
    pub name: String,
    pub display: bool,
    pub value_index: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum DataTableKind {
    CodeRun(CodeRun),
    Import(Import),
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
pub enum SortDirection {
    Ascending,
    Descending,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DataTableSortOrder {
    pub column_index: usize,
    pub direction: SortDirection,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DataTable {
    pub kind: DataTableKind,
    pub name: String,
    pub has_header: bool,
    pub columns: Option<Vec<DataTableColumn>>,
    pub sort: Option<Vec<DataTableSortOrder>>,
    pub display_buffer: Option<Vec<u64>>,
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
        has_header: bool,
    ) -> Self {
        let readonly = match kind {
            DataTableKind::CodeRun(_) => true,
            DataTableKind::Import(_) => false,
        };

        let data_table = DataTable {
            kind,
            name: name.into(),
            has_header,
            columns: None,
            sort: None,
            display_buffer: None,
            value,
            readonly,
            spill_error,
            last_modified: Utc::now(),
        };

        // if has_header {
        //     data_table.apply_header_from_first_row();
        // }

        data_table
    }

    /// Direcly creates a new DataTable with the given kind, value, spill_error, and columns.
    pub fn new_raw(
        kind: DataTableKind,
        name: &str,
        has_header: bool,
        columns: Option<Vec<DataTableColumn>>,
        sort: Option<Vec<DataTableSortOrder>>,
        display_buffer: Option<Vec<u64>>,
        value: Value,
        readonly: bool,
        spill_error: bool,
    ) -> Self {
        DataTable {
            kind,
            name: name.into(),
            has_header,
            columns,
            sort,
            display_buffer,
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
    pub fn apply_first_row_as_header(&mut self) {
        self.columns = match self.value {
            // Value::Array(ref mut array) => array.shift().ok().map(|array| {
            Value::Array(ref mut array) => array.get_row(0).ok().map(|array| {
                array
                    .iter()
                    .enumerate()
                    .map(|(i, value)| DataTableColumn::new(value.to_string(), true, i as u32))
                    .collect::<Vec<DataTableColumn>>()
            }),
            _ => None,
        };
    }

    pub fn toggle_first_row_as_header(&mut self, first_row_as_header: bool) {
        self.has_header = first_row_as_header;

        match first_row_as_header {
            true => self.apply_first_row_as_header(),
            false => self.columns = None,
        }
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

    pub fn sort(&mut self, column_index: usize, direction: SortDirection) -> Result<()> {
        let values = self.value.clone().into_array()?;
        let increment = |i| if self.has_header { i + 1 } else { i };

        let mut display_buffer = values
            .col(column_index)
            .skip(increment(0))
            .enumerate()
            .sorted_by(|a, b| match direction {
                SortDirection::Ascending => a.1.total_cmp(b.1),
                SortDirection::Descending => b.1.total_cmp(a.1),
            })
            .map(|(i, _)| increment(i) as u64)
            .collect::<Vec<u64>>();

        if self.has_header {
            display_buffer.insert(0, 0);
        }

        self.display_buffer = Some(display_buffer);

        Ok(())
    }

    pub fn display_value_from_buffer(&self, display_buffer: &Vec<u64>) -> Result<Value> {
        let value = self.value.to_owned().into_array()?;

        let values = display_buffer
            .iter()
            .filter_map(|index| {
                value
                    .get_row(*index as usize)
                    .map(|row| row.into_iter().cloned().collect::<Vec<CellValue>>())
                    .ok()
            })
            .collect::<Vec<Vec<CellValue>>>();

        let array = Array::from(values);

        Ok(array.into())
    }

    pub fn display_value_from_buffer_at(
        &self,
        display_buffer: &Vec<u64>,
        pos: Pos,
    ) -> Result<&CellValue> {
        let y = display_buffer
            .get(pos.y as usize)
            .ok_or_else(|| anyhow!("Y {} out of bounds: {}", pos.y, display_buffer.len()))?;
        let cell_value = self.value.get(pos.x as u32, *y as u32)?;

        Ok(cell_value)
    }

    pub fn display_value(&self) -> Result<Value> {
        match self.display_buffer {
            Some(ref display_buffer) => self.display_value_from_buffer(display_buffer),
            None => Ok(self.value.to_owned()),
        }
    }

    pub fn display_value_at(&self, pos: Pos) -> Result<&CellValue> {
        match self.display_buffer {
            Some(ref display_buffer) => self.display_value_from_buffer_at(display_buffer, pos),
            None => Ok(self.value.get(pos.x as u32, pos.y as u32)?),
        }
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

    pub fn pretty_print_data_table(
        data_table: &DataTable,
        title: Option<&str>,
        max: Option<usize>,
    ) -> String {
        let mut builder = Builder::default();
        let array = data_table.display_value().unwrap().into_array().unwrap();
        let max = max.unwrap_or(array.height() as usize);
        let title = title.unwrap_or("Data Table");

        if let Some(columns) = data_table.columns.as_ref() {
            let columns = columns.iter().map(|c| c.name.clone()).collect::<Vec<_>>();
            builder.set_header(columns);
        }

        for row in array.rows().take(max) {
            let row = row.iter().map(|s| s.to_string()).collect::<Vec<_>>();
            builder.push_record(row);
        }

        let mut table = builder.build();
        table.with(Style::modern());

        // bold the headers if they exist
        if let Some(columns) = data_table.columns.as_ref() {
            columns.iter().enumerate().for_each(|(index, _)| {
                table.with(Modify::new((0, index)).with(Color::BOLD));
            });
        }

        format!("\nData Table: {title}\n{table}")
    }
}

#[cfg(test)]
pub mod test {
    use std::collections::HashSet;

    use super::*;
    use crate::{controller::GridController, grid::SheetId, Array};
    use serial_test::parallel;

    pub fn test_csv_values() -> Vec<Vec<&'static str>> {
        vec![
            vec!["city", "region", "country", "population"],
            vec!["Southborough", "MA", "United States", "1000"],
            vec!["Denver", "CO", "United States", "10000"],
            vec!["Seattle", "WA", "United States", "100"],
        ]
    }

    pub fn new_data_table() -> (Sheet, DataTable) {
        let sheet = GridController::test().grid().sheets()[0].clone();
        let file_name = "test.csv";
        let values = test_csv_values();
        let import = Import::new(file_name.into());
        let array = Array::from_str_vec(values, true).unwrap();
        let data_table = DataTable::from((import.clone(), array, &sheet));

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
        let values = data_table.display_value().unwrap().into_array().unwrap();

        values.get_row(row_index).unwrap().iter().enumerate().for_each(|(index, value)| {
            let value = value.to_string();
            let expected_value = expected[index];
            assert_eq!(&value, expected_value, "Expected row {row_index} to be {expected_value} at col {index}, but got {value}");
        });
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
    fn test_data_table_sort() {
        let (_, mut data_table) = new_data_table();
        data_table.apply_first_row_as_header();

        let mut values = test_csv_values();
        values.remove(0); // remove header row
        pretty_print_data_table(&data_table, Some("Original Data Table"), None);

        // sort by population city ascending
        data_table.sort(0, SortDirection::Ascending).unwrap();
        pretty_print_data_table(&data_table, Some("Sorted by City"), None);
        assert_data_table_row(&data_table, 0, values[1].clone());
        assert_data_table_row(&data_table, 1, values[2].clone());
        assert_data_table_row(&data_table, 2, values[0].clone());

        // sort by population descending
        data_table.sort(3, SortDirection::Descending).unwrap();
        pretty_print_data_table(&data_table, Some("Sorted by Population Descending"), None);
        assert_data_table_row(&data_table, 0, values[1].clone());
        assert_data_table_row(&data_table, 1, values[0].clone());
        assert_data_table_row(&data_table, 2, values[2].clone());
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
