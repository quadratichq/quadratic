use super::current;

use crate::grid::sheet::validations::validation::{Validation, ValidationStyle};
use crate::grid::sheet::validations::validation_rules::validation_date_time::{
    DateTimeRange, ValidationDateTime,
};
use crate::grid::sheet::validations::validation_rules::validation_list::{
    ValidationList, ValidationListSource,
};
use crate::grid::sheet::validations::validation_rules::validation_logical::ValidationLogical;
use crate::grid::sheet::validations::validation_rules::validation_number::{
    NumberRange, ValidationNumber,
};
use crate::grid::sheet::validations::validation_rules::validation_text::{
    TextCase, TextMatch, ValidationText,
};
use crate::grid::sheet::validations::validation_rules::ValidationRule;
use crate::grid::sheet::validations::Validations;
use crate::Pos;

use super::selection::{export_selection, import_selection};

pub fn import_validations(validations: &current::ValidationsSchema) -> Validations {
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
                    current::ValidationStyleSchema::Warning => {
                        crate::grid::sheet::validations::validation::ValidationStyle::Warning
                    }
                    current::ValidationStyleSchema::Stop => {
                        crate::grid::sheet::validations::validation::ValidationStyle::Stop
                    }
                    current::ValidationStyleSchema::Information => {
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

fn import_validation_rule(rule: &current::ValidationRuleSchema) -> ValidationRule {
    match rule {
        current::ValidationRuleSchema::None => ValidationRule::None,
        current::ValidationRuleSchema::List(list) => ValidationRule::List(ValidationList {
            source: match &list.source {
                current::ValidationListSourceSchema::Selection(selection) => {
                    ValidationListSource::Selection(import_selection(selection))
                }
                current::ValidationListSourceSchema::List(list) => {
                    ValidationListSource::List(list.iter().map(|s| s.to_owned()).collect())
                }
            },
            ignore_blank: list.ignore_blank,
            drop_down: list.drop_down,
        }),
        current::ValidationRuleSchema::Logical(logical) => {
            ValidationRule::Logical(ValidationLogical {
                show_checkbox: logical.show_checkbox,
                ignore_blank: logical.ignore_blank,
            })
        }
        current::ValidationRuleSchema::Text(text) => ValidationRule::Text(ValidationText {
            ignore_blank: text.ignore_blank,
            text_match: text
                .text_match
                .iter()
                .map(|m| match m {
                    current::TextMatchSchema::Exactly(
                        current::TextCaseSchema::CaseInsensitive(cases),
                    ) => TextMatch::Exactly(TextCase::CaseInsensitive(
                        cases.iter().map(|case| case.to_owned()).collect(),
                    )),
                    current::TextMatchSchema::Exactly(current::TextCaseSchema::CaseSensitive(
                        cases,
                    )) => TextMatch::Exactly(TextCase::CaseSensitive(
                        cases.iter().map(|case| case.to_owned()).collect(),
                    )),
                    current::TextMatchSchema::Contains(
                        current::TextCaseSchema::CaseInsensitive(cases),
                    ) => TextMatch::Contains(TextCase::CaseInsensitive(
                        cases.iter().map(|case| case.to_owned()).collect(),
                    )),
                    current::TextMatchSchema::Contains(current::TextCaseSchema::CaseSensitive(
                        cases,
                    )) => TextMatch::Contains(TextCase::CaseSensitive(
                        cases.iter().map(|case| case.to_owned()).collect(),
                    )),
                    current::TextMatchSchema::NotContains(
                        current::TextCaseSchema::CaseInsensitive(cases),
                    ) => TextMatch::NotContains(TextCase::CaseInsensitive(
                        cases.iter().map(|case| case.to_owned()).collect(),
                    )),
                    current::TextMatchSchema::NotContains(
                        current::TextCaseSchema::CaseSensitive(cases),
                    ) => TextMatch::NotContains(TextCase::CaseSensitive(
                        cases.iter().map(|case| case.to_owned()).collect(),
                    )),
                    current::TextMatchSchema::TextLength { min, max } => TextMatch::TextLength {
                        min: min.to_owned(),
                        max: max.to_owned(),
                    },
                })
                .collect(),
        }),
        current::ValidationRuleSchema::Number(number) => ValidationRule::Number(ValidationNumber {
            ignore_blank: number.ignore_blank,
            ranges: number
                .ranges
                .iter()
                .map(|range| match range {
                    current::NumberRangeSchema::Range(min, max) => {
                        NumberRange::Range(min.to_owned(), max.to_owned())
                    }
                    current::NumberRangeSchema::Equal(entry) => {
                        NumberRange::Equal(entry.to_owned())
                    }
                    current::NumberRangeSchema::NotEqual(entry) => {
                        NumberRange::NotEqual(entry.to_owned())
                    }
                })
                .collect(),
        }),
        current::ValidationRuleSchema::DateTime(dt) => {
            ValidationRule::DateTime(ValidationDateTime {
                ignore_blank: dt.ignore_blank,
                require_date: dt.require_date,
                require_time: dt.require_time,
                prohibit_date: dt.prohibit_date,
                prohibit_time: dt.prohibit_time,
                ranges: dt
                    .ranges
                    .iter()
                    .map(|range| match range {
                        current::DateTimeRangeSchema::DateRange(min, max) => {
                            DateTimeRange::DateRange(min.to_owned(), max.to_owned())
                        }
                        current::DateTimeRangeSchema::DateEqual(entry) => {
                            DateTimeRange::DateEqual(entry.to_owned())
                        }
                        current::DateTimeRangeSchema::DateNotEqual(entry) => {
                            DateTimeRange::DateNotEqual(entry.to_owned())
                        }
                        current::DateTimeRangeSchema::TimeRange(min, max) => {
                            DateTimeRange::TimeRange(min.to_owned(), max.to_owned())
                        }
                        current::DateTimeRangeSchema::TimeEqual(entry) => {
                            DateTimeRange::TimeEqual(entry.to_owned())
                        }
                        current::DateTimeRangeSchema::TimeNotEqual(entry) => {
                            DateTimeRange::TimeNotEqual(entry.to_owned())
                        }
                    })
                    .collect(),
            })
        }
    }
}

fn export_validation_rule(rule: &ValidationRule) -> current::ValidationRuleSchema {
    match rule {
        ValidationRule::None => current::ValidationRuleSchema::None,
        ValidationRule::List(list) => {
            current::ValidationRuleSchema::List(current::ValidationListSchema {
                source: match &list.source {
                    ValidationListSource::Selection(selection) => {
                        current::ValidationListSourceSchema::Selection(export_selection(selection))
                    }
                    ValidationListSource::List(list) => current::ValidationListSourceSchema::List(
                        list.iter().map(|s| s.to_owned()).collect(),
                    ),
                },
                ignore_blank: list.ignore_blank,
                drop_down: list.drop_down,
            })
        }
        ValidationRule::Logical(logical) => {
            current::ValidationRuleSchema::Logical(current::ValidationLogicalSchema {
                show_checkbox: logical.show_checkbox,
                ignore_blank: logical.ignore_blank,
            })
        }
        ValidationRule::Text(text) => {
            current::ValidationRuleSchema::Text(current::ValidationTextSchema {
                ignore_blank: text.ignore_blank,
                text_match: text
                    .text_match
                    .iter()
                    .map(|m| match m {
                        TextMatch::Exactly(TextCase::CaseInsensitive(cases)) => {
                            current::TextMatchSchema::Exactly(
                                current::TextCaseSchema::CaseInsensitive(
                                    cases.iter().map(|case| case.to_owned()).collect(),
                                ),
                            )
                        }
                        TextMatch::Exactly(TextCase::CaseSensitive(cases)) => {
                            current::TextMatchSchema::Exactly(
                                current::TextCaseSchema::CaseSensitive(
                                    cases.iter().map(|case| case.to_owned()).collect(),
                                ),
                            )
                        }
                        TextMatch::Contains(TextCase::CaseInsensitive(cases)) => {
                            current::TextMatchSchema::Contains(
                                current::TextCaseSchema::CaseInsensitive(
                                    cases.iter().map(|case| case.to_owned()).collect(),
                                ),
                            )
                        }
                        TextMatch::Contains(TextCase::CaseSensitive(cases)) => {
                            current::TextMatchSchema::Contains(
                                current::TextCaseSchema::CaseSensitive(
                                    cases.iter().map(|case| case.to_owned()).collect(),
                                ),
                            )
                        }
                        TextMatch::NotContains(TextCase::CaseInsensitive(cases)) => {
                            current::TextMatchSchema::NotContains(
                                current::TextCaseSchema::CaseInsensitive(
                                    cases.iter().map(|case| case.to_owned()).collect(),
                                ),
                            )
                        }
                        TextMatch::NotContains(TextCase::CaseSensitive(cases)) => {
                            current::TextMatchSchema::NotContains(
                                current::TextCaseSchema::CaseSensitive(
                                    cases.iter().map(|case| case.to_owned()).collect(),
                                ),
                            )
                        }
                        TextMatch::TextLength { min, max } => {
                            current::TextMatchSchema::TextLength {
                                min: min.to_owned(),
                                max: max.to_owned(),
                            }
                        }
                    })
                    .collect(),
            })
        }
        ValidationRule::Number(number) => {
            current::ValidationRuleSchema::Number(current::ValidationNumberSchema {
                ignore_blank: number.ignore_blank,
                ranges: number
                    .ranges
                    .iter()
                    .map(|range| match range {
                        NumberRange::Range(min, max) => {
                            current::NumberRangeSchema::Range(*min, *max)
                        }
                        NumberRange::Equal(entry) => {
                            current::NumberRangeSchema::Equal(entry.clone())
                        }
                        NumberRange::NotEqual(entry) => {
                            current::NumberRangeSchema::NotEqual(entry.clone())
                        }
                    })
                    .collect(),
            })
        }
        ValidationRule::DateTime(dt) => {
            current::ValidationRuleSchema::DateTime(current::ValidationDateTimeSchema {
                ignore_blank: dt.ignore_blank,
                require_date: dt.require_date,
                require_time: dt.require_time,
                prohibit_date: dt.prohibit_date,
                prohibit_time: dt.prohibit_time,
                ranges: dt
                    .ranges
                    .iter()
                    .map(|range| match range {
                        DateTimeRange::DateRange(min, max) => {
                            current::DateTimeRangeSchema::DateRange(*min, *max)
                        }
                        DateTimeRange::DateEqual(entry) => {
                            current::DateTimeRangeSchema::DateEqual(entry.clone())
                        }
                        DateTimeRange::DateNotEqual(entry) => {
                            current::DateTimeRangeSchema::DateNotEqual(entry.clone())
                        }
                        DateTimeRange::TimeRange(min, max) => {
                            current::DateTimeRangeSchema::TimeRange(*min, *max)
                        }
                        DateTimeRange::TimeEqual(entry) => {
                            current::DateTimeRangeSchema::TimeEqual(entry.clone())
                        }
                        DateTimeRange::TimeNotEqual(entry) => {
                            current::DateTimeRangeSchema::TimeNotEqual(entry.clone())
                        }
                    })
                    .collect(),
            })
        }
    }
}

pub fn export_validations(validations: &Validations) -> current::ValidationsSchema {
    current::ValidationsSchema {
        validations: validations
            .validations
            .iter()
            .map(|validation| current::ValidationSchema {
                selection: export_selection(&validation.selection),
                id: validation.id.to_owned(),
                rule: export_validation_rule(&validation.rule),
                message: current::ValidationMessageSchema {
                    show: validation.message.show,
                    title: validation.message.title.to_owned(),
                    message: validation.message.message.to_owned(),
                },
                error: current::ValidationErrorSchema {
                    show: validation.error.show,
                    style: match validation.error.style {
                        ValidationStyle::Warning => current::ValidationStyleSchema::Warning,
                        ValidationStyle::Stop => current::ValidationStyleSchema::Stop,
                        ValidationStyle::Information => current::ValidationStyleSchema::Information,
                    },
                    title: validation.error.title.to_owned(),
                    message: validation.error.message.to_owned(),
                },
            })
            .collect(),
        warnings: validations
            .warnings
            .iter()
            .map(|(pos, id)| (current::PosSchema { x: pos.x, y: pos.y }, *id))
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

    #[test]
    fn import_export_validation_numbers() {
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
                rule: ValidationRule::Number(ValidationNumber {
                    ignore_blank: true,
                    ranges: vec![
                        NumberRange::Range(Some(1f64), Some(10f64)),
                        NumberRange::NotEqual(vec![5f64, -10f64]),
                    ],
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

    #[test]
    fn import_export_validation_text() {
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
                rule: ValidationRule::Text(ValidationText {
                    ignore_blank: true,
                    text_match: vec![
                        TextMatch::Exactly(TextCase::CaseInsensitive(vec![
                            "test".to_owned(),
                            "test2".to_owned(),
                        ])),
                        TextMatch::Contains(TextCase::CaseSensitive(vec![
                            "test".to_owned(),
                            "test2".to_owned(),
                        ])),
                        TextMatch::NotContains(TextCase::CaseInsensitive(vec![
                            "test".to_owned(),
                            "test2".to_owned(),
                        ])),
                        TextMatch::TextLength {
                            min: Some(1),
                            max: Some(10),
                        },
                    ],
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

    #[test]
    fn import_export_validation_date_time() {
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
                rule: ValidationRule::DateTime(ValidationDateTime {
                    ignore_blank: true,
                    require_date: true,
                    require_time: true,
                    prohibit_date: true,
                    prohibit_time: true,
                    ranges: vec![
                        DateTimeRange::DateRange(Some(1i64), Some(10i64)),
                        DateTimeRange::DateNotEqual(vec![5i64, -10i64]),
                        DateTimeRange::TimeRange(Some(1i32), Some(10i32)),
                        DateTimeRange::TimeNotEqual(vec![5i32, -10i32]),
                    ],
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
