use crate::grid::sheet::validations::validation::{Validation, ValidationStyle};
use crate::grid::sheet::validations::validation_rules::validation_list::{
    ValidationList, ValidationListSource,
};
use crate::grid::sheet::validations::validation_rules::validation_logical::ValidationLogical;
use crate::grid::sheet::validations::validation_rules::ValidationRule;
use crate::grid::sheet::validations::Validations;
use crate::grid::{
    file::v1_6::schema::{self as current},
    file::v1_6::schema_validation as current_validations,
};
use crate::Pos;

use super::selection::{export_selection, import_selection};

pub fn import_validations(validations: &current_validations::Validations) -> Validations {
    Validations {
        validations: validations
            .validations
            .iter()
            .map(|validation| {
                Validation {
            id: validation.id.to_owned(),
            selection: import_selection(&validation.selection),
            rule: import_validation_rule(&validation.rule),
            message: crate::grid::sheet::validations::validation::ValidationMessage {
                show: validation.message.show,
                title: validation.message.title.to_owned(),
                message: validation.message.message.to_owned(),
            },
            error: crate::grid::sheet::validations::validation::ValidationError {
                show: validation.error.show,
                style: match validation.error.style {
                    current_validations::ValidationStyle::Warning => {
                        crate::grid::sheet::validations::validation::ValidationStyle::Warning
                    }
                    current_validations::ValidationStyle::Stop => {
                        crate::grid::sheet::validations::validation::ValidationStyle::Stop
                    }
                    current_validations::ValidationStyle::Information => {
                        crate::grid::sheet::validations::validation::ValidationStyle::Information
                    }
                },
                title: validation.error.title.to_owned(),
                message: validation.error.message.to_owned(),
            },
        }
            })
            .collect(),
        warnings: validations
            .warnings
            .iter()
            .map(|(pos, id)| (Pos { x: pos.x, y: pos.y }, *id))
            .collect(),
    }
}

pub fn import_validation_rule(rule: &current_validations::ValidationRule) -> ValidationRule {
    match rule {
        current_validations::ValidationRule::None => ValidationRule::None,
        current_validations::ValidationRule::List(list) => ValidationRule::List(ValidationList {
            source: match &list.source {
                current_validations::ValidationListSource::Selection(selection) => {
                    ValidationListSource::Selection(import_selection(selection))
                }
                current_validations::ValidationListSource::List(list) => {
                    ValidationListSource::List(list.iter().map(|s| s.to_owned()).collect())
                }
            },
            ignore_blank: list.ignore_blank,
            drop_down: list.drop_down,
        }),
        current_validations::ValidationRule::Logical(logical) => {
            ValidationRule::Logical(ValidationLogical {
                show_checkbox: logical.show_checkbox,
                ignore_blank: logical.ignore_blank,
            })
        }
    }
}

pub fn export_validation_rule(rule: &ValidationRule) -> current_validations::ValidationRule {
    match rule {
        ValidationRule::None => current_validations::ValidationRule::None,
        ValidationRule::List(list) => {
            current_validations::ValidationRule::List(current_validations::ValidationList {
                source: match &list.source {
                    ValidationListSource::Selection(selection) => {
                        current_validations::ValidationListSource::Selection(export_selection(
                            &selection,
                        ))
                    }
                    ValidationListSource::List(list) => {
                        current_validations::ValidationListSource::List(
                            list.iter().map(|s| s.to_owned()).collect(),
                        )
                    }
                },
                ignore_blank: list.ignore_blank,
                drop_down: list.drop_down,
            })
        }
        ValidationRule::Logical(logical) => {
            current_validations::ValidationRule::Logical(current_validations::ValidationLogical {
                show_checkbox: logical.show_checkbox,
                ignore_blank: logical.ignore_blank,
            })
        }
    }
}

pub fn export_validations(validations: &Validations) -> current_validations::Validations {
    current_validations::Validations {
        validations: validations
            .validations
            .iter()
            .map(|validation| current_validations::Validation {
                selection: export_selection(&validation.selection),
                id: validation.id.to_owned(),
                rule: export_validation_rule(&validation.rule),
                message: current_validations::ValidationMessage {
                    show: validation.message.show,
                    title: validation.message.title.to_owned(),
                    message: validation.message.message.to_owned(),
                },
                error: current_validations::ValidationError {
                    show: validation.error.show,
                    style: match validation.error.style {
                        ValidationStyle::Warning => current_validations::ValidationStyle::Warning,
                        ValidationStyle::Stop => current_validations::ValidationStyle::Stop,
                        ValidationStyle::Information => {
                            current_validations::ValidationStyle::Information
                        }
                    },
                    title: validation.error.title.to_owned(),
                    message: validation.error.message.to_owned(),
                },
            })
            .collect(),
        warnings: validations
            .warnings
            .iter()
            .map(|(pos, id)| (current::Pos { x: pos.x, y: pos.y }, *id))
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use uuid::Uuid;

    use crate::{grid::SheetId, selection::Selection, Rect};

    use super::*;

    #[test]
    fn import_export_validations() {
        let validation_id = Uuid::new_v4();
        let mut warnings = HashMap::new();
        warnings.insert(Pos { x: 1, y: 2 }, validation_id);

        let validations = Validations {
            validations: vec![Validation {
                id: validation_id,
                selection: Selection {
                    sheet_id: SheetId::test(),
                    x: 1,
                    y: 2,
                    rects: Some(vec![Rect::new(3, 4, 5, 6), Rect::new(7, 8, 9, 10)]),
                    rows: Some(vec![1, 2, 3]),
                    columns: Some(vec![4, 5, 6]),
                    all: true,
                },
                rule: ValidationRule::List(ValidationList {
                    source: ValidationListSource::Selection(Selection {
                        sheet_id: SheetId::test(),
                        x: 1,
                        y: 2,
                        rects: Some(vec![Rect::new(3, 4, 5, 6), Rect::new(7, 8, 9, 10)]),
                        rows: Some(vec![1, 2, 3]),
                        columns: Some(vec![4, 5, 6]),
                        all: true,
                    }),
                    ignore_blank: true,
                    drop_down: true,
                }),
                message: crate::grid::sheet::validations::validation::ValidationMessage {
                    show: true,
                    title: Some("title".to_owned()),
                    message: Some("message".to_owned()),
                },
                error: crate::grid::sheet::validations::validation::ValidationError {
                    show: true,
                    style: crate::grid::sheet::validations::validation::ValidationStyle::Warning,
                    title: Some("title".to_owned()),
                    message: Some("message".to_owned()),
                },
            }],
            warnings,
        };
        let imported = import_validations(&export_validations(&validations));
        assert_eq!(validations, imported);
    }
}
