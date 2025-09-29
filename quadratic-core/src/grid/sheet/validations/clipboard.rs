use crate::{
    a1::{A1Context, A1Selection},
    controller::operations::clipboard::{ClipboardOrigin, ClipboardValidations},
};

use super::Validations;

impl Validations {
    /// Copies validations to the clipboard for the Selection and translates them to the clipboard origin.
    pub(crate) fn to_clipboard(
        &self,
        selection: &A1Selection,
        clipboard_origin: &ClipboardOrigin,
        a1_context: &A1Context,
    ) -> Option<ClipboardValidations> {
        let mut validations = vec![];
        for validation in self.validations.iter() {
            if let Some(intersection) = selection.intersection(&validation.selection, a1_context) {
                let mut v = validation.clone();
                v.selection = intersection
                    .saturating_translate(1 + -clipboard_origin.x, 1 + -clipboard_origin.y)?;
                validations.push(v);
            }
        }
        if validations.is_empty() {
            None
        } else {
            Some(ClipboardValidations { validations })
        }
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use crate::{
        SheetRect,
        a1::{A1Context, A1Selection},
        controller::operations::clipboard::ClipboardOrigin,
        grid::{
            SheetId,
            sheet::validations::{Validations, rules::ValidationRule, validation::Validation},
        },
    };

    #[test]
    fn test_to_clipboard() {
        let sheet_id = SheetId::TEST;
        let mut validations = Validations::default();

        let validation_outside_selection = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::from_rect(SheetRect::new(4, 4, 5, 5, sheet_id)),
            rule: ValidationRule::Logical(Default::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_outside_selection);

        let validation_to_copy = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::from_rect(SheetRect::new(2, 2, 4, 4, sheet_id)),
            rule: ValidationRule::Logical(Default::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_to_copy.clone());

        let selection = A1Selection::from_rect(SheetRect::new(2, 2, 3, 3, sheet_id));
        let clipboard_origin = ClipboardOrigin {
            x: 2,
            y: 2,
            ..ClipboardOrigin::default(sheet_id)
        };
        let clipboard_validations = validations
            .to_clipboard(&selection, &clipboard_origin, &A1Context::default())
            .unwrap();
        assert_eq!(clipboard_validations.validations.len(), 1);
        assert_eq!(
            clipboard_validations.validations[0].selection,
            selection.saturating_translate(-1, -1).unwrap(),
        );
    }
}
