//! Serialization functions for conditional formatting.

use anyhow::Result;

use super::current;
use super::formula::{export_formula, import_formula};
use super::selection::{export_selection, import_selection};
use crate::grid::sheet::conditional_format::{
    ColorScale, ColorScaleThreshold, ColorScaleThresholdValueType, ConditionalFormat,
    ConditionalFormatConfig, ConditionalFormatStyle, ConditionalFormats,
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

fn export_style(style: &ConditionalFormatStyle) -> current::ConditionalFormatStyleSchema {
    current::ConditionalFormatStyleSchema {
        bold: style.bold,
        italic: style.italic,
        underline: style.underline,
        strike_through: style.strike_through,
        text_color: style.text_color.clone(),
        fill_color: style.fill_color.clone(),
    }
}

fn import_color_scale_threshold_value_type(
    schema: current::ColorScaleThresholdValueTypeSchema,
) -> ColorScaleThresholdValueType {
    match schema {
        current::ColorScaleThresholdValueTypeSchema::Min => ColorScaleThresholdValueType::Min,
        current::ColorScaleThresholdValueTypeSchema::Max => ColorScaleThresholdValueType::Max,
        current::ColorScaleThresholdValueTypeSchema::Number(n) => {
            ColorScaleThresholdValueType::Number(n)
        }
        current::ColorScaleThresholdValueTypeSchema::Percentile(p) => {
            ColorScaleThresholdValueType::Percentile(p)
        }
        current::ColorScaleThresholdValueTypeSchema::Percent(p) => {
            ColorScaleThresholdValueType::Percent(p)
        }
    }
}

fn export_color_scale_threshold_value_type(
    value_type: &ColorScaleThresholdValueType,
) -> current::ColorScaleThresholdValueTypeSchema {
    match value_type {
        ColorScaleThresholdValueType::Min => current::ColorScaleThresholdValueTypeSchema::Min,
        ColorScaleThresholdValueType::Max => current::ColorScaleThresholdValueTypeSchema::Max,
        ColorScaleThresholdValueType::Number(n) => {
            current::ColorScaleThresholdValueTypeSchema::Number(*n)
        }
        ColorScaleThresholdValueType::Percentile(p) => {
            current::ColorScaleThresholdValueTypeSchema::Percentile(*p)
        }
        ColorScaleThresholdValueType::Percent(p) => {
            current::ColorScaleThresholdValueTypeSchema::Percent(*p)
        }
    }
}

fn import_color_scale_threshold(schema: current::ColorScaleThresholdSchema) -> ColorScaleThreshold {
    ColorScaleThreshold {
        value_type: import_color_scale_threshold_value_type(schema.value_type),
        color: schema.color,
    }
}

fn export_color_scale_threshold(
    threshold: &ColorScaleThreshold,
) -> current::ColorScaleThresholdSchema {
    current::ColorScaleThresholdSchema {
        value_type: export_color_scale_threshold_value_type(&threshold.value_type),
        color: threshold.color.clone(),
    }
}

fn import_color_scale(schema: current::ColorScaleSchema) -> ColorScale {
    ColorScale {
        thresholds: schema
            .thresholds
            .into_iter()
            .map(import_color_scale_threshold)
            .collect(),
        invert_text_on_dark: schema.invert_text_on_dark,
    }
}

fn export_color_scale(color_scale: &ColorScale) -> current::ColorScaleSchema {
    current::ColorScaleSchema {
        thresholds: color_scale
            .thresholds
            .iter()
            .map(export_color_scale_threshold)
            .collect(),
        invert_text_on_dark: color_scale.invert_text_on_dark,
    }
}

fn import_config(
    schema: current::ConditionalFormatConfigSchema,
) -> Result<ConditionalFormatConfig> {
    match schema {
        current::ConditionalFormatConfigSchema::Formula { rule, style } => {
            Ok(ConditionalFormatConfig::Formula {
                rule: import_formula(rule)?,
                style: import_style(style),
            })
        }
        current::ConditionalFormatConfigSchema::ColorScale { color_scale } => {
            Ok(ConditionalFormatConfig::ColorScale {
                color_scale: import_color_scale(color_scale),
            })
        }
    }
}

fn export_config(config: &ConditionalFormatConfig) -> current::ConditionalFormatConfigSchema {
    match config {
        ConditionalFormatConfig::Formula { rule, style } => {
            current::ConditionalFormatConfigSchema::Formula {
                rule: export_formula(rule.clone()),
                style: export_style(style),
            }
        }
        ConditionalFormatConfig::ColorScale { color_scale } => {
            current::ConditionalFormatConfigSchema::ColorScale {
                color_scale: export_color_scale(color_scale),
            }
        }
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
                config: import_config(cf.config)?,
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
                config: export_config(&cf.config),
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
    fn test_import_export_formula_conditional_formats() {
        let gc = GridController::new();
        let pos = gc.grid().origin_in_first_sheet();
        let ctx = gc.a1_context();

        let formula = parse_formula("=A1 > 10", ctx, pos).unwrap();

        let conditional_formats = ConditionalFormats::from_vec(vec![ConditionalFormat {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:B10"),
            config: ConditionalFormatConfig::Formula {
                rule: formula,
                style: ConditionalFormatStyle {
                    bold: Some(true),
                    fill_color: Some("#FF0000".to_string()),
                    ..Default::default()
                },
            },
            apply_to_blank: None,
        }]);

        let exported = export_conditional_formats(conditional_formats.clone());
        let imported = import_conditional_formats(exported).unwrap();

        assert_eq!(conditional_formats, imported);
    }

    #[test]
    fn test_import_export_color_scale_conditional_formats() {
        let conditional_formats = ConditionalFormats::from_vec(vec![ConditionalFormat {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:A100"),
            config: ConditionalFormatConfig::ColorScale {
                color_scale: ColorScale::three_color("#ff0000", "#ffff00", "#00ff00"),
            },
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
