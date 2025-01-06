use anyhow::Result;

use crate::grid::file::serialize::contiguous_2d::import_contiguous_2d;
use crate::grid::file::serialize::contiguous_2d::opt_fn;
use crate::grid::file::v1_7_1 as current;
use crate::grid::file::v1_8;
use crate::grid::formatting::RenderSize;
use crate::Pos;

fn import_render_size(render_size: current::RenderSizeSchema) -> RenderSize {
    RenderSize {
        w: render_size.w,
        h: render_size.h,
    }
}

fn upgrade_code_runs(
    code_runs: Vec<(current::PosSchema, current::CodeRunSchema)>,
    columns: &[(i64, current::ColumnSchema)],
    formats: &current::SheetFormattingSchema,
) -> Result<Vec<(v1_8::PosSchema, v1_8::DataTableSchema)>> {
    let render_size = import_contiguous_2d(formats.render_size.clone(), opt_fn(import_render_size));
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
                .get(i)
                .ok_or_else(|| anyhow::anyhow!("Column {} not found", i))?;

            let data_table_name = column
                .1
                .iter()
                .filter_map(|(_, value)| {
                    if let current::CellValueSchema::Code(code_cell) = value {
                        let language = match code_cell.language {
                            current::CodeCellLanguageSchema::Formula => "Formula",
                            current::CodeCellLanguageSchema::Javascript => "JavaScript",
                            current::CodeCellLanguageSchema::Python => "Python",
                            _ => "Table1",
                        };
                        return Some(language);
                    }
                    None
                })
                .collect::<Vec<_>>();

            let data_table_name = data_table_name.first().unwrap_or(&"Table");
            let data_table_name = format!("{}{}", data_table_name, i);

            let value = if let current::CodeRunResultSchema::Ok(value) = &code_run.result {
                match value.to_owned() {
                    current::OutputValueSchema::Single(cell_value) => {
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

            let chart_pos = Pos { x: pos.x, y: pos.y };
            let chart_pixel_output = render_size.get(chart_pos).and_then(|render_size| {
                render_size
                    .w
                    .parse::<f32>()
                    .ok()
                    .and_then(|w| render_size.h.parse::<f32>().ok().map(|h| (w, h)))
            });
            let new_data_table = v1_8::DataTableSchema {
                kind: v1_8::DataTableKindSchema::CodeRun(new_code_run),
                name: data_table_name,
                header_is_first_row: false,
                show_header: false,
                columns: None,
                sort: None,
                display_buffer: None,
                value,
                readonly: true,
                spill_error: code_run.spill_error,
                last_modified: code_run.last_modified,
                alternating_colors: true,
                formats: Default::default(),
                chart_pixel_output,
                chart_output: None,
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

    let upgraded_formats = v1_8::SheetFormattingSchema {
        align: formats.align.clone(),
        vertical_align: formats.vertical_align.clone(),
        wrap: formats.wrap.clone(),
        numeric_format: formats.numeric_format.clone(),
        numeric_decimals: formats.numeric_decimals.clone(),
        numeric_commas: formats.numeric_commas.clone(),
        bold: formats.bold.clone(),
        italic: formats.italic.clone(),
        text_color: formats.text_color.clone(),
        fill_color: formats.fill_color.clone(),
        date_time: formats.date_time.clone(),
        underline: formats.underline.clone(),
        strike_through: formats.strike_through.clone(),
    };

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
        data_tables: upgrade_code_runs(code_runs, &columns, &formats).unwrap_or_default(),
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
