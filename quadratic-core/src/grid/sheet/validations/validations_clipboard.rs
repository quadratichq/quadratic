use crate::{
    controller::operations::clipboard::{ClipboardOrigin, ClipboardValidations},
    selection::Selection,
};

use super::Validations;

impl Validations {
    /// Copies validations to the clipboard for the Selection and translates them to the clipboard origin.
    pub fn to_clipboard(
        &self,
        selection: &Selection,
        clipboard_origin: &ClipboardOrigin,
    ) -> Option<ClipboardValidations> {
        let validations = self
            .validations
            .iter()
            .filter_map(|validation| {
                if let Some(intersection) = selection.intersection(&validation.selection) {
                    let mut v = validation.clone();
                    v.selection = intersection;
                    v.selection
                        .translate_in_place(-clipboard_origin.x, -clipboard_origin.y);
                    Some(v)
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();

        if validations.is_empty() {
            None
        } else {
            Some(ClipboardValidations { validations })
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;
    use uuid::Uuid;

    use crate::{
        grid::{
            sheet::validations::{validation::Validation, validation_rules::ValidationRule},
            SheetId,
        },
        Rect,
    };

    use super::*;

    #[test]
    #[parallel]
    fn to_clipboard() {
        let sheet_id = SheetId::test();
        let mut validations = Validations::default();

        let validation_outside_selection = Validation {
            id: Uuid::new_v4(),
            selection: Selection::rect(Rect::new(4, 4, 5, 5), sheet_id),
            rule: ValidationRule::Logical(Default::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_outside_selection);

        let validation_to_copy = Validation {
            id: Uuid::new_v4(),
            selection: Selection::rect(Rect::new(1, 1, 3, 3), sheet_id),
            rule: ValidationRule::Logical(Default::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_to_copy.clone());

        let selection = Selection::rect(Rect::new(1, 1, 2, 2), sheet_id);
        let clipboard_origin = ClipboardOrigin {
            x: 0,
            y: 0,
            ..Default::default()
        };
        let clipboard_validations = validations
            .to_clipboard(&selection, &clipboard_origin)
            .unwrap();
        assert_eq!(clipboard_validations.validations.len(), 1);
        assert_eq!(
            clipboard_validations.validations[0].selection,
            selection.translate(0, 0)
        );
    }
}
