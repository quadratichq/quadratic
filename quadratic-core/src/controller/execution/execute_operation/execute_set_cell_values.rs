use crate::{
    controller::{operations::operation::Operation, GridController},
    Array, CellValue,
};

impl GridController {
    pub(crate) fn execute_set_cell_values(&mut self, op: &Operation, is_user: bool, is_undo: bool) {
        match op {
            Operation::SetCellValues { sheet_rect, values } => {
                match self.grid.try_sheet_mut_from_id(sheet_rect.sheet_id) {
                    None => (), // sheet may have been deleted
                    Some(sheet) => {
                        // update individual cell values and collect old_values
                        let old_values = sheet_rect
                            .iter()
                            .zip(values.clone().into_cell_values_vec())
                            .map(|(sheet_pos, value)| {
                                let old_value = sheet.set_cell_value(sheet_pos.into(), value);

                                // add html to summary if old value was of that type
                                if old_value
                                    .as_ref()
                                    .is_some_and(|cell_value| cell_value.is_html())
                                {
                                    self.summary.html.insert(sheet_pos.sheet_id);
                                }
                                old_value
                            })
                            .map(|old_value| old_value.unwrap_or(CellValue::Blank))
                            .collect();

                        if is_user || is_undo {
                            self.forward_operations.push(op.clone());

                            // create reverse_operation
                            let old_values = Array::new_row_major(sheet_rect.size(), old_values)
                                .expect(
                                    "error constructing array of old values for SetCells operation",
                                );
                            self.reverse_operations.push(Operation::SetCellValues {
                                sheet_rect: sheet_rect.clone(),
                                values: old_values,
                            });

                            if is_user {
                                // remove any code_cells that are now covered by the new values
                                let mut code_cell_removed = false;
                                sheet.code_cells.retain(|(pos, code_cell)| {
                                    if sheet_rect.contains(pos.to_sheet_pos(sheet.id)) {
                                        self.reverse_operations.push(Operation::SetCodeCell {
                                            sheet_pos: pos.to_sheet_pos(sheet.id),
                                            code_cell_value: Some(code_cell.clone()),
                                        });
                                        code_cell_removed = true;
                                        false
                                    } else {
                                        true
                                    }
                                });

                                self.add_compute_operations(&sheet_rect, None);

                                // if a code_cell was removed, then we need to check all spills.
                                // Otherwise we only need to check spills for the sheet_rect.
                                if code_cell_removed {
                                    self.check_all_spills(sheet_rect.sheet_id, 0);
                                } else {
                                    self.check_spills(&sheet_rect);
                                }
                            }
                        }

                        // prepare summary
                        self.sheets_with_dirty_bounds.insert(sheet_rect.sheet_id);
                        self.summary.generate_thumbnail = self.summary.generate_thumbnail
                            || self.thumbnail_dirty_sheet_rect(&sheet_rect);
                        self.add_cell_sheets_modified_rect(&sheet_rect);
                    }
                }
            }
            _ => unreachable!("Expected Operation::SetCellValues in execute_set_cell_values"),
        }
    }
}

#[cfg(test)]
mod tests {
    use bigdecimal::BigDecimal;

    use crate::{controller::GridController, grid::SheetId, CellValue, Pos, SheetPos};

    #[test]
    fn test_set_cell_value() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "0".to_string(),
            None,
        );

        let sheet = gc.grid.try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(0)))
        );

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "1".to_string(),
            None,
        );

        let sheet = gc.grid.try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(1)))
        );
    }

    #[test]
    fn test_set_cell_values_no_sheet() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let summary = gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "test".to_string(),
            None,
        );
        let sheet = gc.grid.try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Text("test".to_string()))
        );
        assert_eq!(summary.cell_sheets_modified.len(), 1);

        let no_sheet_id = SheetId::new();
        let summary = gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id: no_sheet_id,
            },
            "test 2".to_string(),
            None,
        );
        assert_eq!(summary.cell_sheets_modified.len(), 0);
    }
}
