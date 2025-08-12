use crate::{
    CellValue, Pos, Rect,
    a1::A1Context,
    cell_values::CellValues,
    controller::active_transactions::pending_transaction::PendingTransaction,
    grid::js_types::{
        JsCellValueCode, JsCellValueDescription, JsCellValueKind, JsValidationWarning,
    },
};

use super::Sheet;

impl Sheet {
    /// Returns true if there is a value within a rect
    pub fn contains_value_within_rect(&self, rect: Rect, skip: Option<&Pos>) -> bool {
        if let Some(skip) = skip {
            let skip_rect = Rect::single_pos(*skip);
            self.columns
                .get_nondefault_rects_in_rect(rect)
                .filter(|(rect, _)| rect != &skip_rect)
                .count()
                > 0
        } else {
            self.columns.get_nondefault_rects_in_rect(rect).count() > 0
        }
    }

    /// Replace cell_values with CellValues.
    ///
    /// Returns the old CellValues.
    pub fn merge_cell_values(
        &mut self,
        transaction: &mut PendingTransaction,
        pos: Pos,
        cell_values: &CellValues,
        a1_context: &A1Context,
    ) -> CellValues {
        let mut old = CellValues::new(cell_values.w, cell_values.h);

        for x in 0..cell_values.w {
            let grid_x = pos.x + x as i64;

            for y in 0..cell_values.h {
                let grid_y = pos.y + y as i64;

                let grid_pos = (grid_x, grid_y).into();

                // set value in columns
                match (self.columns.get_value(&grid_pos), cell_values.get(x, y)) {
                    // old is blank and new is blank
                    (None | Some(CellValue::Blank), None | Some(CellValue::Blank)) => (),
                    // old is/isn't black and new isn't blank
                    (_, Some(value)) => {
                        let old_value = self.columns.set_value(&grid_pos, value.to_owned());
                        old.set(x, y, old_value.unwrap_or(CellValue::Blank));
                    }
                    _ => (),
                };

                // check for validation warnings
                let sheet_pos = grid_pos.to_sheet_pos(self.id);
                if let Some(validation) = self.validations.validate(self, grid_pos, a1_context) {
                    transaction.validation_warning_added(
                        self.id,
                        JsValidationWarning {
                            pos: grid_pos,
                            validation: Some(validation.id),
                            style: Some(validation.error.style.clone()),
                        },
                    );
                    self.validations.set_warning(sheet_pos, Some(validation.id));
                } else if self.validations.has_warning(grid_pos) {
                    transaction.validation_warning_deleted(self.id, grid_pos);
                    self.validations.set_warning(sheet_pos, None);
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
            CellValue::Image(_) => Some("Javascript chart code cell anchor".into()),
            CellValue::Html(_) => Some("Python chart code cell anchor".into()),
            _ => Some(value.to_display()),
        }
    }

    /// Returns the rendered value of the cells in a given rect.
    pub fn cells_as_string(&self, rect: Rect, total_range: Rect) -> JsCellValueDescription {
        let mut values = Vec::new();
        for y in rect.min.y..=rect.max.y {
            let mut row = Vec::new();
            for x in rect.min.x..=rect.max.x {
                let value = if let Some(value) = self.rendered_value(Pos { x, y }) {
                    value
                } else {
                    "".to_string()
                };
                let kind = if let Some(value) = self.display_value(Pos { x, y }) {
                    value.into()
                } else {
                    JsCellValueKind::Blank
                };
                let language =
                    if let Some(CellValue::Code(code)) = self.cell_value_ref(Pos { x, y }) {
                        Some(code.language.clone())
                    } else {
                        None
                    };
                row.push(JsCellValueCode {
                    value,
                    kind,
                    language,
                });
            }
            values.push(row);
        }
        JsCellValueDescription {
            total_range: total_range.a1_string(),
            range: rect.a1_string(),
            values,
        }
    }

    /// Returns the rendered formats of the cells in a given rect.
    ///
    /// todo: it would be better if this returned ranges (but this is difficult
    /// b/c of tables vs. non-table formatting)
    pub fn cell_formats_as_string(&self, rect: Rect) -> Vec<String> {
        let mut formats = Vec::new();
        for x in rect.min.x..=rect.max.x {
            for y in rect.min.y..=rect.max.y {
                let pos = Pos { x, y };
                if let Some(format) = self.cell_text_format_as_string(pos) {
                    formats.push(format!("{pos} is {format:?}; "));
                }
            }
        }
        formats
    }
}

#[cfg(test)]
mod test {

    use crate::{
        CellValue,
        a1::A1Selection,
        controller::{
            active_transactions::transaction_name::TransactionName,
            operations::operation::Operation,
        },
        first_sheet_id,
        grid::{
            NumericFormat,
            js_types::JsHashValidationWarnings,
            sheet::validations::{rules::ValidationRule, validation::Validation},
        },
        number::decimal_from_str,
        test_util::*,
        wasm_bindings::js::expect_js_call,
    };

    use super::*;
    use uuid::Uuid;

    #[test]
    fn merge_cell_values() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: -1, y: -2 }, "old-a");
        sheet.set_cell_value(Pos { x: -1, y: -1 }, "old-b");
        sheet.set_cell_value(Pos { x: 0, y: -2 }, "old-c");
        sheet.set_cell_value(Pos { x: 0, y: -1 }, "old-d");
        let cell_values = CellValues::from(vec![vec!["a", "b"], vec!["c", "d"]]);

        let mut transaction = PendingTransaction::default();
        let a1_context = sheet.expensive_make_a1_context();
        let old = sheet.merge_cell_values(
            &mut transaction,
            Pos { x: -1, y: -2 },
            &cell_values,
            &a1_context,
        );
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
        sheet.set_cell_value(pos, CellValue::Number(decimal_from_str("123.456").unwrap()));

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
    fn merge_cell_values_validations() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let sheet = gc.sheet_mut(sheet_id);
        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1:C1", sheet_id),
            rule: ValidationRule::Logical(Default::default()),
            message: Default::default(),
            error: Default::default(),
        };
        sheet.validations.set(validation.clone());

        let cell_values = CellValues::from(vec![vec![
            CellValue::Logical(false),
            CellValue::Text("b".into()),
            CellValue::Logical(true),
        ]]);
        let op = vec![Operation::SetCellValues {
            sheet_pos: pos![sheet_id!A1],
            values: cell_values,
        }];
        gc.start_user_ai_transaction(op, None, TransactionName::SetCells, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Logical(false))
        );
        assert_eq!(
            sheet.cell_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Logical(true))
        );

        assert_eq!(sheet.validations.warnings.len(), 1);
        let warnings = vec![JsHashValidationWarnings {
            sheet_id,
            hash: None,
            warnings: vec![JsValidationWarning {
                pos: (2, 1).into(),
                validation: Some(validation.id),
                style: Some(validation.error.style.clone()),
            }],
        }];
        expect_js_call(
            "jsValidationWarnings",
            format!("{:?}", serde_json::to_vec(&warnings).unwrap()),
            true,
        );
    }
}
