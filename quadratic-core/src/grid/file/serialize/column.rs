use std::collections::BTreeMap;

use anyhow::Result;

use crate::{
    CellValue,
    grid::{Column, Contiguous2D, sheet::columns::SheetColumns},
};

use super::{
    cell_value::{export_cell_value, import_cell_value},
    current,
};

pub(crate) fn import_column_builder(
    columns_schema: Vec<(i64, current::ColumnSchema)>,
) -> SheetColumns {
    let mut columns = BTreeMap::new();
    let mut has_cell_value = Contiguous2D::new();
    for (x, column) in columns_schema {
        let mut col = Column::new(x);
        for (y, value) in column.into_iter() {
            let cell_value = import_cell_value(value);
            if !cell_value.is_blank_or_empty_string() {
                has_cell_value.set((x, y).into(), Some(true));
                col.values.insert(y, cell_value);
            }
        }
        columns.insert(x, col);
    }
    (columns, has_cell_value).into()
}

pub(crate) fn export_values(values: BTreeMap<i64, CellValue>) -> current::ColumnSchema {
    values
        .into_iter()
        .map(|(y, value)| (y, export_cell_value(value)))
        .collect()
}

pub(crate) fn export_column_builder(columns: SheetColumns) -> current::ColumnsSchema {
    columns
        .into_iter()
        .map(|(x, column)| (x, export_values(column.values)))
        .collect()
}
