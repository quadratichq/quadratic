use anyhow::Result;
use bigdecimal::BigDecimal;
use std::collections::HashMap;
use std::str::FromStr;
use std::vec;

use super::schema::{Any, ArrayOutput, Cell};
use crate::color::Rgba;
use crate::grid::file::v1_3::schema::GridSchema;
use crate::grid::file::v1_4::schema as v1_4;

pub(crate) fn upgrade(schema: GridSchema) -> Result<v1_4::GridSchema> {
    let sheet = upgrade_sheet(schema)?;

    let converted = v1_4::GridSchema {
        version: Some("1.4".into()),
        sheets: vec![sheet],
    };

    Ok(converted)
}

pub fn language_conversion(language: &str) -> String {
    match language.to_lowercase().as_str() {
        "python" => "Python".into(),
        "formula" => "Formula".into(),
        "javascript" => "JavaScript".into(),
        "sql" => "Sql".into(),
        _ => String::new(),
    }
}

impl From<Any> for v1_4::OutputValueValue {
    fn from(val: Any) -> Self {
        match val {
            Any::Number(n) => match BigDecimal::from_str(n.to_string().as_str()).ok() {
                Some(n) => Self {
                    type_field: "NUMBER".into(),
                    value: n.to_string(),
                },
                None => Self {
                    type_field: "TEXT".into(),
                    value: n.to_string(),
                },
            },
            Any::String(s) => match BigDecimal::from_str(&s) {
                Ok(n) => Self {
                    type_field: "NUMBER".into(),
                    value: n.to_string(),
                },
                Err(_) => Self {
                    type_field: "TEXT".into(),
                    value: s.to_string(),
                },
            },
            Any::Boolean(b) => Self {
                type_field: "LOGICAL".into(),
                value: b.to_string(),
            },
        }
    }
}

struct SheetBuilder {
    sheet_id: v1_4::Id,
    columns: HashMap<i64, v1_4::Column>,
    column_ids: HashMap<i64, v1_4::Id>,
    row_ids: HashMap<i64, v1_4::Id>,
    borders: v1_4::Borders,
}
#[allow(clippy::unwrap_or_default)]
impl SheetBuilder {
    fn column_id(&mut self, x: i64) -> &mut v1_4::Id {
        self.column_ids.entry(x).or_insert_with(v1_4::Id::new)
    }

    fn row_id(&mut self, x: i64) -> &mut v1_4::Id {
        self.row_ids.entry(x).or_insert_with(v1_4::Id::new)
    }

    fn column(&mut self, x: i64) -> &mut v1_4::Column {
        let id = self.column_id(x).to_owned();
        self.columns
            .entry(x)
            .or_insert_with(|| v1_4::Column::with_id(id))
    }

    fn cell_ref(&mut self, (x, y): (i64, i64)) -> v1_4::CellRef {
        v1_4::CellRef {
            sheet: self.sheet_id.to_owned(),
            column: self.column_id(x).to_owned(),
            row: self.row_id(y).to_owned(),
        }
    }

    fn cell_value(&mut self, x: i64, y: i64, type_field: &str, value: &str) {
        let column = self.column(x);

        if type_field == "text" {
            let type_field = match BigDecimal::from_str(value) {
                Ok(_) => "NUMBER",
                Err(_) => "TEXT",
            };

            column.values.insert(
                y.to_string(),
                (
                    y,
                    v1_4::ColumnValue {
                        type_field: type_field.into(),
                        value: value.to_owned(),
                    },
                )
                    .into(),
            );
        }
    }

    fn code_cell_value(&mut self, cell: &Cell, cell_ref: v1_4::CellRef) -> v1_4::CodeCellValue {
        let default = String::new();
        let language = language_conversion(&cell.type_field);
        let code_string = match cell.type_field.to_lowercase().as_str() {
            "python" => cell.python_code.as_ref().unwrap_or(&default),
            "formula" => cell.formula_code.as_ref().unwrap_or(&default),
            "javascript" => &default,
            "sql" => &default,
            _ => &default,
        };
        let formatted_code_string = cell
            .evaluation_result
            .as_ref()
            .map(|result| result.formatted_code.to_string());

        v1_4::CodeCellValue {
            language,
            code_string: code_string.to_string(),
            formatted_code_string,
            last_modified: cell.last_modified.as_ref().unwrap_or(&default).to_string(),
            output: cell.evaluation_result.to_owned().and_then(|result| {
                let column = self.column(cell.x);
                let code_cell_result = match result.success {
                    true => v1_4::CodeCellRunResult::Ok {
                        output_value: if let Some(array) = result.array_output {
                            match array {
                                ArrayOutput::Array(values) => {
                                    for dy in 0..values.len() {
                                        let y = cell.y + dy as i64;

                                        column
                                            .spills
                                            .insert(y.to_string(), (y, cell_ref.to_owned()).into());
                                    }
                                    v1_4::OutputValue::Array(v1_4::OutputArray {
                                        size: v1_4::OutputSize {
                                            w: 1_i64,
                                            h: values.len() as i64,
                                        },
                                        values: values
                                            .into_iter()
                                            .flat_map(|v| v.map(|v| v.into()))
                                            .collect(),
                                    })
                                }
                                ArrayOutput::Block(mut values) => {
                                    // TODO(ddimaria): this is a hack, but makes a single use case pass
                                    // review approaches and refine this
                                    if values.is_empty() {
                                        if let Some(output_value) = result.output_value {
                                            values = vec![vec![Some(Any::String(output_value))]];
                                        }
                                    }

                                    for dy in 0..values.len() {
                                        for dx in 0..values.first()?.len() {
                                            let x = cell.x + dx as i64;
                                            let y = cell.y + dy as i64;
                                            let column = self.column(x);

                                            column.spills.insert(
                                                y.to_string(),
                                                (y, cell_ref.to_owned()).into(),
                                            );
                                        }
                                    }
                                    v1_4::OutputValue::Array(v1_4::OutputArray {
                                        size: v1_4::OutputSize {
                                            w: values.first()?.len() as i64,
                                            h: values.len() as i64,
                                        },
                                        values: values
                                            .into_iter()
                                            .flatten()
                                            .flat_map(|v| v.map(|v| v.into()))
                                            .collect(),
                                    })
                                }
                            }
                        } else if let Some(value) = result.output_value {
                            column
                                .spills
                                .insert(cell.y.to_string(), (cell.y, cell_ref.to_owned()).into());
                            v1_4::OutputValue::Single(v1_4::OutputValueValue {
                                type_field: "TEXT".into(),
                                value,
                            })
                        } else {
                            v1_4::OutputValue::Single(v1_4::OutputValueValue {
                                type_field: "BLANK".into(),
                                value: "".into(),
                            })
                        },
                        cells_accessed: result
                            .cells_accessed
                            .iter()
                            .map(|&(x, y)| self.cell_ref((x, y)))
                            .collect(),
                    },
                    false => v1_4::CodeCellRunResult::Err {
                        error: v1_4::Error {
                            span: result
                                .error_span
                                .map(|(start, end)| v1_4::Span { start, end }),
                            msg: "unknown error".into(),
                        },
                    },
                };

                Some(v1_4::CodeCellRunOutput {
                    std_out: result.std_out,
                    std_err: result.std_err,
                    result: code_cell_result,
                    spill: false,
                })
            }),
        }
    }
}

pub(crate) fn upgrade_sheet(v: GridSchema) -> Result<v1_4::Sheet> {
    let sheet_id = v1_4::Id::new();
    let column_widths = v
        .columns
        .iter()
        .map(|column| (column.id, column.size))
        .collect();
    let row_heights = v.rows.iter().map(|row| (row.id, row.size)).collect();

    let mut code_cells = vec![];

    let mut sheet = SheetBuilder {
        sheet_id: sheet_id.to_owned(),
        columns: HashMap::new(),
        column_ids: HashMap::new(),
        row_ids: HashMap::new(),
        borders: HashMap::new(),
    };

    // Save cell data
    for cell in v.cells {
        let pos = (cell.x, cell.y);
        let cell_ref = sheet.cell_ref(pos);

        match cell.type_field.to_lowercase().as_str() {
            "text" => {
                sheet.cell_value(cell.x, cell.y, "text", &cell.value);
            }
            // TODO(ddimaria): implement for other languages
            "python" | "formula" => {
                sheet.cell_value(
                    cell.x,
                    cell.y,
                    &language_conversion(&cell.type_field),
                    &cell.value,
                );
                let code_cell = (cell_ref.to_owned(), sheet.code_cell_value(&cell, cell_ref));
                code_cells.push(code_cell);
            }
            _ => {}
        };
    }

    for format in v.formats {
        let column = sheet.column(format.x);
        let y = format.y;

        format
            .alignment
            .map(|format| column.align.insert(y.to_string(), format.into()));
        format
            .wrapping
            .map(|format| column.wrap.insert(y.to_string(), format.into()));
        format
            .bold
            .map(|format| column.bold.insert(y.to_string(), format.into()));
        format
            .italic
            .map(|format| column.italic.insert(y.to_string(), format.into()));
        format
            .text_color
            .map(|format| column.text_color.insert(y.to_string(), format.into()));
        format
            .fill_color
            .map(|format| column.fill_color.insert(y.to_string(), format.into()));

        if let Some(text_format) = format.text_format {
            column.numeric_format.insert(
                format.y.to_string(),
                v1_4::NumericFormat {
                    kind: text_format.type_field,
                    symbol: text_format.symbol.map(|symbol| match symbol.as_ref() {
                        "USD" => "$".into(),
                        _ => symbol,
                    }),
                }
                .into(),
            );

            text_format.decimal_places.map(|decimals| {
                column
                    .numeric_decimals
                    .insert(format.y.to_string(), (decimals as i16).into())
            });
        }
    }

    for border in v.borders {
        let column = sheet.column(border.x);
        let column_id = column.id.to_string();
        let top = border.horizontal.map(|horizontal| v1_4::CellBorder {
            color: Rgba::from_css_str(&horizontal.color.unwrap_or("rgb(0, 0, 0)".into()))
                .unwrap_or_default()
                .as_string(),
            line: horizontal.border_type.unwrap_or("line1".into()),
        });
        let left = border.vertical.map(|vertical| v1_4::CellBorder {
            color: Rgba::from_css_str(&vertical.color.unwrap_or("rgb(0, 0, 0)".into()))
                .unwrap_or_default()
                .as_string(),
            line: vertical.border_type.unwrap_or("line1".into()),
        });

        let sides = vec![left, top, None, None];
        let entry = (border.y, sides);

        sheet
            .borders
            .entry(column_id)
            .and_modify(|value| value.push(entry.clone()))
            .or_insert(vec![entry]);
    }

    Ok(v1_4::Sheet {
        id: sheet_id,
        name: "Sheet 1".into(),
        color: None,
        order: "a0".into(),
        offsets: (column_widths, row_heights),
        columns: sheet
            .columns
            .into_iter()
            .map(|(id, col)| (id.to_owned(), col))
            .collect(),
        rows: sheet
            .row_ids
            .into_iter()
            .map(|(id, row_id)| (id, v1_4::Id { id: row_id.id }))
            .collect(),
        borders: sheet.borders,
        code_cells,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::anyhow;

    const V1_3_FILE: &str =
        include_str!("../../../../../quadratic-rust-shared/data/grid/v1_3.grid");

    fn import(file_contents: &str) -> Result<GridSchema> {
        serde_json::from_str::<GridSchema>(file_contents)
            .map_err(|e| anyhow!("Could not import file: {:?}", e))
    }

    fn export(grid_schema: &GridSchema) -> Result<String> {
        serde_json::to_string(grid_schema).map_err(|e| anyhow!("Could not export file: {:?}", e))
    }

    #[test]
    fn import_export_and_upgrade_a_v1_3_file() {
        let imported = import(V1_3_FILE).unwrap();

        // we currently just care that this doesn't error
        // TODO(ddimaria): validate that elements of the exported GridSchema are valid
        export(&imported).unwrap();

        // we currently just care that this doesn't error
        // TODO(ddimaria): validate that elements of the upgraded GridSchema are valid
        let _upgraded = upgrade(imported).unwrap();
    }
}
