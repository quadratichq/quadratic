use anyhow::Result;

use crate::grid::file::serialize::contiguous_2d::import_contiguous_2d;
use crate::grid::file::serialize::contiguous_2d::opt_fn;
use crate::grid::file::v1_7::schema::OffsetsSchema;
use crate::grid::file::v1_7_1 as current;
use crate::grid::file::v1_8;
use crate::grid::formatting::RenderSize;
use crate::Pos;

use super::sheet_offsets::Offsets;

const DEFAULT_HTML_WIDTH: f32 = 600.0;
const DEFAULT_HTML_HEIGHT: f32 = 460.0;

fn import_render_size(render_size: current::RenderSizeSchema) -> RenderSize {
    RenderSize {
        w: render_size.w,
        h: render_size.h,
    }
}

fn upgrade_code_runs(
    code_runs: Vec<(current::PosSchema, current::CodeRunSchema)>,
    columns: &[(i64, current::ColumnSchema)],
    render_size: current::Contiguous2DSchema<Option<current::RenderSizeSchema>>,
    offsets: &OffsetsSchema,
) -> Result<Vec<(v1_8::PosSchema, v1_8::DataTableSchema)>> {
    let render_size = import_contiguous_2d(render_size, opt_fn(import_render_size));
    code_runs
        .into_iter()
        .enumerate()
        .map(|(i, (pos, code_run))| {
            let error = if let current::CodeRunResultSchema::Err(error) = &code_run.result {
                Some(error.to_owned())
            } else {
                None
            };
            let new_code_run = v1_8::CodeRunSchema {
                std_out: code_run.std_out,
                std_err: code_run.std_err,
                cells_accessed: code_run.cells_accessed,
                error,
                return_type: code_run.return_type,
                line_number: code_run.line_number,
                output_type: code_run.output_type,
            };

            let column = columns
                .iter()
                .find(|(x, _)| *x == pos.x)
                .ok_or_else(|| anyhow::anyhow!("Column {} not found", pos.x))?;

            let mut is_chart_or_html = false;
            let value = if let current::CodeRunResultSchema::Ok(value) = &code_run.result {
                match value.to_owned() {
                    current::OutputValueSchema::Single(cell_value) => {
                        if matches!(
                            cell_value,
                            current::CellValueSchema::Html(_) | current::CellValueSchema::Image(_)
                        ) {
                            is_chart_or_html = true;
                        }
                        v1_8::OutputValueSchema::Single(cell_value)
                    }
                    current::OutputValueSchema::Array(array) => {
                        v1_8::OutputValueSchema::Array(v1_8::OutputArraySchema {
                            size: v1_8::OutputSizeSchema {
                                w: array.size.w,
                                h: array.size.h,
                            },
                            values: array.values,
                        })
                    }
                }
            } else {
                v1_8::OutputValueSchema::Single(v1_8::CellValueSchema::Blank)
            };

            let code =
                column
                    .1
                    .iter()
                    .find_map(|(y, value)| if *y == pos.y { Some(value) } else { None });

            let data_table_name = if let Some(current::CellValueSchema::Code(code_cell)) = code {
                match code_cell.language {
                    current::CodeCellLanguageSchema::Formula => Some("Formula"),
                    current::CodeCellLanguageSchema::Javascript => {
                        if is_chart_or_html {
                            Some("Chart")
                        } else {
                            Some("JavaScript")
                        }
                    }
                    current::CodeCellLanguageSchema::Python => {
                        if is_chart_or_html {
                            Some("Chart")
                        } else {
                            Some("Python")
                        }
                    }
                    _ => Some("Table"),
                }
            } else {
                Some("Table")
            };
            let data_table_name = format!("{}{}", data_table_name.unwrap_or("Table"), i + 1);

            let chart_pos = Pos { x: pos.x, y: pos.y };
            let chart_pixel_output = render_size.get(chart_pos).and_then(|render_size| {
                render_size
                    .w
                    .parse::<f32>()
                    .ok()
                    .and_then(|w| render_size.h.parse::<f32>().ok().map(|h| (w, h)))
            });
            let chart_output = if is_chart_or_html {
                let (pixel_width, pixel_height) =
                    chart_pixel_output.unwrap_or((DEFAULT_HTML_WIDTH, DEFAULT_HTML_HEIGHT));
                let column_widths = Offsets::import_columns(offsets.0.clone());
                let start_x = column_widths.position(pos.x);
                let end = column_widths.find_offset(start_x + pixel_width as f64).0;
                let w = end - pos.x + 1;

                let row_heights = Offsets::import_rows(offsets.1.clone());
                let start_y = row_heights.position(pos.y);
                let end = row_heights.find_offset(start_y + pixel_height as f64).0;
                let h = end - pos.y + 1;
                Some((w as u32, h as u32))
            } else {
                None
            };
            let new_data_table = v1_8::DataTableSchema {
                kind: v1_8::DataTableKindSchema::CodeRun(new_code_run),
                name: data_table_name,
                header_is_first_row: false,
                show_ui: chart_output.is_some(),
                show_name: true,
                show_columns: true,
                columns: None,
                sort: None,
                display_buffer: None,
                value,
                readonly: true,
                spill_error: code_run.spill_error,
                last_modified: code_run.last_modified,
                alternating_colors: true,
                formats: Default::default(),
                borders: Default::default(),
                chart_pixel_output,
                chart_output,
            };
            Ok((v1_8::PosSchema::from(pos), new_data_table))
        })
        .collect::<Result<Vec<(v1_8::PosSchema, v1_8::DataTableSchema)>>>()
}

pub fn upgrade_sheet(sheet: current::SheetSchema) -> v1_8::SheetSchema {
    let current::SheetSchema {
        id,
        name,
        color,
        order,
        offsets,
        rows_resize,
        formats,
        validations,
        borders,
        code_runs,
        columns,
    } = sheet;

    let current::SheetFormattingSchema { render_size, .. } = formats;

    let upgraded_formats = v1_8::SheetFormattingSchema {
        align: formats.align,
        vertical_align: formats.vertical_align,
        wrap: formats.wrap,
        numeric_format: formats.numeric_format,
        numeric_decimals: formats.numeric_decimals,
        numeric_commas: formats.numeric_commas,
        bold: formats.bold,
        italic: formats.italic,
        text_color: formats.text_color,
        fill_color: formats.fill_color,
        date_time: formats.date_time,
        underline: formats.underline,
        strike_through: formats.strike_through,
    };

    let data_tables =
        upgrade_code_runs(code_runs, &columns, render_size, &offsets).unwrap_or_default();

    v1_8::SheetSchema {
        id,
        name,
        color,
        order,
        offsets,
        rows_resize,
        validations,
        borders,
        formats: upgraded_formats,
        data_tables,
        columns,
    }
}

pub fn upgrade(grid: current::GridSchema) -> Result<v1_8::GridSchema> {
    let new_grid = v1_8::GridSchema {
        version: Some("1.8".to_string()),
        sheets: grid.sheets.into_iter().map(upgrade_sheet).collect(),
    };
    Ok(new_grid)
}
