use std::collections::HashMap;

use crate::{
    Pos, Rect,
    grid::{
        Sheet,
        js_types::{JsHashValidationWarnings, JsValidationWarning},
    },
};

impl Sheet {
    /// Sends all validations for this sheet to the client.
    pub fn send_all_validations(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        match serde_json::to_vec(&self.validations.validations) {
            Ok(all_validations) => {
                crate::wasm_bindings::js::jsSheetValidations(self.id.to_string(), all_validations);
            }
            Err(e) => {
                dbgjs!(format!("Failed to serialize validations: {}", e));
            }
        }
    }

    /// Sends all validation warnings for this sheet to the client.
    pub fn send_all_validation_warnings(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        };

        let Some(rect) = self.bounds(true).into() else {
            return;
        };

        let warnings = self.get_validation_warnings_in_rect(rect, true);
        self.send_validation_warnings(warnings);
    }

    /// Sends validation warnings as a response from the request from the
    /// client. Note, the client always requests hash-sized rects.
    pub fn send_validation_warnings_rect(&self, rect: Rect, rect_is_hash_rect: bool) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        let warnings = self.get_validation_warnings_in_rect(rect, rect_is_hash_rect);
        self.send_validation_warnings(warnings);
    }

    /// Sends validation warnings to the client.
    pub fn send_validation_warnings(&self, warnings: Vec<JsHashValidationWarnings>) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        if !warnings.is_empty()
            && let Ok(warnings) = serde_json::to_vec(&warnings) {
                crate::wasm_bindings::js::jsValidationWarnings(warnings);
            }
    }

    /// Sends validation warnings for a hashed region to the client.
    pub fn get_validation_warnings_in_rect(
        &self,
        rect: Rect,
        rect_is_hash_rect: bool,
    ) -> Vec<JsHashValidationWarnings> {
        let mut hashes_warnings = HashMap::<Pos, Vec<JsValidationWarning>>::new();

        for (&pos, validation_id) in self.validations.warnings.iter() {
            if rect.contains(pos)
                && let Some(validation) = self.validations.validation(*validation_id) {
                    let hash = pos.quadrant().into();
                    hashes_warnings
                        .entry(hash)
                        .or_default()
                        .push(JsValidationWarning {
                            pos,
                            validation: Some(*validation_id),
                            style: Some(validation.error.style.clone()),
                        });
                }
        }

        hashes_warnings
            .into_iter()
            .map(|(hash, warnings)| JsHashValidationWarnings {
                sheet_id: self.id,
                hash: if rect_is_hash_rect { Some(hash) } else { None },
                warnings,
            })
            .collect::<Vec<_>>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use uuid::Uuid;

    use crate::{
        Rect,
        a1::A1Selection,
        controller::GridController,
        grid::{
            js_types::JsValidationWarning,
            sheet::validations::{
                rules::{ValidationRule, validation_logical::ValidationLogical},
                validation::{Validation, ValidationStyle},
            },
        },
        wasm_bindings::js::expect_js_call,
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
        let a1_context = sheet.expensive_make_a1_context();
        let render = sheet.get_render_cells(Rect::single_pos((1, 1).into()), &a1_context);
        assert_eq!(render.len(), 1);
    }

    #[test]
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
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{:?}",
                sheet.id,
                serde_json::to_vec(&sheet.validations.validations).unwrap()
            ),
            true,
        );
    }

    #[test]
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
            .insert((1, 1).into(), validation_id);
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);
        sheet.send_all_validation_warnings();
        let warnings = vec![JsHashValidationWarnings {
            sheet_id: sheet.id,
            hash: Some((0, 0).into()),
            warnings: vec![JsValidationWarning {
                pos: (1, 1).into(),
                validation: Some(validation_id),
                style: Some(ValidationStyle::Stop),
            }],
        }];
        expect_js_call(
            "jsValidationWarnings",
            format!("{:?}", serde_json::to_vec(&warnings).unwrap()),
            true,
        );
    }
}
