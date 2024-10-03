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
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DataTableColumn {
    pub name: String,
    pub display: bool,
}

impl DataTableColumn {
    pub fn new(name: String, display: bool) -> Self {
        DataTableColumn { name, display }
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
    pub columns: Option<Vec<DataTableColumn>>,
    pub value: Value,
    pub spill_error: bool,
    pub last_modified: DateTime<Utc>,
}

impl From<(Import, Array)> for DataTable {
    fn from((import, cell_values): (Import, Array)) -> Self {
        DataTable::new(
            DataTableKind::Import(import),
            Value::Array(cell_values),
            false,
            false,
        )
    }
}

impl DataTable {
    pub fn new(kind: DataTableKind, value: Value, spill_error: bool, header: bool) -> Self {
        let mut data_table = DataTable {
            kind,
            columns: None,
            value,
            spill_error,
            last_modified: Utc::now(),
        };

        if header {
            data_table.apply_header();
        }

        data_table
    }

    pub fn with_last_modified(mut self, last_modified: DateTime<Utc>) -> Self {
        self.last_modified = last_modified;
        self
    }

    pub fn apply_header(&mut self) -> &mut Self {
        self.columns = match &self.value {
            Value::Array(array) => array.rows().next().map(|row| {
                row.iter()
                    .map(|value| DataTableColumn::new(value.to_string(), true))
                    .collect::<Vec<DataTableColumn>>()
            }),
            Value::Single(value) => Some(vec![DataTableColumn::new(value.to_string(), true)]),
            _ => None,
        };

        // TODO(ddimaria): remove first row from array if it's a header

        self
    }

    pub fn code_run(&self) -> Option<&CodeRun> {
        match self.kind {
            DataTableKind::CodeRun(ref code_run) => Some(code_run),
            _ => None,
        }
    }

    pub fn has_error(&self) -> bool {
        match self.kind {
            DataTableKind::CodeRun(ref code_run) => code_run.error.is_some(),
            _ => false,
        }
    }

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
mod test {
    use std::collections::HashSet;

    use super::*;
    use crate::{grid::SheetId, Array};
    use serial_test::parallel;

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
