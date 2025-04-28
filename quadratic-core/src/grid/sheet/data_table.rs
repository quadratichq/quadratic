use super::Sheet;
use crate::{
    Pos, Rect, SheetPos,
    a1::{A1Context, A1Selection},
    cell_values::CellValues,
    grid::{
        CodeCellLanguage, CodeCellValue, DataTableKind,
        data_table::DataTable,
        formats::{FormatUpdate, SheetFormatUpdates},
    },
};

use anyhow::{Result, anyhow, bail};
use indexmap::{
    IndexMap,
    map::{Entry, OccupiedEntry},
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

    /// Gets the index of the data table
    pub fn data_table_index(&self, pos: Pos) -> Option<usize> {
        self.data_tables.get_index_of(&pos)
    }

    /// Returns the index of the data table as a result.
    pub fn data_table_index_result(&self, pos: Pos) -> Result<usize> {
        self.data_table_index(pos).ok_or_else(|| {
            anyhow!(
                "Data table not found at {:?} in data_table_index_result()",
                pos
            )
        })
    }

    /// Returns a DataTable by name
    pub fn data_table_by_name(&self, name: String) -> Option<(&Pos, &DataTable)> {
        self.data_tables
            .iter()
            .find(|(_, data_table)| *data_table.name() == name)
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

    /// Returns all data tables within a position
    ///
    /// TODO(ddimaria): make this more efficient
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

    /// Returns all data tables within a rect.
    /// Partial intersection is also considered a match.
    /// Stops at the first data table if stop_at_first is true.
    ///
    /// TODO(ddimaria): make this more efficient
    pub fn data_tables_within_rect(&self, rect: Rect, stop_at_first: bool) -> Result<Vec<Pos>> {
        let mut found = false;
        let data_tables = self
            .data_tables
            .iter()
            .filter_map(|(data_table_pos, data_table)| {
                if found && stop_at_first {
                    return None;
                }

                let output = data_table
                    .output_rect(*data_table_pos, false)
                    .intersects(rect)
                    .then_some(*data_table_pos);

                found = found || output.is_some();

                output
            })
            .collect();

        Ok(data_tables)
    }

    /// Returns true if there is a data table within a rect
    pub fn contains_data_table_within_rect(&self, rect: Rect) -> bool {
        self.data_tables_within_rect(rect, true)
            .map(|data_tables| !data_tables.is_empty())
            .unwrap_or(false)
    }

    /// Returns the first data table within a position
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

    /// Calls a function to mutate all code cells.
    pub fn update_code_cells(&mut self, func: impl Fn(&mut CodeCellValue, SheetPos)) {
        let positions = self.data_tables.keys().cloned().collect::<Vec<_>>();
        let sheet_id = self.id;

        for pos in positions {
            if let Some(cell_value) = self.cell_value_mut(pos) {
                if let Some(code_cell_value) = cell_value.code_cell_value_mut() {
                    func(code_cell_value, pos.to_sheet_pos(sheet_id));
                }
            }
        }
    }

    /// Replaces the table name in all code cells that reference the old name.
    pub fn replace_table_name_in_code_cells(
        &mut self,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
    ) {
        self.update_code_cells(|code_cell_value, pos| {
            code_cell_value
                .replace_table_name_in_cell_references(a1_context, pos, old_name, new_name);
        });
    }

    /// Replaces the column name in all code cells that reference the old name.
    pub fn replace_table_column_name_in_code_cells(
        &mut self,
        table_name: &str,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
    ) {
        self.update_code_cells(|code_cell_value, pos| {
            code_cell_value.replace_column_name_in_cell_references(
                a1_context, pos, table_name, old_name, new_name,
            );
        });
    }

    pub fn data_tables_and_cell_values_in_rect(
        &self,
        rect: &Rect,
        cells: &mut CellValues,
        values: &mut CellValues,
        a1_context: &A1Context,
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
                            if selection.might_contain_pos(Pos { x, y }, a1_context) {
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

    /// Converts a format update to a SheetFormatUpdates
    pub fn to_sheet_format_updates(
        &self,
        sheet_pos: SheetPos,
        data_table_pos: Pos,
        format_update: FormatUpdate,
    ) -> Result<SheetFormatUpdates> {
        let data_table = self.data_table_result(data_table_pos)?;

        Ok(SheetFormatUpdates::from_selection(
            &A1Selection::from_xy(
                sheet_pos.x - data_table_pos.x + 1,
                sheet_pos.y - data_table_pos.y + 1 - data_table.y_adjustment(true),
                sheet_pos.sheet_id,
            ),
            format_update,
        ))
    }

    /// Returns columns and rows to data tables when the cells to add are touching the data table
    #[allow(clippy::type_complexity)]
    pub fn expand_columns_and_rows(
        &self,
        data_tables: &[Rect],
        sheet_pos: SheetPos,
        value: String,
    ) -> (Option<(SheetPos, u32)>, Option<(SheetPos, u32)>) {
        let mut columns = None;
        let mut rows = None;

        if !value.is_empty() {
            columns = self.expand_columns(data_tables, sheet_pos);
            rows = self.expand_rows(data_tables, sheet_pos);
        }

        (columns, rows)
    }

    /// Returns columns to data tables when the cells to add are touching the data table
    pub fn expand_columns(
        &self,
        data_tables: &[Rect],
        sheet_pos: SheetPos,
    ) -> Option<(SheetPos, u32)> {
        let pos = Pos::from(sheet_pos);

        if pos.x > 1 {
            let pos_to_check = Pos::new(pos.x - 1, pos.y);
            let data_table_left = data_tables.iter().find(|rect| rect.contains(pos_to_check));

            if let Some(data_table_left) = data_table_left {
                // don't expand if we're not at the end of the data table
                if data_table_left.max.x != pos_to_check.x {
                    return None;
                }

                if self
                    .data_table(data_table_left.min)
                    .filter(|data_table| {
                        // don't expand if the data table is readonly
                        if data_table.is_code() {
                            return false;
                        }

                        // don't expand if the position is at the data table's name
                        if data_table.get_show_name() && data_table_left.min.y == pos.y {
                            return false;
                        }

                        // don't expand if next column is not blank
                        for y in 0..data_table_left.height() {
                            let pos = Pos::new(pos.x, data_table_left.min.y + y as i64);

                            if self.has_content(pos) {
                                return false;
                            }
                        }

                        true
                    })
                    .is_some()
                {
                    let sheet_pos = (data_table_left.min, sheet_pos.sheet_id).into();
                    let mut column_index = data_table_left.width();

                    // the column index is the display index, not the actual index, we need to convert it to the actual index
                    if let Ok(data_table) = self.data_table_result(data_table_left.min) {
                        column_index =
                            data_table.get_column_index_from_display_index(column_index, true);
                    }

                    return Some((sheet_pos, column_index));
                }
            }
        }

        None
    }

    /// Returns rows to data tables when the cells to add are touching the data table
    pub fn expand_rows(
        &self,
        data_tables: &[Rect],
        sheet_pos: SheetPos,
    ) -> Option<(SheetPos, u32)> {
        let pos = Pos::from(sheet_pos);

        if pos.y > 1 {
            let pos_to_check = Pos::new(pos.x, pos.y - 1);
            let data_table_above = data_tables.iter().find(|rect| rect.contains(pos_to_check));

            if let Some(data_table_above) = data_table_above {
                // don't expand if we're not at the bottom of the data table
                if data_table_above.max.y != pos_to_check.y {
                    return None;
                }

                if self
                    .data_table(data_table_above.min)
                    .filter(|data_table| {
                        // don't expand if the data table is readonly
                        if data_table.is_code() {
                            return false;
                        }

                        // don't expand if next row is not blank
                        for x in 0..data_table_above.width() {
                            let pos = Pos::new(data_table_above.min.x + x as i64, pos.y);
                            if self.has_content(pos) {
                                return false;
                            }
                        }

                        true
                    })
                    .is_some()
                {
                    let sheet_pos = (data_table_above.min, sheet_pos.sheet_id).into();
                    let row_index = data_table_above.height();

                    return Some((sheet_pos, row_index));
                }
            }
        }

        None
    }

    /// Returns the code language at a pos
    pub fn code_language_at(&self, pos: Pos) -> Option<CodeCellLanguage> {
        self.data_table(pos)
            .map(|data_table| data_table.get_language())
    }

    /// Returns true if the cell at pos is a formula cell
    pub fn is_formula_cell(&self, pos: Pos) -> bool {
        self.code_language_at(pos)
            .is_some_and(|lang| lang == CodeCellLanguage::Formula)
    }

    /// Returns true if the cell at pos is a source cell
    pub fn is_source_cell(&self, pos: Pos) -> bool {
        self.data_table(pos).is_some()
    }

    /// You shouldn't be able to create a data table that includes a data table.
    /// Deny the action and give a popup explaining why it was blocked.
    /// Returns true if the data table is not within the rect
    pub fn enforce_no_data_table_within_rect(&self, rect: Rect) -> bool {
        let contains_data_table = self.contains_data_table_within_rect(rect);

        #[cfg(any(target_family = "wasm", test))]
        if contains_data_table {
            let message = "Tables cannot be created over tables, code, or formulas.";
            let severity = crate::grid::js_types::JsSnackbarSeverity::Error;
            crate::wasm_bindings::js::jsClientMessage(message.into(), severity.to_string());
        }

        !contains_data_table
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        CellValue, Value,
        a1::{A1Selection, RefRangeBounds},
        controller::{
            GridController,
            operations::clipboard::{ClipboardOperation, PasteSpecial},
            user_actions::import::tests::simple_csv,
        },
        first_sheet_id,
        grid::{CodeRun, DataTableKind, SheetId, js_types::JsClipboard},
        test_create_code_table, test_create_data_table,
    };
    use bigdecimal::BigDecimal;

    pub fn code_data_table(sheet: &mut Sheet, pos: Pos) -> (DataTable, Option<DataTable>) {
        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "=1".to_string(),
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
            None,
            None,
            None,
        );

        let old = sheet.set_data_table(pos, Some(data_table.clone()));
        sheet.set_cell_value(
            pos,
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "=1".to_string(),
            }),
        );

        (data_table, old)
    }

    // setup the grid controller, sheet, and data table at pos
    fn test_setup(pos: Pos) -> (GridController, SheetId, DataTable, Option<DataTable>) {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        // insert the data table at pos
        let (data_table, old) = code_data_table(sheet, pos);

        (gc, sheet_id, data_table, old)
    }

    #[test]
    fn test_set_data_table() {
        let (mut gc, sheet_id, data_table, old) = test_setup(pos![A1]);
        let sheet = gc.sheet_mut(sheet_id);

        assert_eq!(old, None);
        assert_eq!(sheet.data_table(pos![A1]), Some(&data_table));
        assert_eq!(sheet.data_table(pos![B2]), None);
    }

    #[test]
    fn test_get_data_table() {
        let (mut gc, sheet_id, data_table, _) = test_setup(pos![A1]);
        let sheet = gc.sheet_mut(sheet_id);

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
        let (mut gc, sheet_id, _, _) = test_setup(pos![A1]);
        let sheet = gc.sheet_mut(sheet_id);

        // Insert data table at A1
        let _ = code_data_table(sheet, pos![A1]);

        // Test position within the data table
        let result = sheet.data_table_at(pos![A1]);
        assert!(result.is_some());

        let (pos, dt) = result.unwrap();
        assert_eq!(pos, pos![A1]);
        assert_eq!(dt.name.to_display(), "Table 1");

        // Test position outside the data table
        assert!(sheet.data_table_at(pos![D4]).is_none());
    }

    #[test]
    fn test_is_language_at() {
        let (mut gc, sheet_id, _, _) = test_setup(pos![A1]);
        let sheet = gc.sheet_mut(sheet_id);

        assert_eq!(
            sheet.code_language_at(pos![A1]),
            Some(CodeCellLanguage::Formula)
        );
    }

    #[test]
    fn test_is_formula_cell() {
        let (mut gc, sheet_id, _, _) = test_setup(pos![A1]);
        let sheet = gc.sheet_mut(sheet_id);

        assert!(sheet.is_formula_cell(pos![A1]));
    }

    #[test]
    fn test_is_source_cell() {
        let (mut gc, sheet_id, _, _) = test_setup(pos![A1]);
        let sheet = gc.sheet_mut(sheet_id);

        assert!(sheet.is_source_cell(pos![A1]));
    }

    #[test]
    fn test_data_table_index() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);
        test_create_code_table(&mut gc, sheet_id, pos![E2], 3, 3);

        let sheet = gc.sheet(sheet_id);

        // Test that the data table index is 0 for the first data table
        assert_eq!(sheet.data_table_index(pos![A1]), Some(0));

        // Test that a non-existent data table returns None
        assert_eq!(sheet.data_table_index(pos![B2]), None);

        // The second data table should have index 1
        assert_eq!(sheet.data_table_index(pos![E2]), Some(1));
    }
}
