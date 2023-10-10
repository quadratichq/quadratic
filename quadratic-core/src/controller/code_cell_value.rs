use crate::{
    grid::{
        js_types::{JsRenderCellUpdate, JsRenderCellUpdateEnum},
        CodeCellValue, Sheet,
    },
    Pos, Value,
};

use super::compute::SheetPos;

/// Sets the value of a code cell and returns the undo value, updates to the UI, and additions to the compute cycle
pub fn update_code_cell_value(
    sheet: &mut Sheet,
    pos: SheetPos,
    code_cell: Option<CodeCellValue>,
    summary_set: &mut Vec<JsRenderCellUpdate>,
    cells_to_compute: &mut Vec<SheetPos>,
) -> Option<CodeCellValue> {
    let old_code_cell_value = sheet.set_code_cell_value(pos.into(), code_cell.clone());
    if let Some(code_cell) = code_cell {
        if let Some(output) = code_cell.output {
            if let Some(output_value) = output.result.output_value() {
                match output_value {
                    Value::Array(array) => {
                        for y in 0..array.size().h.into() {
                            for x in 0..array.size().w.into() {
                                // add all but the first cell to the compute cycle
                                if x != 0 && y != 0 {
                                    cells_to_compute.push(SheetPos {
                                        x: pos.x + x as i64,
                                        y: pos.y + y as i64,
                                        sheet_id: sheet.id,
                                    });
                                }
                                if let Ok(value) = array.get(x, y) {
                                    let entry_pos = Pos {
                                        x: pos.x + x as i64,
                                        y: pos.y + y as i64,
                                    };
                                    let (numeric_format, numeric_decimals) =
                                        sheet.cell_numeric_info(entry_pos);
                                    summary_set.push(JsRenderCellUpdate {
                                        x: pos.x + x as i64,
                                        y: pos.y + y as i64,
                                        update: JsRenderCellUpdateEnum::Value(Some(
                                            value.to_display(numeric_format, numeric_decimals),
                                        )),
                                    })
                                }
                            }
                        }
                    }
                    Value::Single(value) => {
                        let (numeric_format, numeric_decimals) =
                            sheet.cell_numeric_info(pos.into());
                        summary_set.push(JsRenderCellUpdate {
                            x: pos.x,
                            y: pos.y,
                            update: JsRenderCellUpdateEnum::Value(Some(
                                value.to_display(numeric_format, numeric_decimals),
                            )),
                        });
                    }
                };
            }
        }
    }
    old_code_cell_value
}
