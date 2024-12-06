use std::collections::HashMap;

use anyhow::Result;

use crate::grid::file::v1_7_1;

use super::{
    schema::{self as current},
    Contiguous2DUpgrade, SheetFormattingUpgrade,
};

fn upgrade_cells_accessed(
    cells_accessed: Vec<current::SheetRectSchema>,
) -> v1_7_1::CellsAccessedSchema {
    let mut new_cells_accessed: HashMap<v1_7_1::IdSchema, Vec<v1_7_1::CellRefRangeSchema>> =
        HashMap::new();

    for cell_access in cells_accessed {
        let vec = new_cells_accessed
            .entry(v1_7_1::IdSchema::from(cell_access.sheet_id.id))
            .or_default();
        vec.push(v1_7_1::CellRefRangeSchema::Sheet(
            v1_7_1::RefRangeBoundsSchema {
                start: v1_7_1::CellRefRangeEndSchema {
                    col: Some(v1_7_1::CellRefCoordSchema {
                        coord: cell_access.min.x,
                        is_absolute: false,
                    }),
                    row: Some(v1_7_1::CellRefCoordSchema {
                        coord: cell_access.min.y,
                        is_absolute: false,
                    }),
                },
                end: Some(v1_7_1::CellRefRangeEndSchema {
                    col: Some(v1_7_1::CellRefCoordSchema {
                        coord: cell_access.max.x,
                        is_absolute: false,
                    }),
                    row: Some(v1_7_1::CellRefCoordSchema {
                        coord: cell_access.max.y,
                        is_absolute: false,
                    }),
                }),
            },
        ));
    }
    new_cells_accessed.into_iter().collect()
}

fn upgrade_code_run(code_run: current::CodeRunSchema) -> v1_7_1::CodeRunSchema {
    v1_7_1::CodeRunSchema {
        formatted_code_string: code_run.formatted_code_string,
        std_out: code_run.std_out,
        std_err: code_run.std_err,
        cells_accessed: upgrade_cells_accessed(code_run.cells_accessed),
        result: code_run.result,
        return_type: code_run.return_type,
        line_number: code_run.line_number,
        output_type: code_run.output_type,
        spill_error: code_run.spill_error,
        last_modified: code_run.last_modified,
    }
}

fn upgrade_code_runs(
    code_runs: Vec<(current::PosSchema, current::CodeRunSchema)>,
) -> v1_7_1::CodeRunsSchema {
    code_runs
        .into_iter()
        .map(|(pos, code_run)| (pos, upgrade_code_run(code_run)))
        .collect()
}

fn upgrade_selection(selection: current::SelectionSchema) -> v1_7_1::A1SelectionSchema {
    let mut ranges = vec![];
    let mut cursor = v1_7_1::PosSchema {
        x: selection.x,
        y: selection.y,
    };

    if selection.all {
        ranges.push(v1_7_1::CellRefRangeSchema::Sheet(
            v1_7_1::RefRangeBoundsSchema {
                start: v1_7_1::CellRefRangeEndSchema {
                    col: None,
                    row: None,
                },
                end: Some(v1_7_1::CellRefRangeEndSchema {
                    col: None,
                    row: None,
                }),
            },
        ));
    } else {
        selection.rows.into_iter().for_each(|rows| {
            rows.into_iter().for_each(|row| {
                ranges.push(v1_7_1::CellRefRangeSchema::Sheet(
                    v1_7_1::RefRangeBoundsSchema {
                        start: v1_7_1::CellRefRangeEndSchema {
                            row: Some(v1_7_1::CellRefCoordSchema {
                                coord: row,
                                is_absolute: false,
                            }),
                            col: None,
                        },
                        end: None,
                    },
                ));
                cursor.x = 1;
                cursor.y = row;
            });
        });

        selection.columns.into_iter().for_each(|columns| {
            columns.into_iter().for_each(|column| {
                ranges.push(v1_7_1::CellRefRangeSchema::Sheet(
                    v1_7_1::RefRangeBoundsSchema {
                        start: v1_7_1::CellRefRangeEndSchema {
                            col: Some(v1_7_1::CellRefCoordSchema {
                                coord: column,
                                is_absolute: false,
                            }),
                            row: None,
                        },
                        end: None,
                    },
                ));
                cursor.x = column;
                cursor.y = 1;
            });
        });

        selection.rects.into_iter().for_each(|rects| {
            rects.into_iter().for_each(|rect| {
                ranges.push(v1_7_1::CellRefRangeSchema::Sheet(
                    v1_7_1::RefRangeBoundsSchema {
                        start: v1_7_1::CellRefRangeEndSchema {
                            col: Some(v1_7_1::CellRefCoordSchema {
                                coord: rect.min.x,
                                is_absolute: false,
                            }),
                            row: Some(v1_7_1::CellRefCoordSchema {
                                coord: rect.min.y,
                                is_absolute: false,
                            }),
                        },
                        end: (rect.max.x != rect.min.x || rect.max.y != rect.min.y).then_some(
                            v1_7_1::CellRefRangeEndSchema {
                                col: Some(v1_7_1::CellRefCoordSchema {
                                    coord: rect.max.x,
                                    is_absolute: false,
                                }),
                                row: Some(v1_7_1::CellRefCoordSchema {
                                    coord: rect.max.y,
                                    is_absolute: false,
                                }),
                            },
                        ),
                    },
                ));
                cursor.x = rect.min.x;
                cursor.y = rect.min.y;
            });
        });
    }

    if ranges.is_empty() {
        ranges.push(v1_7_1::CellRefRangeSchema::Sheet(
            v1_7_1::RefRangeBoundsSchema {
                start: v1_7_1::CellRefRangeEndSchema {
                    col: Some(v1_7_1::CellRefCoordSchema {
                        coord: selection.x,
                        is_absolute: false,
                    }),
                    row: Some(v1_7_1::CellRefCoordSchema {
                        coord: selection.y,
                        is_absolute: false,
                    }),
                },
                end: None,
            },
        ));
    }

    v1_7_1::A1SelectionSchema {
        sheet_id: v1_7_1::IdSchema::from(selection.sheet_id.to_string()),
        cursor,
        ranges,
    }
}

fn upgrade_validation_rule(rule: current::ValidationRuleSchema) -> v1_7_1::ValidationRuleSchema {
    match rule {
        current::ValidationRuleSchema::None => v1_7_1::ValidationRuleSchema::None,
        current::ValidationRuleSchema::List(list) => match list.source {
            current::ValidationListSourceSchema::Selection(selection) => {
                v1_7_1::ValidationRuleSchema::List(v1_7_1::ValidationListSchema {
                    source: v1_7_1::ValidationListSourceSchema::Selection(upgrade_selection(
                        selection,
                    )),
                    ignore_blank: list.ignore_blank,
                    drop_down: list.drop_down,
                })
            }
            current::ValidationListSourceSchema::List(string_list) => {
                v1_7_1::ValidationRuleSchema::List(v1_7_1::ValidationListSchema {
                    source: v1_7_1::ValidationListSourceSchema::List(string_list),
                    ignore_blank: list.ignore_blank,
                    drop_down: list.drop_down,
                })
            }
        },
        current::ValidationRuleSchema::Logical(logical) => {
            v1_7_1::ValidationRuleSchema::Logical(logical)
        }
        current::ValidationRuleSchema::Text(text) => v1_7_1::ValidationRuleSchema::Text(text),
        current::ValidationRuleSchema::Number(number) => {
            v1_7_1::ValidationRuleSchema::Number(number)
        }
        current::ValidationRuleSchema::DateTime(date_time) => {
            v1_7_1::ValidationRuleSchema::DateTime(date_time)
        }
    }
}

fn upgrade_validation(validation: current::ValidationSchema) -> v1_7_1::ValidationSchema {
    v1_7_1::ValidationSchema {
        id: validation.id,
        selection: upgrade_selection(validation.selection),
        rule: upgrade_validation_rule(validation.rule),
        message: validation.message,
        error: validation.error,
    }
}

fn upgrade_validations(validations: current::ValidationsSchema) -> v1_7_1::ValidationsSchema {
    v1_7_1::ValidationsSchema {
        validations: validations
            .validations
            .into_iter()
            .map(upgrade_validation)
            .collect(),
        warnings: validations.warnings,
    }
}

fn upgrade_column(values: HashMap<String, v1_7_1::CellValueSchema>) -> v1_7_1::ColumnSchema {
    values
        .into_iter()
        .filter_map(|(index, value)| index.parse::<i64>().ok().map(|idx| (idx, value)))
        .collect()
}

fn sheet_formatting_upgrade_to_schema(
    formats: SheetFormattingUpgrade,
) -> v1_7_1::SheetFormattingSchema {
    v1_7_1::SheetFormattingSchema {
        align: contiguous_2d_upgrade_to_schema(formats.align),
        vertical_align: contiguous_2d_upgrade_to_schema(formats.vertical_align),
        wrap: contiguous_2d_upgrade_to_schema(formats.wrap),
        numeric_format: contiguous_2d_upgrade_to_schema(formats.numeric_format),
        numeric_decimals: contiguous_2d_upgrade_to_schema(formats.numeric_decimals),
        numeric_commas: contiguous_2d_upgrade_to_schema(formats.numeric_commas),
        bold: contiguous_2d_upgrade_to_schema(formats.bold),
        italic: contiguous_2d_upgrade_to_schema(formats.italic),
        text_color: contiguous_2d_upgrade_to_schema(formats.text_color),
        fill_color: contiguous_2d_upgrade_to_schema(formats.fill_color),
        render_size: contiguous_2d_upgrade_to_schema(formats.render_size),
        date_time: contiguous_2d_upgrade_to_schema(formats.date_time),
        underline: contiguous_2d_upgrade_to_schema(formats.underline),
        strike_through: contiguous_2d_upgrade_to_schema(formats.strike_through),
    }
}

fn contiguous_2d_upgrade_to_schema<T: Default + Clone + PartialEq>(
    blocks: Contiguous2DUpgrade<T>,
) -> v1_7_1::Contiguous2DSchema<T> {
    blocks
        .into_xy_blocks()
        .map(|x_block| v1_7_1::BlockSchema {
            start: x_block.start,
            end: x_block.end,
            value: x_block
                .value
                .map(|y_block| v1_7_1::BlockSchema {
                    start: y_block.start,
                    end: y_block.end,
                    value: y_block.value,
                })
                .collect(),
        })
        .collect()
}

type FormatColumnRow = (current::FormatSchema, (Option<i64>, Option<i64>));

fn upgrade_formats_all_col_row(
    format_all: Option<current::FormatSchema>,
    format_columns: Vec<(i64, (current::FormatSchema, i64))>,
    format_rows: Vec<(i64, (current::FormatSchema, i64))>,
) -> SheetFormattingUpgrade {
    let mut formats = SheetFormattingUpgrade::default();

    // apply format all
    if let Some(format_all) = format_all {
        formats.apply_format(1, 1, None, None, format_all);
    }

    // collect column / row formats and sort by timestamp
    let mut format_col_row: Vec<(i64, FormatColumnRow)> = vec![]; // Vec<(timestamp, (format, column, row))>

    for (column, (format, timestamp)) in format_columns {
        format_col_row.push((timestamp, (format, (Some(column), None))));
    }

    for (row, (format, timestamp)) in format_rows {
        format_col_row.push((timestamp, (format, (None, Some(row)))));
    }

    format_col_row.sort_by_key(|(timestamp, _)| *timestamp);

    // apply column / row formats
    for (_, (format, (col, row))) in format_col_row {
        if let Some(col) = col {
            formats.apply_format(1, 1, Some(col), None, format);
        } else if let Some(row) = row {
            formats.apply_format(1, 1, None, Some(row), format);
        }
    }

    formats
}

fn upgrade_column_formats_property<T>(
    formats: &mut SheetFormattingUpgrade,
    x: i64,
    property_iter: impl IntoIterator<Item = (String, current::ColumnRepeatSchema<T>)>,
    format_setter: impl Fn(T) -> current::FormatSchema,
) {
    for (y, prop) in property_iter {
        if let Ok(y) = y.parse::<i64>() {
            formats.apply_format(
                x,
                y,
                Some(x),
                Some(y + prop.len as i64 - 1),
                format_setter(prop.value),
            );
        }
    }
}

fn upgrade_columns_formats(
    current_columns: Vec<(i64, current::ColumnSchema)>,
    mut formats: SheetFormattingUpgrade,
) -> (v1_7_1::ColumnsSchema, v1_7_1::SheetFormattingSchema) {
    let mut columns: v1_7_1::ColumnsSchema = vec![];

    for (x, column) in current_columns {
        upgrade_column_formats_property(&mut formats, x, column.align, |value| {
            current::FormatSchema {
                align: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.vertical_align, |value| {
            current::FormatSchema {
                vertical_align: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.wrap, |value| {
            current::FormatSchema {
                wrap: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.numeric_format, |value| {
            current::FormatSchema {
                numeric_format: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.numeric_decimals, |value| {
            current::FormatSchema {
                numeric_decimals: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.numeric_commas, |value| {
            current::FormatSchema {
                numeric_commas: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.bold, |value| {
            current::FormatSchema {
                bold: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.italic, |value| {
            current::FormatSchema {
                italic: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.text_color, |value| {
            current::FormatSchema {
                text_color: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.fill_color, |value| {
            current::FormatSchema {
                fill_color: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.render_size, |value| {
            current::FormatSchema {
                render_size: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.date_time, |value| {
            current::FormatSchema {
                date_time: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.underline, |value| {
            current::FormatSchema {
                underline: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.strike_through, |value| {
            current::FormatSchema {
                strike_through: Some(value),
                ..Default::default()
            }
        });

        columns.push((x, upgrade_column(column.values)));
    }

    let formats = sheet_formatting_upgrade_to_schema(formats);

    (columns, formats)
}

pub fn upgrade_sheet(sheet: current::SheetSchema) -> v1_7_1::SheetSchema {
    let current::SheetSchema {
        id,
        name,
        color,
        order,
        offsets,
        rows_resize,
        formats_all,
        formats_columns,
        formats_rows,
        validations,
        borders,
        code_runs,
        columns,
    } = sheet;

    let formats = upgrade_formats_all_col_row(formats_all, formats_columns, formats_rows);

    let (columns, formats) = upgrade_columns_formats(columns, formats);

    dbgjs!("todo(ayush): upgrade borders_a1");

    v1_7_1::SheetSchema {
        id,
        name,
        color,
        order,
        offsets,
        rows_resize,
        validations: upgrade_validations(validations),
        borders,
        borders_a1: v1_7_1::BordersA1Schema::default(),
        formats,
        code_runs: upgrade_code_runs(code_runs),
        columns,
    }
}

pub fn upgrade(grid: current::GridSchema) -> Result<v1_7_1::GridSchema> {
    let new_grid = v1_7_1::GridSchema {
        version: "1.7.1".to_string(),
        sheets: grid.sheets.into_iter().map(upgrade_sheet).collect(),
    };
    Ok(new_grid)
}
