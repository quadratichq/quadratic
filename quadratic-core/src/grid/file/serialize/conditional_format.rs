//! Serialization functions for conditional formatting.

use anyhow::Result;

use super::current;
use super::formula::{export_formula, import_formula};
use super::selection::{export_selection, import_selection};
use crate::grid::sheet::conditional_format::{
    ConditionalFormat, ConditionalFormatStyle, ConditionalFormats,
};

fn import_style(schema: current::ConditionalFormatStyleSchema) -> ConditionalFormatStyle {
    ConditionalFormatStyle {
        bold: schema.bold,
        italic: schema.italic,
        underline: schema.underline,
        strike_through: schema.strike_through,
        text_color: schema.text_color,
        fill_color: schema.fill_color,
    }
}

fn export_style(style: ConditionalFormatStyle) -> current::ConditionalFormatStyleSchema {
    current::ConditionalFormatStyleSchema {
        bold: style.bold,
        italic: style.italic,
        underline: style.underline,
        strike_through: style.strike_through,
        text_color: style.text_color,
        fill_color: style.fill_color,
    }
}

pub fn import_conditional_formats(
    schema: current::ConditionalFormatsSchema,
) -> Result<ConditionalFormats> {
    let conditional_formats = schema
        .conditional_formats
        .into_iter()
        .map(|cf| {
            Ok(ConditionalFormat {
                id: cf.id,
                selection: import_selection(cf.selection),
                style: import_style(cf.style),
                rule: import_formula(cf.rule)?,
                apply_to_blank: cf.apply_to_blank,
            })
        })
        .collect::<Result<Vec<_>>>()?;

    Ok(ConditionalFormats::from_vec(conditional_formats))
}

pub fn export_conditional_formats(
    conditional_formats: ConditionalFormats,
) -> current::ConditionalFormatsSchema {
    current::ConditionalFormatsSchema {
        conditional_formats: conditional_formats
            .conditional_formats
            .into_iter()
            .map(|cf| current::ConditionalFormatSchema {
                id: cf.id,
                selection: export_selection(cf.selection),
                style: export_style(cf.style),
                rule: export_formula(cf.rule),
                apply_to_blank: cf.apply_to_blank,
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::*;
    use crate::a1::A1Selection;
    use crate::controller::GridController;
    use crate::formulas::parse_formula;

    #[test]
    fn test_import_export_conditional_formats() {
        let gc = GridController::new();
        let pos = gc.grid().origin_in_first_sheet();
        let ctx = gc.a1_context();

        let formula = parse_formula("=A1 > 10", ctx, pos).unwrap();

        let conditional_formats = ConditionalFormats::from_vec(vec![ConditionalFormat {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:B10"),
            style: ConditionalFormatStyle {
                bold: Some(true),
                fill_color: Some("#FF0000".to_string()),
                ..Default::default()
            },
            rule: formula,
            apply_to_blank: None,
        }]);

        let exported = export_conditional_formats(conditional_formats.clone());
        let imported = import_conditional_formats(exported).unwrap();

        assert_eq!(conditional_formats, imported);
    }

    #[test]
    fn test_empty_conditional_formats() {
        let conditional_formats = ConditionalFormats::default();
        let exported = export_conditional_formats(conditional_formats.clone());
        let imported = import_conditional_formats(exported).unwrap();

        assert_eq!(conditional_formats, imported);
        assert!(imported.is_empty());
    }
}
