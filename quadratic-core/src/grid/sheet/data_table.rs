use std::collections::HashSet;

use super::Sheet;
use crate::{
    CellValue, Pos, Rect, SheetPos,
    a1::{A1Context, A1Selection},
    cell_values::CellValues,
    grid::{
        CodeCellLanguage, CodeRun, DataTableKind,
        data_table::DataTable,
        formats::{FormatUpdate, SheetFormatUpdates},
    },
};

use anyhow::{Result, anyhow, bail};
use indexmap::IndexMap;

impl Sheet {
    /// Returns a DataTable at a Pos
    pub fn data_table_at(&self, pos: &Pos) -> Option<&DataTable> {
        self.data_tables.get_at(pos)
    }

    pub fn data_table_full_at(&self, pos: &Pos) -> Option<(usize, &DataTable)> {
        self.data_tables.get_full_at(pos)
    }

    pub fn code_run_at(&self, pos: &Pos) -> Option<&CodeRun> {
        // First check if there's a CellValue::Code in the columns
        if let Some(CellValue::Code(code_cell)) = self.cell_value_ref(*pos) {
            return Some(&code_cell.code_run);
        }
        // Otherwise check the data_tables
        self.data_tables.get_at(pos).and_then(|dt| dt.code_run())
    }

    /// Returns the (Pos, DataTable) that intersects a position
    pub fn data_table_that_contains(&self, pos: Pos) -> Option<(Pos, &DataTable)> {
        self.data_tables.get_contains(pos)
    }

    /// Returns the data table pos if the data table intersects a position
    pub fn data_table_pos_that_contains(&self, pos: Pos) -> Option<Pos> {
        self.data_tables.get_pos_contains(pos)
    }

    /// Returns the data table (import / editable) pos if the data table is an import
    pub fn data_table_import_pos_that_contains(&self, pos: Pos) -> Option<Pos> {
        self.data_tables
            .get_pos_contains(pos)
            .and_then(|data_table_pos| {
                self.data_tables.get_at(&data_table_pos).and_then(|dt| {
                    if matches!(dt.kind, DataTableKind::Import(_)) {
                        Some(data_table_pos)
                    } else {
                        None
                    }
                })
            })
    }

    /// Returns the data table pos of the data table that contains a position
    pub fn data_table_pos_that_contains_result(&self, pos: Pos) -> Result<Pos> {
        if let Some(data_table_pos) = self.data_tables.get_pos_contains(pos) {
            Ok(data_table_pos)
        } else {
            bail!(
                "No data tables found within {:?} in data_table_pos_that_contains_result()",
                pos
            )
        }
    }

    /// Returns the data table pos of the data table that contains a position
    pub fn is_in_non_single_code_cell_code_table(&self, pos: Pos) -> bool {
        if let Some(data_table_pos) = self.data_tables.get_pos_contains(pos) {
            if pos != data_table_pos {
                true
            } else if let Some(data_table) = self.data_tables.get_at(&data_table_pos) {
                if !matches!(data_table.kind, DataTableKind::CodeRun(_)) {
                    true
                } else {
                    !data_table.is_single_value()
                }
            } else {
                false
            }
        } else {
            false
        }
    }

    /// Returns anchor positions of data tables that intersect a rect
    pub fn data_tables_pos_intersect_rect(
        &self,
        rect: Rect,
        ignore_spill_error: bool,
    ) -> impl Iterator<Item = Pos> {
        self.data_tables.iter_pos_in_rect(rect, ignore_spill_error)
    }

    /// Returns anchor positions of data tables that intersect a rect, sorted by index
    pub fn data_tables_pos_intersect_rect_sorted(&self, rect: Rect) -> impl Iterator<Item = Pos> {
        self.data_tables
            .get_in_rect_sorted(rect, false)
            .map(|(_, pos, _)| pos)
    }

    /// Returns data tables that intersect a rect, sorted by index
    pub fn data_tables_intersect_rect_sorted(
        &self,
        rect: Rect,
    ) -> impl Iterator<Item = (usize, Pos, &DataTable)> {
        self.data_tables.get_in_rect_sorted(rect, false)
    }

    /// Returns data tables that intersect a rect, sorted by index
    pub fn data_tables_output_rects_intersect_rect(
        &self,
        rect: Rect,
        filter: impl Fn(&Pos, &DataTable) -> bool,
    ) -> impl Iterator<Item = Rect> {
        self.data_tables
            .get_in_rect(rect, false)
            .filter(move |(_, pos, data_table)| filter(pos, data_table))
            .map(|(_, data_table_pos, data_table)| data_table.output_rect(data_table_pos, false))
    }

    /// Returns true if there is a data table or CellValue::Code intersecting a rect, excluding a specific position.
    /// TODO: Remove CellValue::Code check once we support code cells inside tables.
    pub fn contains_data_table_within_rect(&self, rect: Rect, skip: Option<&Pos>) -> bool {
        // Check for DataTables
        if self
            .data_tables_pos_intersect_rect(rect, false)
            .any(|pos| skip != Some(&pos))
        {
            return true;
        }
        // Check for CellValue::Code in the rect
        for y in rect.y_range() {
            for x in rect.x_range() {
                let pos = Pos { x, y };
                if skip == Some(&pos) {
                    continue;
                }
                if matches!(self.cell_value_ref(pos), Some(CellValue::Code(_))) {
                    return true;
                }
            }
        }
        false
    }

    /// Returns a DataTable at a Pos as a result
    pub fn data_table_result(&self, pos: &Pos) -> Result<&DataTable> {
        self.data_table_at(pos)
            .ok_or_else(|| anyhow!("Data table not found at {:?} in data_table_result()", pos))
    }

    /// Checks spill due to values on sheet
    ///
    /// spill due to other data tables is managed internally by SheetDataTables
    fn check_spills_due_to_column_values(&self, pos: Pos, data_table: &DataTable) -> bool {
        let output_rect = data_table.output_rect(pos, true);
        // Exclude the code cell's own position to avoid false positives when
        // a CellValue::Code is being replaced by a DataTable (or vice versa)
        self.columns.has_content_in_rect_except(output_rect, pos)
    }

    /// Checks spill due to merged cells on sheet
    ///
    /// Returns true if the data table's output would overlap any merged cells
    fn check_spills_due_to_merged_cells(&self, pos: Pos, data_table: &DataTable) -> bool {
        let output_rect = data_table.output_rect(pos, true);
        !self.merge_cells.get_merge_cells(output_rect).is_empty()
    }

    /// Returns a mutable DataTable at a Pos
    pub fn modify_data_table_at(
        &mut self,
        pos: &Pos,
        f: impl FnOnce(&mut DataTable) -> Result<()>,
    ) -> Result<(&DataTable, HashSet<Rect>)> {
        self.data_tables.modify_data_table_at(pos, f)
    }

    pub fn data_table_insert_full(
        &mut self,
        pos: Pos,
        mut data_table: DataTable,
    ) -> (Option<CellValue>, usize, Option<DataTable>, HashSet<Rect>) {
        let old_cell_value = match self.columns.has_content_in_rect(Rect::single_pos(pos)) {
            true => self.set_value(pos, CellValue::Blank),
            false => None,
        };
        data_table.spill_value = self.check_spills_due_to_column_values(pos, &data_table);
        data_table.spill_merged_cell = self.check_spills_due_to_merged_cells(pos, &data_table);
        let (index, old_data_table, dirty_rects) = self.data_tables.insert_full(pos, data_table);
        (old_cell_value, index, old_data_table, dirty_rects)
    }

    pub fn data_table_insert_before(
        &mut self,
        index: usize,
        pos: Pos,
        mut data_table: DataTable,
    ) -> (Option<CellValue>, usize, Option<DataTable>, HashSet<Rect>) {
        let old_cell_value = match self.columns.has_content_in_rect(Rect::single_pos(pos)) {
            true => self.set_value(pos, CellValue::Blank),
            false => None,
        };
        data_table.spill_value = self.check_spills_due_to_column_values(pos, &data_table);
        data_table.spill_merged_cell = self.check_spills_due_to_merged_cells(pos, &data_table);
        let (index, old_data_table, dirty_rects) =
            self.data_tables.insert_before(index, pos, data_table);
        (old_cell_value, index, old_data_table, dirty_rects)
    }

    pub fn data_table_shift_remove_full(
        &mut self,
        pos: &Pos,
    ) -> Option<(usize, Pos, DataTable, HashSet<Rect>)> {
        self.data_tables.shift_remove_full(pos)
    }

    pub fn data_table_shift_remove(
        &mut self,
        pos: Pos,
    ) -> Option<(usize, DataTable, HashSet<Rect>)> {
        self.data_tables.shift_remove(&pos)
    }

    pub fn delete_data_table(&mut self, pos: Pos) -> Result<(usize, DataTable, HashSet<Rect>)> {
        self.data_table_shift_remove(pos)
            .ok_or_else(|| anyhow!("Data table not found at {:?} in delete_data_table()", pos))
    }

    pub fn data_tables_update_spill(&mut self, rect: Rect) -> HashSet<Rect> {
        let mut data_tables_to_modify = Vec::new();

        for (_, pos, data_table) in self.data_tables.get_in_rect_sorted(rect, true) {
            let new_spill_value = self.check_spills_due_to_column_values(pos, data_table);
            let new_spill_merged_cell = self.check_spills_due_to_merged_cells(pos, data_table);
            if new_spill_value != data_table.spill_value
                || new_spill_merged_cell != data_table.spill_merged_cell
            {
                data_tables_to_modify.push((pos, new_spill_value, new_spill_merged_cell));
            }
        }

        let mut dirty_rects = HashSet::new();

        for (pos, new_spill_value, new_spill_merged_cell) in data_tables_to_modify {
            if let Ok((_, dirty_rect)) = self.data_tables.modify_data_table_at(&pos, |dt| {
                dt.spill_value = new_spill_value;
                dt.spill_merged_cell = new_spill_merged_cell;
                Ok(())
            }) {
                dirty_rects.extend(dirty_rect);
            }
        }

        dirty_rects
    }

    /// Returns data tables that intersect a rect
    pub fn iter_data_tables_in_rect(&self, rect: Rect) -> impl Iterator<Item = (Rect, &DataTable)> {
        self.data_tables_intersect_rect_sorted(rect)
            .map(|(_, pos, data_table)| {
                let output_rect = data_table.output_rect(pos, false);
                (output_rect, data_table)
            })
    }

    /// Returns data tables that intersect a rect and their intersection with the rect
    pub fn iter_data_tables_intersects_rect(
        &self,
        rect: Rect,
    ) -> impl Iterator<Item = (Rect, Rect, &DataTable)> {
        self.data_tables_intersect_rect_sorted(rect)
            .filter_map(move |(_, pos, data_table)| {
                let output_rect = data_table.output_rect(pos, false);
                output_rect
                    .intersection(&rect)
                    .map(|intersection_rect| (output_rect, intersection_rect, data_table))
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
        self.data_table_that_contains(Pos { x, y })
            .is_some_and(|(data_table_pos, data_table)| {
                // we only care about html or image tables
                if !data_table.is_html_or_image() {
                    return false;
                }
                let output_rect = data_table.output_rect(data_table_pos, false);
                if let Some(exclude_x) = exclude_x
                    && exclude_x >= output_rect.min.x
                    && exclude_x <= output_rect.max.x
                {
                    return false;
                }
                if let Some(exclude_y) = exclude_y
                    && exclude_y >= output_rect.min.y
                    && exclude_y <= output_rect.max.y
                {
                    return false;
                }
                true
            })
    }

    /// Returns data tables that intersect the selection and corresponding cells
    /// and values
    pub fn data_tables_and_cell_values_in_rect(
        &self,
        bounds: &Rect,
        include_code_table_values: bool,
        a1_context: &A1Context,
        selection: Option<&A1Selection>,
        cells: &mut Option<CellValues>,
        values: &mut Option<CellValues>,
    ) -> IndexMap<Pos, DataTable> {
        let mut data_tables = IndexMap::new();

        // Note: CellValue::Code cells are kept in cells (CellValues) and not
        // converted to DataTable. They are handled separately during paste.

        for (output_rect, data_table) in self.iter_data_tables_in_rect(bounds.to_owned()) {
            let data_table_pos = Pos {
                x: output_rect.min.x,
                y: output_rect.min.y,
            };

            let rect_contains_anchor_pos = bounds.contains(data_table_pos);

            // if the source cell is included in the rect, add the data_table to data_tables
            if rect_contains_anchor_pos {
                // add the data_table to data_tables
                if include_code_table_values || matches!(data_table.kind, DataTableKind::Import(_))
                {
                    // include values for imports
                    data_tables.insert(data_table_pos, data_table.clone());
                } else {
                    // don't include values for code tables
                    data_tables.insert(data_table_pos, data_table.clone_without_values());
                }
            }

            let Some(selection) = selection else {
                continue;
            };

            if (rect_contains_anchor_pos || cells.is_none()) && values.is_none() {
                continue;
            }

            let x_start = std::cmp::max(output_rect.min.x, bounds.min.x);
            let y_start = std::cmp::max(output_rect.min.y, bounds.min.y);
            let x_end = std::cmp::min(output_rect.max.x, bounds.max.x);
            let y_end = std::cmp::min(output_rect.max.y, bounds.max.y);

            // add the code_run output to cells and values
            for y in y_start..=y_end {
                for x in x_start..=x_end {
                    if let Some(value) = data_table.cell_value_ref_at(
                        (x - data_table_pos.x) as u32,
                        (y - data_table_pos.y) as u32,
                    ) {
                        let (Ok(new_x), Ok(new_y)) = (
                            u32::try_from(x - bounds.min.x),
                            u32::try_from(y - bounds.min.y),
                        ) else {
                            continue;
                        };

                        if selection.might_contain_pos(Pos { x, y }, a1_context) {
                            // add the CellValue to cells if the code is not included in the rect
                            if !rect_contains_anchor_pos && let Some(cells) = cells {
                                cells.set(new_x, new_y, value.clone());
                            }

                            // add the display value to values if values is Some
                            if let Some(values) = values {
                                values.set(new_x, new_y, value.clone());
                            }
                        }
                    }
                }
            }
        }

        data_tables
    }

    /// Converts a format update to a SheetFormatUpdates
    pub fn to_sheet_format_updates(
        &self,
        sheet_pos: SheetPos,
        data_table_pos: Pos,
        format_update: FormatUpdate,
    ) -> Result<SheetFormatUpdates> {
        let data_table = self.data_table_result(&data_table_pos)?;

        Ok(SheetFormatUpdates::from_selection(
            &A1Selection::from_xy(
                sheet_pos.x - data_table_pos.x + 1,
                sheet_pos.y - data_table_pos.y + 1 - data_table.y_adjustment(true),
                sheet_pos.sheet_id,
            ),
            format_update,
        ))
    }

    /// Returns true if the data table should expand to the right.
    /// Will return false if the rectangle touches the table heading.
    pub fn should_expand_data_table(data_tables: &[Rect], rect: Rect) -> bool {
        let rect_moved_left = Rect::new(rect.min.x - 1, rect.min.y, rect.max.x - 1, rect.max.y);

        let data_table_immediate_left = data_tables
            .iter()
            .find(|rect| rect.intersects(rect_moved_left));

        let should_not_expand = data_table_immediate_left
            .map(|rect| rect_moved_left.min.y <= rect.min.y)
            .unwrap_or(false);

        !should_not_expand
    }

    /// Returns columns and rows to data tables when the cells to add are touching the data table
    #[allow(clippy::type_complexity)]
    pub fn expand_columns_and_rows(
        &self,
        data_tables: &[Rect],
        sheet_pos: SheetPos,
        value_is_empty: bool,
    ) -> (Option<(SheetPos, u32)>, Option<(SheetPos, u32)>) {
        let mut columns = None;
        let mut rows = None;

        if !value_is_empty {
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

            // there is a data table to the immediate left
            if let Some(data_table_left) = data_table_left {
                // don't expand if we're not at the end of the data table
                if data_table_left.max.x != pos_to_check.x {
                    return None;
                }

                if let Ok(data_table) = self.data_table_result(&data_table_left.min) {
                    // don't expand if the position is at the data table's name
                    if data_table.get_show_name() && data_table_left.min.y == pos.y {
                        return None;
                    }

                    let is_code = data_table.is_code();
                    let next_is_not_blank = || {
                        for y in 0..data_table_left.height() {
                            let pos = Pos::new(pos.x, data_table_left.min.y + y as i64);

                            if self.has_content_at_pos(pos) {
                                return false;
                            }
                        }

                        true
                    };

                    if !is_code && next_is_not_blank() {
                        let sheet_pos = (data_table_left.min, sheet_pos.sheet_id).into();
                        let mut column_index = data_table_left.width();

                        // the column index is the display index, not the actual index, we need to convert it to the actual index
                        if let Ok(data_table) = self.data_table_result(&data_table_left.min) {
                            column_index =
                                data_table.get_column_index_from_display_index(column_index, true);
                        }

                        return Some((sheet_pos, column_index));
                    }
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

                if let Ok(data_table) = self.data_table_result(&data_table_above.min) {
                    let is_code = data_table.is_code();
                    let next_is_not_blank = || {
                        for x in 0..data_table_above.width() {
                            let pos = Pos::new(data_table_above.min.x + x as i64, pos.y);
                            if self.has_content_at_pos(pos) {
                                return false;
                            }
                        }

                        true
                    };

                    if !is_code && next_is_not_blank() {
                        let sheet_pos = (data_table_above.min, sheet_pos.sheet_id).into();
                        let row_index = data_table_above.height();

                        return Some((sheet_pos, row_index));
                    }
                }
            }
        }

        None
    }

    /// Returns the code language at a pos
    pub fn code_language_at(&self, pos: Pos) -> Option<CodeCellLanguage> {
        // First check for CellValue::Code in columns
        if let Some(CellValue::Code(code_cell)) = self.cell_value_ref(pos) {
            return Some(code_cell.code_run.language.clone());
        }
        // Otherwise check data_tables
        self.data_table_at(&pos)
            .map(|data_table| data_table.get_language())
    }

    /// Returns true if the cell at pos is a formula cell
    pub fn is_formula_cell(&self, pos: Pos) -> bool {
        self.code_language_at(pos)
            .is_some_and(|lang| lang == CodeCellLanguage::Formula)
    }

    /// Returns true if the cell at pos is a source cell (code cell anchor or data table)
    pub fn is_source_cell(&self, pos: Pos) -> bool {
        // Check for CellValue::Code in columns
        if matches!(self.cell_value_ref(pos), Some(CellValue::Code(_))) {
            return true;
        }
        // Check for DataTable
        self.data_table_at(&pos).is_some()
    }

    /// Returns true if the cell at pos is a data table cell
    pub fn is_data_table_cell(&self, pos: Pos) -> bool {
        self.data_table_at(&pos)
            .is_some_and(|dt| matches!(dt.kind, DataTableKind::Import(_)))
    }

    /// You shouldn't be able to create a data table that includes a data table.
    /// Deny the action and give a popup explaining why it was blocked.
    /// Returns true if the data table is not within the rect
    pub fn enforce_no_data_table_within_rect(&self, rect: Rect) -> Result<bool> {
        let contains_data_table = self.contains_data_table_within_rect(rect, None);

        #[cfg(any(target_family = "wasm", test))]
        if contains_data_table {
            let message = "Tables cannot be created over tables, code, or formulas.";
            let severity = crate::grid::js_types::JsSnackbarSeverity::Error;
            crate::wasm_bindings::js::jsClientMessage(message.into(), severity.to_string());

            return Err(anyhow!(message));
        }

        Ok(!contains_data_table)
    }

    /// Sets or deletes a data table.
    ///
    /// Returns the old value if it was set.
    #[cfg(test)]
    pub fn set_data_table(&mut self, pos: Pos, data_table: Option<DataTable>) -> Option<DataTable> {
        if let Some(data_table) = data_table {
            self.data_table_insert_full(pos, data_table).2
        } else {
            self.data_table_shift_remove(pos)
                .map(|(_, data_table, _)| data_table)
        }
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
        grid::{CodeRun, DataTableKind, SheetId},
        test_create_code_table, test_create_data_table, test_create_html_chart,
        test_create_js_chart,
    };

    pub fn code_data_table(sheet: &mut Sheet, pos: Pos) -> (DataTable, Option<DataTable>) {
        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "=1".to_string(),
            formula_ast: None,
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
            Value::Single(CellValue::Number(2.into())),
            false,
            None,
            None,
            None,
        );

        let old = sheet.set_data_table(pos, Some(data_table.clone()));

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
        assert_eq!(sheet.data_table_at(&pos![A1]), Some(&data_table));
        assert_eq!(sheet.data_table_at(&pos![B2]), None);
    }

    #[test]
    fn test_get_data_table() {
        let (mut gc, sheet_id, data_table, _) = test_setup(pos![A1]);
        let sheet = gc.sheet_mut(sheet_id);

        assert_eq!(
            sheet.get_code_cell_value(pos![A1]),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(sheet.data_table_at(&pos![A1]), Some(&data_table));
        assert_eq!(sheet.data_table_at(&pos![B2]), None);
    }

    #[test]
    fn test_copy_data_table_to_clipboard() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        gc.sheet_mut(sheet_id)
            .modify_data_table_at(&pos, |dt| {
                dt.chart_pixel_output = Some((100.0, 100.0));
                Ok(())
            })
            .unwrap();

        let selection =
            A1Selection::from_ref_range_bounds(sheet_id, RefRangeBounds::new_relative_pos(pos));

        let js_clipboard = gc
            .sheet(sheet_id)
            .copy_to_clipboard(&selection, gc.a1_context(), ClipboardOperation::Copy, true)
            .into();

        gc.paste_from_clipboard(
            &A1Selection::from_xy(10, 10, sheet_id),
            js_clipboard,
            PasteSpecial::None,
            None,
            false,
        );

        println!(
            "data_table : {:?}",
            gc.sheet_mut(sheet_id)
                .data_table_at(&Pos::new(10, 10))
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
        let result = sheet.data_table_that_contains(pos![A1]);
        assert!(result.is_some());

        let (pos, dt) = result.unwrap();
        assert_eq!(pos, pos![A1]);
        assert_eq!(dt.name().to_owned(), "Table 1");

        // Test position outside the data table
        assert!(sheet.data_table_that_contains(pos![D4]).is_none());
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
    fn test_is_data_table_cell() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);
        test_create_code_table(&mut gc, sheet_id, pos![E5], 2, 2);
        test_create_js_chart(&mut gc, sheet_id, pos![G7], 2, 2);
        test_create_html_chart(&mut gc, sheet_id, pos![J9], 2, 2);

        let sheet = gc.sheet(sheet_id);
        assert!(!sheet.is_data_table_cell(pos![E5]));
        assert!(!sheet.is_data_table_cell(pos![G7]));
        assert!(!sheet.is_data_table_cell(pos![J9]));
        assert!(!sheet.is_data_table_cell(pos![B1]));
        assert!(!sheet.is_data_table_cell(pos![A2]));

        assert!(sheet.is_data_table_cell(pos![A1]));
    }
}
