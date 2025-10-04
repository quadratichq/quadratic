use std::collections::HashMap;

use anyhow::Result;

use crate::grid::file::{
    shift_negative_offsets::IMPORT_OFFSET_START_FOR_INFINITE,
    v1_7_1::{self, CellRefCoordSchema},
};

use super::{
    BordersUpgrade, SheetFormattingUpgrade,
    schema::{self as current, BorderStyleCellSchema},
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
                    col: v1_7_1::CellRefCoordSchema {
                        coord: cell_access.min.x,
                        is_absolute: false,
                    },
                    row: v1_7_1::CellRefCoordSchema {
                        coord: cell_access.min.y,
                        is_absolute: false,
                    },
                },
                end: v1_7_1::CellRefRangeEndSchema {
                    col: v1_7_1::CellRefCoordSchema {
                        coord: cell_access.max.x,
                        is_absolute: false,
                    },
                    row: v1_7_1::CellRefCoordSchema {
                        coord: cell_access.max.y,
                        is_absolute: false,
                    },
                },
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
                    col: CellRefCoordSchema {
                        coord: 1,
                        is_absolute: false,
                    },
                    row: CellRefCoordSchema {
                        coord: 1,
                        is_absolute: false,
                    },
                },
                end: v1_7_1::CellRefRangeEndSchema {
                    col: CellRefCoordSchema::UNBOUNDED,
                    row: CellRefCoordSchema::UNBOUNDED,
                },
            },
        ));
    } else {
        selection.rows.into_iter().for_each(|rows| {
            rows.into_iter().for_each(|row| {
                ranges.push(v1_7_1::CellRefRangeSchema::Sheet(
                    v1_7_1::RefRangeBoundsSchema {
                        start: v1_7_1::CellRefRangeEndSchema {
                            row: v1_7_1::CellRefCoordSchema {
                                coord: row,
                                is_absolute: false,
                            },
                            col: v1_7_1::CellRefCoordSchema {
                                coord: 1,
                                is_absolute: false,
                            },
                        },
                        end: v1_7_1::CellRefRangeEndSchema {
                            row: v1_7_1::CellRefCoordSchema {
                                coord: row,
                                is_absolute: false,
                            },
                            col: v1_7_1::CellRefCoordSchema {
                                coord: 1,
                                is_absolute: false,
                            },
                        },
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
                            col: v1_7_1::CellRefCoordSchema {
                                coord: column,
                                is_absolute: false,
                            },
                            row: v1_7_1::CellRefCoordSchema::UNBOUNDED,
                        },
                        end: v1_7_1::CellRefRangeEndSchema {
                            col: v1_7_1::CellRefCoordSchema {
                                coord: column,
                                is_absolute: false,
                            },
                            row: v1_7_1::CellRefCoordSchema::UNBOUNDED,
                        },
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
                            col: v1_7_1::CellRefCoordSchema {
                                coord: rect.min.x,
                                is_absolute: false,
                            },
                            row: v1_7_1::CellRefCoordSchema {
                                coord: rect.min.y,
                                is_absolute: false,
                            },
                        },
                        end: v1_7_1::CellRefRangeEndSchema {
                            col: v1_7_1::CellRefCoordSchema {
                                coord: rect.max.x,
                                is_absolute: false,
                            },
                            row: v1_7_1::CellRefCoordSchema {
                                coord: rect.max.y,
                                is_absolute: false,
                            },
                        },
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
                    col: v1_7_1::CellRefCoordSchema {
                        coord: selection.x,
                        is_absolute: false,
                    },
                    row: v1_7_1::CellRefCoordSchema {
                        coord: selection.y,
                        is_absolute: false,
                    },
                },
                end: v1_7_1::CellRefRangeEndSchema {
                    col: v1_7_1::CellRefCoordSchema {
                        coord: selection.x,
                        is_absolute: false,
                    },
                    row: v1_7_1::CellRefCoordSchema {
                        coord: selection.y,
                        is_absolute: false,
                    },
                },
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

fn apply_left_right_cell_borders(
    borders_upgrade: &mut BordersUpgrade,
    borders: impl IntoIterator<
        Item = (
            i64,
            HashMap<i64, current::ColumnRepeatSchema<current::BorderStyleTimestampSchema>>,
        ),
    >,
    f: impl Fn(current::BorderStyleTimestampSchema) -> BorderStyleCellSchema,
) {
    for (x, map) in borders {
        for (y, repeat) in map {
            borders_upgrade.apply_borders(
                x,
                y,
                Some(x),
                Some(y + repeat.len as i64 - 1),
                f(repeat.value),
            );
        }
    }
}

fn apply_top_bottom_cell_borders(
    borders_upgrade: &mut BordersUpgrade,
    borders: impl IntoIterator<
        Item = (
            i64,
            HashMap<i64, current::ColumnRepeatSchema<current::BorderStyleTimestampSchema>>,
        ),
    >,
    f: impl Fn(current::BorderStyleTimestampSchema) -> BorderStyleCellSchema,
) {
    for (y, map) in borders {
        for (x, repeat) in map {
            borders_upgrade.apply_borders(
                x,
                y,
                Some(x + repeat.len as i64 - 1),
                Some(y),
                f(repeat.value),
            );
        }
    }
}

type BordersColumnRow = (BorderStyleCellSchema, (Option<i64>, Option<i64>));

fn upgrade_borders(borders: current::BordersSchema) -> v1_7_1::BordersSchema {
    let mut borders_upgrade = BordersUpgrade::default();

    // apply all borders
    borders_upgrade.apply_borders(
        IMPORT_OFFSET_START_FOR_INFINITE,
        IMPORT_OFFSET_START_FOR_INFINITE,
        None,
        None,
        borders.all,
    );

    // collect column / row formats and sort by timestamp
    let mut borders_column_row: Vec<(u32, BordersColumnRow)> = vec![];

    for (column, border_column) in borders.columns {
        let timestamp = border_column
            .left
            .as_ref()
            .or(border_column.right.as_ref())
            .or(border_column.top.as_ref())
            .or(border_column.bottom.as_ref())
            .map(|border| border.timestamp)
            .unwrap_or(0);

        borders_column_row.push((timestamp, (border_column, (Some(column), None))));
    }

    for (row, border_row) in borders.rows {
        let timestamp = border_row
            .left
            .as_ref()
            .or(border_row.right.as_ref())
            .or(border_row.top.as_ref())
            .or(border_row.bottom.as_ref())
            .map(|border| border.timestamp)
            .unwrap_or(0);

        borders_column_row.push((timestamp, (border_row, (None, Some(row)))));
    }

    borders_column_row.sort_by_key(|(timestamp, _)| *timestamp);

    for (_, (border, (col, row))) in borders_column_row {
        if let Some(col) = col {
            borders_upgrade.apply_borders(
                col,
                IMPORT_OFFSET_START_FOR_INFINITE,
                Some(col),
                None,
                border,
            );
        } else if let Some(row) = row {
            borders_upgrade.apply_borders(
                IMPORT_OFFSET_START_FOR_INFINITE,
                row,
                None,
                Some(row),
                border,
            );
        }
    }

    apply_left_right_cell_borders(&mut borders_upgrade, borders.left, |border| {
        BorderStyleCellSchema {
            left: Some(border),
            ..Default::default()
        }
    });

    apply_left_right_cell_borders(&mut borders_upgrade, borders.right, |border| {
        BorderStyleCellSchema {
            right: Some(border),
            ..Default::default()
        }
    });

    apply_top_bottom_cell_borders(&mut borders_upgrade, borders.top, |border| {
        BorderStyleCellSchema {
            top: Some(border),
            ..Default::default()
        }
    });

    apply_top_bottom_cell_borders(&mut borders_upgrade, borders.bottom, |border| {
        BorderStyleCellSchema {
            bottom: Some(border),
            ..Default::default()
        }
    });

    borders_upgrade.upgrade_schema()
}

fn upgrade_column(values: HashMap<String, v1_7_1::CellValueSchema>) -> v1_7_1::ColumnSchema {
    values
        .into_iter()
        .filter_map(|(index, value)| index.parse::<i64>().ok().map(|idx| (idx, value)))
        .collect()
}

type FormatColumnRow = (current::FormatSchema, (Option<i64>, Option<i64>));

fn upgrade_formats_all_col_row(
    format_all: Option<current::FormatSchema>,
    format_columns: Vec<(i64, (current::FormatSchema, i64))>,
    format_rows: Vec<(i64, (current::FormatSchema, i64))>,
) -> SheetFormattingUpgrade {
    let mut formats_upgrade = SheetFormattingUpgrade::default();

    // apply format all
    if let Some(format_all) = format_all {
        formats_upgrade.apply_format(
            IMPORT_OFFSET_START_FOR_INFINITE,
            IMPORT_OFFSET_START_FOR_INFINITE,
            None,
            None,
            format_all,
        );
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
            formats_upgrade.apply_format(
                col,
                IMPORT_OFFSET_START_FOR_INFINITE,
                Some(col),
                None,
                format,
            );
        } else if let Some(row) = row {
            formats_upgrade.apply_format(
                IMPORT_OFFSET_START_FOR_INFINITE,
                row,
                None,
                Some(row),
                format,
            );
        }
    }

    formats_upgrade
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
    mut formats_upgrade: SheetFormattingUpgrade,
) -> (v1_7_1::ColumnsSchema, v1_7_1::SheetFormattingSchema) {
    let mut columns: v1_7_1::ColumnsSchema = vec![];

    for (x, column) in current_columns {
        upgrade_column_formats_property(&mut formats_upgrade, x, column.align, |value| {
            current::FormatSchema {
                align: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats_upgrade, x, column.vertical_align, |value| {
            current::FormatSchema {
                vertical_align: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats_upgrade, x, column.wrap, |value| {
            current::FormatSchema {
                wrap: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats_upgrade, x, column.numeric_format, |value| {
            current::FormatSchema {
                numeric_format: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(
            &mut formats_upgrade,
            x,
            column.numeric_decimals,
            |value| current::FormatSchema {
                numeric_decimals: Some(value),
                ..Default::default()
            },
        );

        upgrade_column_formats_property(&mut formats_upgrade, x, column.numeric_commas, |value| {
            current::FormatSchema {
                numeric_commas: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats_upgrade, x, column.bold, |value| {
            current::FormatSchema {
                bold: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats_upgrade, x, column.italic, |value| {
            current::FormatSchema {
                italic: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats_upgrade, x, column.text_color, |value| {
            current::FormatSchema {
                text_color: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats_upgrade, x, column.fill_color, |value| {
            current::FormatSchema {
                fill_color: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats_upgrade, x, column.render_size, |value| {
            current::FormatSchema {
                render_size: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats_upgrade, x, column.date_time, |value| {
            current::FormatSchema {
                date_time: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats_upgrade, x, column.underline, |value| {
            current::FormatSchema {
                underline: Some(value),
                ..Default::default()
            }
        });

        upgrade_column_formats_property(&mut formats_upgrade, x, column.strike_through, |value| {
            current::FormatSchema {
                strike_through: Some(value),
                ..Default::default()
            }
        });

        columns.push((x, upgrade_column(column.values)));
    }

    let formats = formats_upgrade.upgrade_schema();

    (columns, formats)
}

pub(crate) fn upgrade_sheet(sheet: current::SheetSchema) -> v1_7_1::SheetSchema {
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

    let formats_upgrade = upgrade_formats_all_col_row(formats_all, formats_columns, formats_rows);

    let (columns, formats) = upgrade_columns_formats(columns, formats_upgrade);

    v1_7_1::SheetSchema {
        id,
        name,
        color,
        order,
        offsets,
        rows_resize,
        validations: upgrade_validations(validations),
        borders: upgrade_borders(borders),
        formats,
        code_runs: upgrade_code_runs(code_runs),
        columns,
    }
}

pub(crate) fn upgrade(grid: current::GridSchema) -> Result<v1_7_1::GridSchema> {
    let new_grid = v1_7_1::GridSchema {
        version: "1.7.1".to_string(),
        sheets: grid.sheets.into_iter().map(upgrade_sheet).collect(),
    };
    Ok(new_grid)
}
