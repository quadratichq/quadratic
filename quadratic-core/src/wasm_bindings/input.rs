use std::str::FromStr;

use wasm_bindgen::prelude::*;

use crate::{
    Pos, SheetPos,
    grid::{SheetId, js_types::Direction, sheet::data_tables::cache::SheetDataTablesCache},
    input::{jump::jump_cursor, move_cursor::move_cursor},
    wasm_bindings::{
        js_a1_context::JsA1Context, merge_cells::JsMergeCells,
        sheet_content_cache::SheetContentCache,
    },
};

/// Returns the SheetPos after a jump (ctrl/cmd + arrow key)
#[wasm_bindgen(js_name = "jumpCursor")]
#[allow(clippy::too_many_arguments)]
pub fn js_jump_cursor(
    sheet_id: String,
    col: i32,
    row: i32,
    direction: Direction,
    content_cache: &SheetContentCache,
    table_cache: &SheetDataTablesCache,
    context: &JsA1Context,
    merge_cells: &JsMergeCells,
) -> Result<Pos, String> {
    let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
    let sheet_pos = SheetPos {
        x: col as i64,
        y: row as i64,
        sheet_id,
    };
    Ok(jump_cursor(
        sheet_pos,
        direction,
        content_cache,
        table_cache,
        context.get_context(),
        Some(merge_cells.get_merge_cells()),
    ))
}

/// Returns the SheetPos after a move (arrow key)
#[wasm_bindgen(js_name = "moveCursor")]
pub fn js_move_cursor(
    sheet_id: String,
    col: i32,
    row: i32,
    direction: Direction,
    table_cache: &SheetDataTablesCache,
    context: &JsA1Context,
    merge_cells: &JsMergeCells,
) -> Result<Pos, String> {
    let sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
    let pos = SheetPos {
        x: col as i64,
        y: row as i64,
        sheet_id,
    };
    Ok(move_cursor(
        pos,
        direction,
        table_cache,
        context.get_context(),
        Some(merge_cells.get_merge_cells()),
    ))
}
