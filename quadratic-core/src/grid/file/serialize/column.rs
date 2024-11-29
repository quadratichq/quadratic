use std::collections::{BTreeMap, HashMap};

use anyhow::Result;

use crate::{grid::Column, CellValue};

use super::{
    cell_value::{export_cell_value, import_cell_value},
    current,
};

pub(crate) fn import_column_builder(
    columns: Vec<(i64, current::ColumnSchema)>,
) -> Result<BTreeMap<i64, Column>> {
    columns
        .into_iter()
        .map(|(x, column)| {
            let mut col = Column::new(x);

            // todo: there's probably a better way of doing this
            for (y, value) in column.values.into_iter() {
                let cell_value = import_cell_value(value);
                if let Ok(y) = y.parse::<i64>() {
                    col.values.insert(y, cell_value);
                }
            }

            Ok((x, col))
        })
        .collect::<Result<BTreeMap<i64, Column>>>()
}

pub(crate) fn export_values(
    values: BTreeMap<i64, CellValue>,
) -> HashMap<String, current::CellValueSchema> {
    values
        .into_iter()
        .map(|(y, value)| (y.to_string(), export_cell_value(value)))
        .collect()
}

pub(crate) fn export_column_builder(
    columns: BTreeMap<i64, Column>,
) -> Vec<(i64, current::ColumnSchema)> {
    columns
        .into_iter()
        .map(|(x, column)| {
            (
                x,
                current::ColumnSchema {
                    values: export_values(column.values),
                },
            )
        })
        .collect()
}
