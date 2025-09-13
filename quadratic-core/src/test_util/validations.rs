#[cfg(test)]
use uuid::Uuid;

#[cfg(test)]
use crate::{
    SheetPos,
    a1::A1Selection,
    controller::GridController,
    grid::SheetId,
    grid::sheet::validations::{
        rules::{ValidationRule, validation_logical::ValidationLogical},
        validation::{Validation, ValidationUpdate},
    },
};

/// Creates a checkbox validation for a given selection. show_checkbox = true
/// and ignore_blank = true. Returns a clone of the validation.
#[cfg(test)]
pub fn test_create_checkbox_with_id(gc: &mut GridController, selection: A1Selection) -> Validation {
    let validation = ValidationUpdate {
        id: Some(Uuid::new_v4()),
        selection,
        rule: ValidationRule::Logical(ValidationLogical {
            show_checkbox: true,
            ignore_blank: true,
        }),
        message: Default::default(),
        error: Default::default(),
    };
    gc.update_validation(validation.clone(), None);
    validation.into()
}

/// Creates a checkbox validation for a given selection. show_checkbox = true
/// and ignore_blank = true. Returns a clone of the validation.
#[cfg(test)]
pub fn test_create_checkbox(gc: &mut GridController, selection: A1Selection) -> Validation {
    let validation = ValidationUpdate {
        id: None,
        selection,
        rule: ValidationRule::Logical(ValidationLogical {
            show_checkbox: true,
            ignore_blank: true,
        }),
        message: Default::default(),
        error: Default::default(),
    };
    gc.update_validation(validation.clone(), None);
    validation.into()
}

#[track_caller]
#[cfg(test)]
/// Asserts that the given sheet position has the expected validation id.
pub fn assert_validation_id(
    gc: &GridController,
    sheet_pos: SheetPos,
    expected_validation: Option<Uuid>,
) {
    let sheet = gc.sheet(sheet_pos.sheet_id);
    let validation = sheet
        .validations
        .get_validation_from_pos(sheet_pos.into(), gc.a1_context());
    assert_eq!(
        expected_validation,
        validation.map(|v| v.id),
        "Validation at {sheet_pos} is {validation:?}, which is not the expected {expected_validation:?}"
    );
}

#[track_caller]
#[cfg(test)]
pub fn assert_validation_count(gc: &GridController, sheet_id: SheetId, expected_count: usize) {
    let sheet = gc.sheet(sheet_id);
    assert_eq!(
        expected_count,
        sheet.validations.validations.len(),
        "Expected {} validations, but got {}",
        expected_count,
        sheet.validations.validations.len(),
    );
}

#[track_caller]
#[cfg(test)]
pub fn assert_validation_warning(
    gc: &GridController,
    sheet_pos: SheetPos,
    expected_validation: Option<Validation>,
) {
    let expected_validation_id = expected_validation.map(|v| v.id);
    let sheet = gc.sheet(sheet_pos.sheet_id);
    let validation = sheet.validations.warnings.get(&sheet_pos.into());
    if let Some(validation_id) = validation {
        assert_eq!(
            expected_validation_id,
            Some(*validation_id),
            "Wrong validation warning, the validation_ids do not match",
        );
    } else if expected_validation_id.is_some() {
        panic!("Expected validation warning, but received none");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::*;

    #[test]
    fn test_test_create_checkbox() {
        let mut gc = test_create_gc();
        let sheet_id = gc.sheet_ids()[0];
        let selection = A1Selection::test_a1("A1");
        test_create_checkbox_with_id(&mut gc, selection.clone());

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(sheet.validations.validations[0].selection, selection);
        assert_eq!(
            sheet.validations.validations[0].rule,
            ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            })
        );
    }

    #[test]
    fn test_assert_validation_warning() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let sheet_pos = pos![sheet_id!A1];

        // Test case 1: No validation warning expected, none present
        assert_validation_warning(&gc, sheet_pos, None);

        // Test case 2: Create a validation and ensure it fails
        let validation = test_create_checkbox_with_id(&mut gc, A1Selection::test_a1("A1"));
        gc.set_cell_value(sheet_pos, "a".to_string(), None);
        assert_validation_warning(&gc, sheet_pos, Some(validation.clone()));

        // Test case 3: Wrong validation warning (should panic)
        let wrong_validation = test_create_checkbox_with_id(&mut gc, A1Selection::test_a1("A2"));
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            assert_validation_warning(&gc, sheet_pos, Some(wrong_validation));
        }));
        assert!(result.is_err());

        // Test case 4: Expected validation warning but none present (should panic)
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            assert_validation_warning(&gc, pos![sheet_id!b1], Some(validation));
        }));
        assert!(result.is_err());
    }

    #[test]
    fn test_assert_validation_count() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Test case 1: No validations initially
        assert_validation_count(&gc, sheet_id, 0);

        // Test case 2: Add one validation
        test_create_checkbox_with_id(&mut gc, A1Selection::test_a1("A1"));
        assert_validation_count(&gc, sheet_id, 1);

        // Test case 3: Add another validation
        test_create_checkbox_with_id(&mut gc, A1Selection::test_a1("A2"));
        assert_validation_count(&gc, sheet_id, 2);

        // Test case 4: Wrong count (should panic)
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            assert_validation_count(&gc, sheet_id, 3);
        }));
        assert!(result.is_err());
    }
}
