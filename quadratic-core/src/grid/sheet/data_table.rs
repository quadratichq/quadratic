use super::Sheet;
use crate::{
    a1::{A1Context, A1Selection},
    cell_values::CellValues,
    grid::{data_table::DataTable, CodeCellValue, DataTableKind, SheetId},
    Pos, Rect,
};

use anyhow::{anyhow, bail, Result};
use indexmap::{
    map::{Entry, OccupiedEntry},
    IndexMap,
};

impl Sheet {
    /// Sets or deletes a data table.
    ///
    /// Returns the old value if it was set.
    #[cfg(test)]
    pub fn set_data_table(&mut self, pos: Pos, data_table: Option<DataTable>) -> Option<DataTable> {
        if let Some(data_table) = data_table {
            self.data_tables.insert_sorted(pos, data_table).1
        } else {
            self.data_tables.shift_remove(&pos)
        }
    }

    /// Returns a DataTable at a Pos
    pub fn data_table(&self, pos: Pos) -> Option<&DataTable> {
        self.data_tables.get(&pos)
    }

    /// Returns a DataTable by name
    pub fn data_table_by_name(&self, name: String) -> Option<(&Pos, &DataTable)> {
        self.data_tables
            .iter()
            .find(|(_, data_table)| data_table.name.to_display() == name)
    }

    /// Returns a DataTable at a Pos as a result
    pub fn data_table_result(&self, pos: Pos) -> Result<&DataTable> {
        self.data_tables
            .get(&pos)
            .ok_or_else(|| anyhow!("Data table not found at {:?} in data_table_result()", pos))
    }

    /// Returns a mutable DataTable at a Pos
    pub fn data_table_mut(&mut self, pos: Pos) -> Result<&mut DataTable> {
        self.data_tables
            .get_mut(&pos)
            .ok_or_else(|| anyhow!("Data table not found at {:?} in data_table_mut()", pos))
    }

    /// Returns a DataTable entry at a Pos for in-place manipulation
    pub fn data_table_entry(&mut self, pos: Pos) -> Result<OccupiedEntry<'_, Pos, DataTable>> {
        let entry = self.data_tables.entry(pos);

        match entry {
            Entry::Occupied(entry) => Ok(entry),
            Entry::Vacant(_) => bail!("Data table not found at {:?} in data_table_entry()", pos),
        }
    }

    pub fn delete_data_table(&mut self, pos: Pos) -> Result<DataTable> {
        self.data_tables
            .shift_remove(&pos)
            .ok_or_else(|| anyhow!("Data table not found at {:?} in delete_data_table()", pos))
    }

    pub fn data_tables_within(&self, pos: Pos) -> Result<Vec<Pos>> {
        let data_tables = self
            .data_tables
            .iter()
            .filter_map(|(data_table_pos, data_table)| {
                data_table
                    .output_rect(*data_table_pos, false)
                    .contains(pos)
                    .then_some(*data_table_pos)
            })
            .collect();

        Ok(data_tables)
    }

    pub fn first_data_table_within(&self, pos: Pos) -> Result<Pos> {
        let data_tables = self.data_tables_within(pos)?;

        match data_tables.first() {
            Some(pos) => Ok(*pos),
            None => bail!(
                "No data tables found within {:?} in first_data_table_within()",
                pos
            ),
        }
    }

    /// Returns the (Pos, DataTable) that intersects a position
    pub fn data_table_at(&self, pos: Pos) -> Option<(Pos, &DataTable)> {
        self.data_tables
            .iter()
            .find_map(|(data_table_pos, data_table)| {
                data_table
                    .output_rect(*data_table_pos, false)
                    .contains(pos)
                    .then_some((*data_table_pos, data_table))
            })
    }

    /// Checks whether a chart intersects a position. We ignore the chart if it
    /// includes either exclude_x or exclude_y.
    pub fn chart_intersects(
        &self,
        x: i64,
        y: i64,
        exclude_x: Option<i64>,
        exclude_y: Option<i64>,
    ) -> bool {
        self.data_tables.iter().any(|(data_table_pos, data_table)| {
            // we only care about html or image tables
            if !data_table.is_html_or_image() {
                return false;
            }
            let output_rect = data_table.output_rect(*data_table_pos, false);
            if output_rect.contains(Pos { x, y }) {
                if let Some(exclude_x) = exclude_x {
                    if exclude_x >= output_rect.min.x && exclude_x <= output_rect.max.x {
                        return false;
                    }
                }
                if let Some(exclude_y) = exclude_y {
                    if exclude_y >= output_rect.min.y && exclude_y <= output_rect.max.y {
                        return false;
                    }
                }
                true
            } else {
                false
            }
        })
    }

    pub fn replace_in_code_cells(
        &mut self,
        context: &A1Context,
        func: impl Fn(&mut CodeCellValue, &A1Context, &SheetId),
    ) {
        let positions = self.data_tables.keys().cloned().collect::<Vec<_>>();
        let sheet_id = self.id;

        for pos in positions {
            if let Some(cell_value) = self.cell_value_mut(pos) {
                if let Some(code_cell_value) = cell_value.code_cell_value_mut() {
                    func(code_cell_value, context, &sheet_id);
                }
            }
        }
    }

    /// Replaces the table name in all code cells that reference the old name.
    pub fn replace_table_name_in_code_cells(
        &mut self,
        old_name: &str,
        new_name: &str,
        context: &A1Context,
    ) {
        self.replace_in_code_cells(context, |code_cell_value, a1_context, id| {
            code_cell_value
                .replace_table_name_in_cell_references(old_name, new_name, id, a1_context);
        });
    }

    /// Replaces the column name in all code cells that reference the old name.
    pub fn replace_table_column_name_in_code_cells(
        &mut self,
        table_name: &str,
        old_name: &str,
        new_name: &str,
        context: &A1Context,
    ) {
        self.replace_in_code_cells(context, |code_cell_value, a1_context, id| {
            code_cell_value.replace_column_name_in_cell_references(
                table_name, old_name, new_name, id, a1_context,
            );
        });
    }

    pub fn data_tables_and_cell_values_in_rect(
        &self,
        rect: &Rect,
        cells: &mut CellValues,
        values: &mut CellValues,
        context: &A1Context,
        selection: &A1Selection,
        include_code_table_values: bool,
    ) -> IndexMap<Pos, DataTable> {
        let mut data_tables = IndexMap::new();

        self.iter_code_output_in_rect(rect.to_owned())
            .for_each(|(output_rect, data_table)| {
                // only change the cells if the CellValue::Code is not in the selection box
                let data_table_pos = Pos {
                    x: output_rect.min.x,
                    y: output_rect.min.y,
                };

                // add the CellValue to cells if the code is not included in the clipboard
                let include_in_cells = !rect.contains(data_table_pos);

                // if the source cell is included in the clipboard, add the data_table to the clipboard
                if !include_in_cells {
                    if matches!(data_table.kind, DataTableKind::Import(_))
                        || include_code_table_values
                    {
                        data_tables.insert(data_table_pos, data_table.clone());
                    } else {
                        data_tables.insert(data_table_pos, data_table.clone_without_values());
                    }
                }

                if data_table.spill_error {
                    return;
                }

                let x_start = std::cmp::max(output_rect.min.x, rect.min.x);
                let y_start = std::cmp::max(output_rect.min.y, rect.min.y);
                let x_end = std::cmp::min(output_rect.max.x, rect.max.x);
                let y_end = std::cmp::min(output_rect.max.y, rect.max.y);

                // add the code_run output to clipboard.values
                for y in y_start..=y_end {
                    for x in x_start..=x_end {
                        if let Some(value) = data_table.cell_value_at(
                            (x - data_table_pos.x) as u32,
                            (y - data_table_pos.y) as u32,
                        ) {
                            let pos = Pos {
                                x: x - rect.min.x,
                                y: y - rect.min.y,
                            };
                            if selection.might_contain_pos(Pos { x, y }, context) {
                                if include_in_cells {
                                    cells.set(pos.x as u32, pos.y as u32, value.clone());
                                }

                                values.set(pos.x as u32, pos.y as u32, value);
                            }
                        }
                    }
                }
            });

        data_tables
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        a1::{A1Selection, RefRangeBounds},
        controller::{
            operations::clipboard::{ClipboardOperation, PasteSpecial},
            user_actions::import::tests::simple_csv,
            GridController,
        },
        grid::{js_types::JsClipboard, CodeRun, DataTableKind},
        CellValue, Value,
    };
    use bigdecimal::BigDecimal;

    #[test]
    fn test_set_data_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut(sheet_id).unwrap();
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
            Value::Single(CellValue::Number(BigDecimal::from(2))),
            false,
            false,
            true,
            None,
        );
        let old = sheet.set_data_table(Pos { x: 0, y: 0 }, Some(data_table.clone()));
        assert_eq!(old, None);
        assert_eq!(sheet.data_table(Pos { x: 0, y: 0 }), Some(&data_table));
        assert_eq!(sheet.data_table(Pos { x: 0, y: 0 }), Some(&data_table));
        assert_eq!(sheet.data_table(Pos { x: 1, y: 0 }), None);
    }

    #[test]
    fn test_get_data_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single(CellValue::Number(BigDecimal::from(2))),
            false,
            false,
            false,
            None,
        );
        sheet.set_data_table(pos![A1], Some(data_table.clone()));
        assert_eq!(
            sheet.get_code_cell_value(pos![A1]),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(sheet.data_table(pos![A1]), Some(&data_table));
        assert_eq!(sheet.data_table(pos![B2]), None);
    }

    #[test]
    fn test_copy_data_table_to_clipboard() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        // let sheet_pos = SheetPos::from((pos, sheet_id));
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        data_table.chart_pixel_output = Some((100.0, 100.0));
        let selection =
            A1Selection::from_ref_range_bounds(sheet_id, RefRangeBounds::new_relative_pos(pos));

        let JsClipboard { html, .. } = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, false)
            .unwrap();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(10, 10, sheet_id),
            None,
            Some(html),
            PasteSpecial::None,
            None,
        );

        println!(
            "data_table : {:?}",
            gc.sheet_mut(sheet_id)
                .data_table(Pos::new(10, 10))
                .unwrap()
                .chart_pixel_output
        );
        // assert_eq!(clipboard.html, data_table.html());
    }

    #[test]
    fn test_data_table_at() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };

        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Single(CellValue::Number(BigDecimal::from(2))),
            false,
            false,
            false,
            None,
        );

        // Insert data table at A1
        sheet.set_data_table(pos![A1], Some(data_table.clone()));

        // Test position within the data table
        let result = sheet.data_table_at(pos![A1]);
        assert!(result.is_some());
        let (pos, dt) = result.unwrap();
        assert_eq!(pos, pos![A1]);
        assert_eq!(dt.name.to_display(), "Table 1");

        // Test position outside the data table
        assert!(sheet.data_table_at(pos![D4]).is_none());
    }
}
