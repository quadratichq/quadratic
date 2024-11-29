use std::collections::HashMap;

use anyhow::Result;

use crate::grid::file::v1_7_1;

use super::schema::{self as current};

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
                        coord: cell_access.min.x as u64,
                        is_absolute: false,
                    }),
                    row: Some(v1_7_1::CellRefCoordSchema {
                        coord: cell_access.min.y as u64,
                        is_absolute: false,
                    }),
                },
                end: Some(v1_7_1::CellRefRangeEndSchema {
                    col: Some(v1_7_1::CellRefCoordSchema {
                        coord: cell_access.max.x as u64,
                        is_absolute: false,
                    }),
                    row: Some(v1_7_1::CellRefCoordSchema {
                        coord: cell_access.max.y as u64,
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
        selection.rows.iter().for_each(|rows| {
            rows.iter().for_each(|row| {
                ranges.push(v1_7_1::CellRefRangeSchema::Sheet(
                    v1_7_1::RefRangeBoundsSchema {
                        start: v1_7_1::CellRefRangeEndSchema {
                            row: Some(v1_7_1::CellRefCoordSchema {
                                coord: *row as u64,
                                is_absolute: false,
                            }),
                            col: None,
                        },
                        end: None,
                    },
                ));
            });
        });

        selection.columns.iter().for_each(|columns| {
            columns.iter().for_each(|column| {
                ranges.push(v1_7_1::CellRefRangeSchema::Sheet(
                    v1_7_1::RefRangeBoundsSchema {
                        start: v1_7_1::CellRefRangeEndSchema {
                            col: Some(v1_7_1::CellRefCoordSchema {
                                coord: *column as u64,
                                is_absolute: false,
                            }),
                            row: None,
                        },
                        end: None,
                    },
                ));
            });
        });

        selection.rects.iter().for_each(|rects| {
            rects.iter().for_each(|rect| {
                ranges.push(v1_7_1::CellRefRangeSchema::Sheet(
                    v1_7_1::RefRangeBoundsSchema {
                        start: v1_7_1::CellRefRangeEndSchema {
                            col: Some(v1_7_1::CellRefCoordSchema {
                                coord: rect.min.x as u64,
                                is_absolute: false,
                            }),
                            row: Some(v1_7_1::CellRefCoordSchema {
                                coord: rect.min.y as u64,
                                is_absolute: false,
                            }),
                        },
                        end: (rect.max.x != rect.min.x || rect.max.y != rect.min.y).then_some(
                            v1_7_1::CellRefRangeEndSchema {
                                col: Some(v1_7_1::CellRefCoordSchema {
                                    coord: rect.max.x as u64,
                                    is_absolute: false,
                                }),
                                row: Some(v1_7_1::CellRefCoordSchema {
                                    coord: rect.max.y as u64,
                                    is_absolute: false,
                                }),
                            },
                        ),
                    },
                ));
            });
        });
    }

    if ranges.is_empty() {
        ranges.push(v1_7_1::CellRefRangeSchema::Sheet(
            v1_7_1::RefRangeBoundsSchema {
                start: v1_7_1::CellRefRangeEndSchema {
                    col: Some(v1_7_1::CellRefCoordSchema {
                        coord: selection.x as u64,
                        is_absolute: false,
                    }),
                    row: Some(v1_7_1::CellRefCoordSchema {
                        coord: selection.y as u64,
                        is_absolute: false,
                    }),
                },
                end: None,
            },
        ));
    }

    v1_7_1::A1SelectionSchema {
        sheet_id: v1_7_1::IdSchema::from(selection.sheet_id.to_string()),
        cursor: v1_7_1::PosSchema {
            x: selection.x,
            y: selection.y,
        },
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

fn upgrade_format(format: current::FormatSchema) -> Option<v1_7_1::FormatSchema> {
    Some(v1_7_1::FormatSchema {
        align: format.align,
        vertical_align: format.vertical_align,
        wrap: format.wrap,
        numeric_format: format.numeric_format,
        numeric_decimals: format.numeric_decimals,
        numeric_commas: format.numeric_commas,
        bold: format.bold,
        italic: format.italic,
        text_color: format.text_color,
        fill_color: format.fill_color,
        render_size: format.render_size,
        date_time: format.date_time,
        underline: format.underline,
        strike_through: format.strike_through,
    })
}

type FormatColumnRow = (Option<v1_7_1::FormatSchema>, Option<i64>, Option<i64>);

fn upgrade_formats_all_col_row(
    format_all: Option<current::FormatSchema>,
    format_columns: Vec<(i64, (current::FormatSchema, i64))>,
    format_rows: Vec<(i64, (current::FormatSchema, i64))>,
) -> v1_7_1::SheetFormattingUpgrade {
    let mut formats = v1_7_1::SheetFormattingUpgrade::default();

    // apply format all
    if let Some(format_all) = format_all {
        formats.set_all(upgrade_format(format_all));
    }

    // collect column / row formats and sort by timestamp
    let mut format_col_row: Vec<(i64, FormatColumnRow)> = vec![]; // Vec<(timestamp, (format, column, row))>

    for (column, (format, timestamp)) in format_columns {
        format_col_row.push((timestamp, (upgrade_format(format), Some(column), None)));
    }

    for (row, (format, timestamp)) in format_rows {
        format_col_row.push((timestamp, (upgrade_format(format), None, Some(row))));
    }

    format_col_row.sort_by_key(|(timestamp, _)| *timestamp);

    // apply column / row formats
    for (_, (format, col, row)) in format_col_row {
        if let Some(col) = col {
            dbgjs!("todo(ayush): fix type casting as u64, this needs to support negative indices");
            formats.set_column(col as u64, format);
        } else if let Some(row) = row {
            dbgjs!("todo(ayush): fix type casting as u64, this needs to support negative indices");
            formats.set_row(row as u64, format);
        }
    }

    formats
}

fn upgrade_column_formats_property<T>(
    formats: &mut v1_7_1::SheetFormattingUpgrade,
    x: i64,
    property_iter: impl IntoIterator<Item = (String, current::ColumnRepeatSchema<T>)>,
    format_setter: impl Fn(T) -> v1_7_1::FormatSchema,
) {
    for (y, prop) in property_iter {
        if let Ok(y) = y.parse::<i64>() {
            dbgjs!("todo(ayush): fix type casting as u64, this needs to support negative indices");
            formats.set_column_repeat(
                x as u64,
                y as u64,
                prop.len,
                Some(format_setter(prop.value)),
            );
        }
    }
}

fn upgrade_columns_formats(
    current_columns: Vec<(i64, current::ColumnSchema)>,
    mut formats: v1_7_1::SheetFormattingUpgrade,
) -> (v1_7_1::ColumnsSchema, v1_7_1::SheetFormattingSchema) {
    let mut columns: v1_7_1::ColumnsSchema = vec![];

    for (x, column) in current_columns {
        upgrade_column_formats_property(&mut formats, x, column.align, |value| {
            v1_7_1::FormatSchema {
                align: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.vertical_align, |value| {
            v1_7_1::FormatSchema {
                vertical_align: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.wrap, |value| {
            v1_7_1::FormatSchema {
                wrap: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.numeric_format, |value| {
            v1_7_1::FormatSchema {
                numeric_format: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.numeric_decimals, |value| {
            v1_7_1::FormatSchema {
                numeric_decimals: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.numeric_commas, |value| {
            v1_7_1::FormatSchema {
                numeric_commas: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.bold, |value| {
            v1_7_1::FormatSchema {
                bold: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.italic, |value| {
            v1_7_1::FormatSchema {
                italic: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.text_color, |value| {
            v1_7_1::FormatSchema {
                text_color: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.fill_color, |value| {
            v1_7_1::FormatSchema {
                fill_color: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.render_size, |value| {
            v1_7_1::FormatSchema {
                render_size: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.date_time, |value| {
            v1_7_1::FormatSchema {
                date_time: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.underline, |value| {
            v1_7_1::FormatSchema {
                underline: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats, x, column.strike_through, |value| {
            v1_7_1::FormatSchema {
                strike_through: Some(value),
                ..Default::default()
            }
        });

        columns.push((x, upgrade_column(column.values)));
    }

    let formats = formats
        .into_iter()
        .map(|(x, block)| {
            (
                x,
                v1_7_1::BlockSchema {
                    start: block.start,
                    end: block.end,
                    value: block.value.into_iter().collect(),
                },
            )
        })
        .collect();

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

    v1_7_1::SheetSchema {
        id,
        name,
        color,
        order,
        offsets,
        rows_resize,
        validations: upgrade_validations(validations),
        borders,
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
