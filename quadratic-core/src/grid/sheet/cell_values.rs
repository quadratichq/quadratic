use indexmap::IndexMap;

use crate::{
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    CellValue, Pos,
};

use super::Sheet;

impl Sheet {
    /// Replace cell_values with CellValues.
    ///
    /// Returns the old CellValues.
    pub fn merge_cell_values(
        &mut self,
        transaction: &mut PendingTransaction,
        pos: Pos,
        cell_values: &CellValues,
        send: bool,
    ) -> CellValues {
        let mut old = CellValues::new(cell_values.w, cell_values.h);

        // add the values and return the old values
        for x in 0..cell_values.w {
            let grid_x = pos.x + x as i64;
            let col = self.get_or_create_column(grid_x);
            for y in 0..cell_values.h {
                let grid_y = pos.y + y as i64;

                let old_value = if let Some(value) = cell_values.get_except_blank(x, y) {
                    col.values.insert(grid_y, value.clone())
                } else {
                    col.values.remove(&grid_y)
                };
                if let Some(old_value) = old_value {
                    old.set(x, y, old_value);
                }
            }
        }

        // check the validations for the new cells; note: IndexMap is necessary
        // so the tests pass (ie, the order of the cells is deterministic)
        let mut validation_warnings = IndexMap::new();
        for x in 0..cell_values.w {
            let grid_x = pos.x + x as i64;
            for y in 0..cell_values.h {
                let grid_y = pos.y + y as i64;
                let pos = Pos {
                    x: grid_x,
                    y: grid_y,
                };
                let sheet_pos = pos.to_sheet_pos(self.id);
                if let Some(validation) = self.validations.validate(self, pos) {
                    validation_warnings.insert(pos, validation.id);
                    transaction
                        .forward_operations
                        .push(Operation::SetValidationWarning {
                            sheet_pos,
                            validation_id: Some(validation.id),
                        });
                } else if self.validations.has_warning(pos) {
                    transaction
                        .forward_operations
                        .push(Operation::SetValidationWarning {
                            sheet_pos: pos.to_sheet_pos(self.id),
                            validation_id: None,
                        });
                    let old = self.validations.set_warning(sheet_pos, None);
                    transaction.reverse_operations.insert(0, old);
                }
            }
        }

        if !validation_warnings.is_empty() {
            // apply the validation warnings to the sheet
            validation_warnings.iter().for_each(|(pos, validation_id)| {
                let sheet_pos = pos.to_sheet_pos(self.id);
                let old = self
                    .validations
                    .set_warning(sheet_pos, Some(*validation_id));
                transaction
                    .forward_operations
                    .push(Operation::SetValidationWarning {
                        sheet_pos: pos.to_sheet_pos(self.id),
                        validation_id: Some(*validation_id),
                    });
                transaction.reverse_operations.insert(0, old);
            });

            // send the warnings if necessary
            if send {
                let validations = validation_warnings
                    .iter()
                    .map(|(pos, validation_id)| (pos.x, pos.y, *validation_id, false))
                    .collect::<Vec<_>>();
                if let Ok(validations) = serde_json::to_string(&validations) {
                    crate::wasm_bindings::js::jsValidationWarning(self.id.to_string(), validations);
                }
            }
        }
        old
    }

    /// Returns the rendered value of the cell at the given position. This is
    /// different from calling CellValue.to_display() since it properly formats
    /// numbers. (We no longer format numbers in Rust because the client needs to
    /// be able to change the precision of the number when rendering.)
    pub fn rendered_value(&self, pos: Pos) -> Option<String> {
        let value = self.display_value(pos)?;
        match value {
            CellValue::Number(_) => {
                let numeric_format = self.formats.numeric_format.get(pos);
                let numeric_decimals = self.formats.numeric_decimals.get(pos);
                let numeric_commas = self.formats.numeric_commas.get(pos);
                Some(value.to_number_display(numeric_format, numeric_decimals, numeric_commas))
            }
            _ => Some(value.to_display()),
        }
    }
}

#[cfg(test)]
mod test {
    use std::str::FromStr;

    use crate::{
        grid::{
            sheet::validations::{validation::Validation, validation_rules::ValidationRule},
            NumericFormat,
        },
        wasm_bindings::js::expect_js_call,
        A1Selection, CellValue,
    };

    use super::*;
    use bigdecimal::BigDecimal;
    use serial_test::{parallel, serial};
    use uuid::Uuid;

    #[test]
    #[parallel]
    fn merge_cell_values() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: -1, y: -2 }, "old-a");
        sheet.set_cell_value(Pos { x: -1, y: -1 }, "old-b");
        sheet.set_cell_value(Pos { x: 0, y: -2 }, "old-c");
        sheet.set_cell_value(Pos { x: 0, y: -1 }, "old-d");
        let cell_values = CellValues::from(vec![vec!["a", "b"], vec!["c", "d"]]);

        let mut transaction = PendingTransaction::default();
        let old =
            sheet.merge_cell_values(&mut transaction, Pos { x: -1, y: -2 }, &cell_values, false);
        assert_eq!(old.w, 2);
        assert_eq!(old.h, 2);

        assert_eq!(
            sheet.cell_value(Pos { x: -1, y: -2 }),
            Some(CellValue::from("a"))
        );
        assert_eq!(
            sheet.cell_value(Pos { x: -1, y: -1 }),
            Some(CellValue::from("b"))
        );
        assert_eq!(
            sheet.cell_value(Pos { x: 0, y: -2 }),
            Some(CellValue::from("c"))
        );
        assert_eq!(
            sheet.cell_value(Pos { x: 0, y: -1 }),
            Some(CellValue::from("d"))
        );

        assert_eq!(
            old,
            CellValues::from(vec![vec!["old-a", "old-b"], vec!["old-c", "old-d"]])
        );
    }

    #[test]
    fn test_rendered_value() {
        let mut sheet = Sheet::test();
        let pos = Pos { x: 1, y: 1 };
        sheet.set_cell_value(
            pos,
            CellValue::Number(BigDecimal::from_str("123.456").unwrap()),
        );

        sheet.formats.numeric_format.set(
            pos,
            Some(NumericFormat {
                kind: crate::grid::NumericFormatKind::Currency,
                symbol: Some("$".to_string()),
            }),
        );

        // no format for to_display
        assert_eq!(
            sheet.display_value(pos).unwrap().to_display(),
            "123.456".to_string()
        );

        // format for to_rendered
        assert_eq!(sheet.rendered_value(pos).unwrap(), "$123.46".to_string());
    }

    #[test]
    #[serial]
    fn merge_cell_values_validations() {
        let mut sheet = Sheet::test();

        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1:C1", &sheet.id),
            rule: ValidationRule::Logical(Default::default()),
            message: Default::default(),
            error: Default::default(),
        };
        sheet.validations.set(validation.clone());

        let cell_values = CellValues::from(vec![vec![
            CellValue::Text("a".into()),
            CellValue::Text("b".into()),
            CellValue::Logical(true),
        ]]);
        let mut transaction = PendingTransaction::default();
        sheet.merge_cell_values(&mut transaction, Pos { x: 1, y: 1 }, &cell_values, true);

        assert_eq!(
            sheet.cell_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Logical(true))
        );

        assert_eq!(sheet.validations.warnings.len(), 2);
        let warnings = vec![(1, 1, validation.id, false), (2, 1, validation.id, false)];
        expect_js_call(
            "jsValidationWarning",
            format!("{},{}", sheet.id, serde_json::to_string(&warnings).unwrap()),
            true,
        );
    }
}
