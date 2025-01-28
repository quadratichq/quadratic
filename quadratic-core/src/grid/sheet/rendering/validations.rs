use crate::{
    grid::{js_types::JsValidationWarning, Sheet},
    renderer_constants::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH},
    Rect,
};

impl Sheet {
    /// Sends all validations for this sheet to the client.
    pub fn send_all_validations(&self) {
        if let Ok(validations) = self.validations.to_string() {
            crate::wasm_bindings::js::jsSheetValidations(self.id.to_string(), validations);
        }
    }

    /// Sends validation warnings to the client.
    pub fn send_validation_warnings(&self, warnings: Vec<JsValidationWarning>) {
        if warnings.is_empty() {
            return;
        }

        if let Ok(warnings) = serde_json::to_string(&warnings) {
            crate::wasm_bindings::js::jsValidationWarning(self.id.to_string(), warnings);
        }
    }

    /// Sends all validation warnings for this sheet to the client.
    pub fn send_all_validation_warnings(&self) {
        let warnings = self
            .validations
            .warnings
            .iter()
            .map(|(pos, validation_id)| JsValidationWarning {
                x: pos.x,
                y: pos.y,
                validation: Some(*validation_id),
                style: self
                    .validations
                    .validation(*validation_id)
                    .map(|v| v.error.style.clone()),
            })
            .collect::<Vec<_>>();

        self.send_validation_warnings(warnings);
    }

    /// Sends validation warnings for a hashed region to the client.
    pub fn send_validation_warnings_from_hash(&self, hash_x: i64, hash_y: i64, rect: Rect) {
        let warnings = self
            .validations
            .warnings
            .iter()
            .filter_map(|(pos, validation_id)| {
                if rect.contains(*pos) {
                    let validation = self.validations.validation(*validation_id)?;
                    Some(JsValidationWarning {
                        x: pos.x,
                        y: pos.y,
                        validation: Some(*validation_id),
                        style: Some(validation.error.style.clone()),
                    })
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();

        if let Ok(warnings) = serde_json::to_string(&warnings) {
            crate::wasm_bindings::js::jsRenderValidationWarnings(
                self.id.to_string(),
                hash_x,
                hash_y,
                warnings,
            );
        }
    }

    /// Sends validation warnings as a response from the request from the
    /// client. Note, the client always requests hash-sized rects.
    pub fn send_validation_warnings_rect(&self, rect: Rect) {
        let hash_x = rect.min.x / CELL_SHEET_WIDTH as i64;
        let hash_y = rect.min.y / CELL_SHEET_HEIGHT as i64;
        self.send_validation_warnings_from_hash(hash_x, hash_y, rect);
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    use serial_test::serial;
    use uuid::Uuid;

    use crate::{
        a1::A1Selection,
        controller::GridController,
        grid::{
            js_types::JsValidationWarning,
            sheet::validations::{
                validation::{Validation, ValidationStyle},
                validation_rules::{validation_logical::ValidationLogical, ValidationRule},
            },
        },
        wasm_bindings::js::expect_js_call,
        Rect,
    };

    #[test]
    fn validation_list() {
        let mut sheet = Sheet::test();
        sheet.validations.set(Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:B2"),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        });
        let render = sheet.get_render_cells(Rect::single_pos((1, 1).into()));
        assert_eq!(render.len(), 1);
    }

    #[test]
    #[serial]
    fn send_all_validations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.validations.set(Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:B2"),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        });
        sheet.send_all_validations();
        let validations = serde_json::to_string(&sheet.validations.validations).unwrap();
        expect_js_call(
            "jsSheetValidations",
            format!("{},{}", sheet.id, validations),
            true,
        );
    }

    #[test]
    #[serial]
    fn send_all_validation_warnings() {
        let mut sheet = Sheet::test();
        let validation_id = Uuid::new_v4();
        sheet.validations.set(Validation {
            id: validation_id,
            selection: A1Selection::test_a1("A1:B2"),
            rule: ValidationRule::Logical(ValidationLogical {
                ignore_blank: false,
                ..Default::default()
            }),
            message: Default::default(),
            error: Default::default(),
        });
        sheet
            .validations
            .warnings
            .insert((0, 0).into(), validation_id);
        sheet.send_all_validation_warnings();
        let warnings = serde_json::to_string(&vec![JsValidationWarning {
            x: 0,
            y: 0,
            validation: Some(validation_id),
            style: Some(ValidationStyle::Stop),
        }])
        .unwrap();
        expect_js_call(
            "jsValidationWarning",
            format!("{},{}", sheet.id, warnings),
            true,
        );
    }
}
