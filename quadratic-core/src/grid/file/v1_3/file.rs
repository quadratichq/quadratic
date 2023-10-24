use anyhow::Result;
use bigdecimal::{BigDecimal, FromPrimitive};
use std::collections::HashMap;
use std::str::FromStr;

use crate::grid::file::v1_3::schema::GridSchema;
use crate::grid::file::v1_5::schema as current;
use crate::grid::file::v1_5::schema::{
    Borders as BordersV1_5, CellRef as CellRefV1_5, Column as ColumnV1_5,
    ColumnValue as ColumnValueV1_5, GridSchema as GridSchemaV1_5, Id as IdV1_5, Sheet as SheetV1_5,
};

use super::schema::{Any, ArrayOutput, Cell};

pub(crate) fn upgrade(schema: GridSchema) -> Result<GridSchemaV1_5> {
    let sheet = upgrade_sheet(schema)?;

    let converted = GridSchemaV1_5 {
        version: Some("1.5".into()),
        sheets: vec![sheet],
    };

    Ok(converted)
}

impl From<Any> for current::OutputValueValue {
    fn from(val: Any) -> Self {
        match val {
            Any::Number(n) => match BigDecimal::from_f64(n) {
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
    sheet_id: IdV1_5,
    columns: HashMap<i64, ColumnV1_5>,
    column_ids: HashMap<i64, IdV1_5>,
    row_ids: HashMap<i64, IdV1_5>,
}
impl SheetBuilder {
    fn column_id(&mut self, x: i64) -> &mut IdV1_5 {
        self.column_ids.entry(x).or_insert_with(IdV1_5::new)
    }
    fn row_id(&mut self, x: i64) -> &mut IdV1_5 {
        self.row_ids.entry(x).or_insert_with(IdV1_5::new)
    }
    fn column(&mut self, x: i64) -> &mut ColumnV1_5 {
        let id = self.column_id(x).to_owned();
        self.columns
            .entry(x)
            .or_insert_with(|| ColumnV1_5::with_id(id))
    }
    fn cell_ref(&mut self, (x, y): (i64, i64)) -> CellRefV1_5 {
        CellRefV1_5 {
            sheet: self.sheet_id.to_owned(),
            column: self.column_id(x).to_owned(),
            row: self.row_id(y).to_owned(),
        }
    }
    fn cell_value(&mut self, x: i64, y: i64, type_field: &str, value: &str) {
        let column = self.column(x);
        // println!("{} {} {} {}", x, y, type_field, value);

        match type_field {
            "text" => {
                column.values.insert(
                    y.to_string(),
                    (
                        y,
                        current::ColumnValue {
                            type_field: "text".into(),
                            value: value.to_owned(),
                        },
                    )
                        .into(),
                );
            }
            // "python" | "formula" => {
            //     column.values.insert(
            //         y.to_string(),
            //         (
            //             y,
            //             current::ColumnValue {
            //                 type_field: type_field.to_lowercase(),
            //                 value: value.to_owned(),
            //             },
            //         )
            //             .into(),
            //     );
            // }
            _ => {}
        }
    }
    fn code_cell_value(&mut self, cell: &Cell, cell_ref: CellRefV1_5) -> current::CodeCellValue {
        let default = String::new();
        let language = match cell.type_field.to_lowercase().as_str() {
            "python" => "Python",
            "formula" => "Formula",
            "javascript" => "JavaScript",
            "sql" => "Sql",
            _ => &default,
        };
        let code_string = match cell.type_field.to_lowercase().as_str() {
            "python" => cell.python_code.as_ref().unwrap_or(&default),
            "formula" => cell.formula_code.as_ref().unwrap_or(&default),
            "javascript" => &default,
            "sql" => &default,
            _ => &default,
        };
        let formatted_code_string = cell
            .clone()
            .evaluation_result
            .and_then(|result| Some(result.formatted_code));

        current::CodeCellValue {
            language: language.to_string(),
            code_string: code_string.to_string(),
            formatted_code_string,
            last_modified: cell.last_modified.as_ref().unwrap_or(&default).to_string(),
            output: cell.evaluation_result.to_owned().and_then(|result| {
                let column = self.column(cell.x);
                let code_cell_result = match result.success {
                    true => current::CodeCellRunResult::Ok {
                        output_value: if let Some(array) = result.array_output {
                            match array {
                                ArrayOutput::Array(values) => {
                                    for dy in 0..values.len() {
                                        let y = cell.y + dy as i64;

                                        column
                                            .spills
                                            .insert(y.to_string(), (y, cell_ref.clone()).into());
                                    }
                                    current::OutputValue::Array(current::OutputArray {
                                        size: current::OutputSize {
                                            w: 1 as i64,
                                            h: values.len() as i64,
                                        },
                                        values: values
                                            .into_iter()
                                            .flat_map(|v| v.and_then(|v| Some(v.into())))
                                            .collect(),
                                    })
                                }
                                ArrayOutput::Block(values) => {
                                    for dy in 0..values.len() {
                                        for dx in 0..values.get(0)?.len() {
                                            let x = cell.x + dx as i64;
                                            let y = cell.y + dy as i64;
                                            let column = self.column(x);

                                            column.spills.insert(
                                                y.to_string(),
                                                (y, cell_ref.clone()).into(),
                                            );
                                        }
                                    }
                                    current::OutputValue::Array(current::OutputArray {
                                        size: current::OutputSize {
                                            w: values.get(0)?.len() as i64,
                                            h: values.len() as i64,
                                        },
                                        values: values
                                            .into_iter()
                                            .flatten()
                                            .flat_map(|v| v.and_then(|v| Some(v.into())))
                                            .collect(),
                                    })
                                }
                            }
                        } else if let Some(value) = result.output_value {
                            column
                                .spills
                                .insert(cell.y.to_string(), (cell.y, cell_ref.clone()).into());
                            current::OutputValue::Single(current::OutputValueValue {
                                type_field: "TEXT".into(),
                                value,
                            })
                        } else {
                            current::OutputValue::Single(current::OutputValueValue {
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
                    false => current::CodeCellRunResult::Err {
                        error: current::Error {
                            span: result
                                .error_span
                                .map(|(start, end)| current::Span { start, end }),
                            msg: "unknown error".into(),
                        },
                    },
                };

                Some(current::CodeCellRunOutput {
                    std_out: result.std_out,
                    std_err: result.std_err,
                    result: code_cell_result,
                })
            }),
        }
    }
}

pub(crate) fn upgrade_sheet(v: GridSchema) -> Result<SheetV1_5> {
    let sheet_id = IdV1_5::new();
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
                sheet.cell_value(cell.x, cell.y, "Python", &cell.value);
                let code_cell = (cell_ref.clone(), sheet.code_cell_value(&cell, cell_ref));
                code_cells.push(code_cell);
            }
            _ => {}
        };
    }

    for js_format in v.formats {
        let column = sheet.column(js_format.x);
        let y = js_format.y;
        js_format
            .alignment
            .map(|format| column.align.insert(y.to_string(), format.into()));
        js_format
            .wrapping
            .map(|format| column.wrap.insert(y.to_string(), format.into()));
        js_format
            .bold
            .map(|format| column.bold.insert(y.to_string(), format.into()));
        js_format
            .italic
            .map(|format| column.italic.insert(y.to_string(), format.into()));
        js_format
            .text_color
            .map(|format| column.text_color.insert(y.to_string(), format.into()));
        js_format
            .fill_color
            .map(|format| column.fill_color.insert(y.to_string(), format.into()));

        // TODO(ddimaria): deterine if this is needed for upgrades
        // if let Some(text_format) = js_format.text_format.clone() {
        //     column.numeric_format.set(
        //         js_format.y,
        //         Some(NumericFormat {
        //             kind: text_format.kind,
        //             symbol: text_format.symbol,
        //         }),
        //     );

        //     if let Some(decimals) = text_format.decimal_places {
        //         column
        //             .numeric_decimals
        //             .set(js_format.y, Some(decimals as i16));
        //     }
        // }
    }

    // println!("{:#?}", code_cells);

    Ok(SheetV1_5 {
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
            .map(|(id, row_id)| (id, IdV1_5 { id: row_id.id }))
            .collect(),
        borders: BordersV1_5 {
            horizontal: HashMap::new(),
            vertical: HashMap::new(),
        }, // TODO: import borders
        code_cells,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::anyhow;

    const V1_3_FILE: &str = include_str!("../../../../examples/v1_3.json");

    fn import(file_contents: &str) -> Result<GridSchema> {
        Ok(serde_json::from_str::<GridSchema>(&file_contents)
            .map_err(|e| anyhow!("Could not import file: {:?}", e))?)
    }

    fn export(grid_schema: &GridSchema) -> Result<String> {
        Ok(serde_json::to_string(grid_schema)
            .map_err(|e| anyhow!("Could not export file: {:?}", e))?)
    }

    #[test]
    fn import_export_and_upgrade_a_v1_3_file() {
        let imported = import(V1_3_FILE).unwrap();

        // we currently just care that this doesn't error
        // TODO(ddimaria): validate that elements of the exported GridSchema are valid
        export(&imported).unwrap();

        // we currently just care that this doesn't error
        // TODO(ddimaria): validate that elements of the upgraded GridSchema are valid
        let upgraded = upgrade(imported).unwrap();
    }
}
